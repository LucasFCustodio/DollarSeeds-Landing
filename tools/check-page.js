'use strict';

/**
 * Load a page in real Chrome, with the real netlify.toml headers, and report
 * what actually happened: CSP violations, console errors, failed requests, and
 * whether the things that must render did.
 *
 * This exists mainly to prove the Content-Security-Policy does not break the
 * Termly consent banner. A CSP that blocks Termly breaks cookie compliance, and
 * that is not something to discover after deploying.
 *
 *   node tools/check-page.js                 # homepage
 *   node tools/check-page.js /50-30-20-rule  # any path
 *   node tools/check-page.js / --no-js       # with JavaScript disabled
 *
 * Talks to Chrome over the DevTools Protocol using Node's built-in WebSocket,
 * so there is no puppeteer dependency to install on a build machine.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { ROOT } = require('../scripts/site.config.js');
const { startServer } = require('./serve.js');

const PORT = 8131;
const CDP_PORT = 9333;
const SETTLE_MS = 6000;   // Termly loads its banner asynchronously

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const found = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH.');
  return found;
}

/** Poll the DevTools HTTP endpoint until Chrome is ready, then return the WS URL. */
async function debuggerUrl(deadlineMs = 20000) {
  const until = Date.now() + deadlineMs;
  while (Date.now() < until) {
    try {
      const res = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version');
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

/** Minimal CDP client: send(method, params) -> Promise, plus an event hook. */
function connect(wsUrl, onEvent) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;

  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      onEvent(msg.method, msg.params);
    }
  });

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP socket error')));
  });

  function send(method, params, sessionId) {
    const id = nextId++;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(payload));
    });
  }

  return { ready, send, close: () => ws.close() };
}

async function main() {
  // Accept "/lessons/tithing" or "lessons/tithing". Git Bash on Windows
  // rewrites a leading-slash argument into a Windows path, so the bare form is
  // the reliable one to type there.
  const arg = process.argv.slice(2).find(a => !a.startsWith('--'));
  const target = '/' + String(arg || '').replace(/^\/+/, '');
  const noJs = process.argv.includes('--no-js');

  const chrome = findChrome();
  const server = await startServer(ROOT, PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-check-'));

  const child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check',
    '--window-size=412,915',                    // a phone-ish viewport
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'ignore'] });

  const findings = { csp: [], console: [], failed: [] };

  try {
    const client = connect(await debuggerUrl(), (method, params) => {
      if (method === 'Log.entryAdded') {
        const e = params.entry;
        if (e.source === 'security' || /Content Security Policy/i.test(e.text || '')) {
          findings.csp.push(e.text);
        } else if (e.level === 'error') {
          findings.console.push(e.text + (e.url ? '  <- ' + e.url : ''));
        }
      }
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
        findings.console.push(params.args.map(a => a.value || a.description || '').join(' '));
      }
      if (method === 'Network.loadingFailed' && !params.canceled) {
        findings.failed.push(params.errorText + '  ' + (params.blockedReason || ''));
      }
    });
    await client.ready;

    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

    const s = (method, params) => client.send(method, params, sessionId);
    await s('Log.enable');
    await s('Runtime.enable');
    await s('Network.enable');
    await s('Page.enable');
    if (noJs) await s('Emulation.setScriptExecutionDisabled', { value: true });

    const url = 'http://127.0.0.1:' + PORT + target;
    await s('Page.navigate', { url });
    await sleep(SETTLE_MS);

    const evaluate = async expr => {
      const r = await s('Runtime.evaluate', { expression: expr, returnByValue: true });
      return r.result && r.result.value;
    };

    // What must be true on the page.
    const checks = {};
    checks['CSP header present'] = Boolean(await evaluate(
      "!!performance.getEntriesByType('navigation').length"));
    checks['trust bar rating text'] = await evaluate(
      "(document.querySelector('[data-stat=\"rating\"]')||{}).textContent || null");
    checks['trust bar rating count'] = await evaluate(
      "(document.querySelector('[data-stat=\"ratingCount\"]')||{}).textContent || null");
    checks['Termly script tag'] = await evaluate(
      "!!document.querySelector('script[src*=\"termly.io\"]')");
    checks['Termly runtime loaded'] = await evaluate(
      "!!(window.Termly || window.TERMLY_RESOURCE_BLOCKER || " +
      "document.querySelector('[class*=\"termly\"],[id*=\"termly\"],iframe[src*=\"termly\"]'))");
    checks['Termly banner / embed in DOM'] = await evaluate(
      "!!document.querySelector('#termly-code-snippet-support, .termly-styles-root, " +
      "[data-testid*=\"banner\"], iframe[src*=\"termly\"], div[class*=\"termly\"]')");
    checks['h1 rendered'] = await evaluate(
      "(document.querySelector('h1')||{}).textContent || null");
    checks['h1 computed font-weight'] = await evaluate(
      "document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).fontWeight : null");
    checks['h1 computed font-family'] = await evaluate(
      "document.querySelector('h1') ? getComputedStyle(document.querySelector('h1'))" +
      ".fontFamily.split(',')[0] : null");
    checks['hero image resolved to'] = await evaluate(
      "(document.querySelector('.phone-frame img')||{}).currentSrc || null");

    console.log('\n=== ' + target + (noJs ? '  [JavaScript disabled]' : '') + ' ===\n');
    for (const [k, v] of Object.entries(checks)) {
      console.log('  ' + k.padEnd(30) + ' : ' + (v === null ? '(absent)' : v));
    }

    const section = (title, items) => {
      console.log('\n  ' + title + ': ' + (items.length || 'none'));
      [...new Set(items)].slice(0, 12).forEach(i => console.log('    - ' + String(i).slice(0, 190)));
    };
    section('CSP violations', findings.csp);
    section('console errors', findings.console);
    section('failed requests', findings.failed);

    process.exitCode = findings.csp.length ? 1 : 0;
  } finally {
    child.kill();
    server.close();
    // Chrome can still hold handles in the profile dir for a moment after
    // kill(); a leftover temp dir is not worth failing the check over.
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().catch(err => { console.error('check-page: ' + err.message); process.exit(1); });
