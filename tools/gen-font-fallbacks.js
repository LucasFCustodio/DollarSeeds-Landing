'use strict';

/**
 * Compute metric-matched fallback @font-face rules for the three self-hosted
 * faces, and print the CSS to paste into assets/css/base.css.
 *
 * WHY: with font-display: swap, text is first painted in the fallback face and
 * then repainted in the webfont. If the two faces have different metrics, every
 * line of text changes width and height at that moment — which re-wraps the
 * nav and moves the hero, i.e. cumulative layout shift, measured at 0.11 on
 * mobile before this existed.
 *
 * A fallback @font-face wraps a local system font in `size-adjust` and
 * ascent/descent overrides so it occupies the same space as the real face.
 * The swap then changes the glyphs without moving anything.
 *
 * Metrics are measured in real Chrome via canvas TextMetrics rather than parsed
 * out of the WOFF2, because that is what the browser will actually use to lay
 * the text out, and because the files are Brotli-compressed.
 *
 *   node tools/gen-font-fallbacks.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { ROOT } = require('../build/site.config.js');
const { startServer } = require('./serve.js');

const PORT = 8151;
const CDP_PORT = 9351;

// Arial is the reference fallback: present on Windows and macOS, and metrically
// the same as Liberation Sans on Linux and close to Helvetica on iOS.
const FALLBACK = 'Arial';
// Helvetica is metrically compatible with Arial and is what macOS/iOS resolve;
// listing both covers Windows, macOS and iOS. Android has neither, so it falls
// through to an unadjusted system-ui — acceptable for an iOS-only app's site.
const FALLBACK_LOCALS = ['Arial', 'Helvetica'];

const FACES = [
  { family: 'Urbanist', weight: 580, varName: 'display' },   // headings
  { family: 'Figtree', weight: 400, varName: 'sans' },       // body
  { family: 'JetBrains Mono', weight: 400, varName: 'mono' } // eyebrows
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
].filter(Boolean);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function debuggerUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + CDP_PORT + '/json/version');
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let id = 1;
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(m.error.message)) : resolve(m.result);
    }
  });
  const ready = new Promise(res => ws.addEventListener('open', res));
  const send = (method, params, sessionId) => new Promise((resolve, reject) => {
    const msg = { id: id++, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    pending.set(msg.id, { resolve, reject });
    ws.send(JSON.stringify(msg));
  });
  return { ready, send };
}

/** Measured in the page: ascent, descent and average advance width at 1000px. */
const MEASURE = `(async () => {
  const SAMPLE = 'Download on the App Store DollarSeeds budgeting Needs Wants Savings ' +
                 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const SIZE = 1000;
  await document.fonts.ready;

  function metrics(font) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font;
    const m = ctx.measureText(SAMPLE);
    return {
      width: m.width,
      ascent: m.fontBoundingBoxAscent,
      descent: m.fontBoundingBoxDescent
    };
  }

  const out = {};
  for (const face of __FACES__) {
    // Force the face to be downloaded and applied before measuring.
    await document.fonts.load(face.weight + ' ' + SIZE + 'px "' + face.family + '"');
    out[face.family] = {
      web: metrics(face.weight + ' ' + SIZE + 'px "' + face.family + '"'),
      fallback: metrics(face.weight + ' ' + SIZE + 'px ' + JSON.stringify('__FALLBACK__'))
    };
  }
  return JSON.stringify(out);
})()`;

function pct(n) { return (Math.round(n * 10000) / 100).toFixed(2) + '%'; }

async function main() {
  const chrome = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.');

  const server = await startServer(ROOT, PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-fonts-'));
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + profile,
    '--no-first-run', 'about:blank'], { stdio: 'ignore' });

  try {
    const c = connect(await debuggerUrl());
    await c.ready;
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    const s = (m, p) => c.send(m, p, sessionId);

    await s('Page.enable');
    await s('Runtime.enable');
    // Any page that links base.css will do — it declares all three @font-faces.
    await s('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' });
    await sleep(4000);

    const expression = MEASURE
      .replace('__FACES__', JSON.stringify(FACES))
      .replace('__FALLBACK__', FALLBACK);
    const res = await s('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (!res.result || !res.result.value) throw new Error('measurement returned nothing');
    const measured = JSON.parse(res.result.value);

    const css = [];
    css.push('/* ------------------------------------------------------------');
    css.push('   METRIC-MATCHED FALLBACKS');
    css.push('   Generated by tools/gen-font-fallbacks.js — do not hand-tune.');
    css.push('');
    css.push('   With font-display: swap the browser paints text in a fallback');
    css.push('   face first, then repaints in the real one. These rules make the');
    css.push('   fallback occupy exactly the same space as the webfont, so that');
    css.push('   repaint does not re-wrap the nav or move the hero. Removing them');
    css.push('   costs roughly 0.1 CLS on mobile.');
    css.push('   ------------------------------------------------------------ */');

    for (const face of FACES) {
      const m = measured[face.family];
      if (!m || !m.web.width || !m.fallback.width) throw new Error('no metrics for ' + face.family);

      // How much to scale the fallback so a line of text is the same width.
      const sizeAdjust = m.web.width / m.fallback.width;
      // Overrides are relative to the *adjusted* em, hence the division.
      const ascent = m.web.ascent / 1000 / sizeAdjust;
      const descent = m.web.descent / 1000 / sizeAdjust;

      css.push('@font-face {');
      css.push("  font-family: '" + face.family + " Fallback';");
      css.push('  src: ' + FALLBACK_LOCALS.map(f => "local('" + f + "')").join(', ') + ';');
      css.push('  size-adjust: ' + pct(sizeAdjust) + ';');
      css.push('  ascent-override: ' + pct(ascent) + ';');
      css.push('  descent-override: ' + pct(descent) + ';');
      css.push('  line-gap-override: 0%;');
      css.push('}');

      console.error('  ' + face.family.padEnd(16) +
        ' web ' + Math.round(m.web.width) + 'px vs ' + FALLBACK + ' ' + Math.round(m.fallback.width) +
        'px  ->  size-adjust ' + pct(sizeAdjust));
    }

    console.error('');
    console.error('Add these to the font stacks in :root —');
    for (const f of FACES) {
      console.error("  --" + f.varName + ": '" + f.family + "', '" + f.family + " Fallback', " +
        (f.varName === 'mono' ? 'monospace;' : 'system-ui, sans-serif;'));
    }
    console.error('');

    console.log(css.join('\n'));
  } finally {
    child.kill();
    server.close();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().catch(err => { console.error('gen-font-fallbacks: ' + err.message); process.exit(1); });
