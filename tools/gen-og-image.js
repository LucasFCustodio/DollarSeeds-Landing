'use strict';

/**
 * One-off: render the 1200x630 Open Graph card.
 *
 * The card is composed in tools/og/og-image.html and screenshotted with
 * headless Chrome rather than drawn with sharp, because the type has to be set
 * in the real brand faces — Urbanist at font-weight 580 in particular, which
 * only a variable font resolves. sharp's SVG text renderer would fall back to a
 * system face and the card would not look like the site.
 *
 * Chrome loads the page from the local dev server so /assets/* paths resolve
 * exactly as they do in production. The server runs in THIS process, so Chrome
 * must be spawned asynchronously — a synchronous spawn blocks the event loop
 * and the server never answers.
 *
 *   npm run og
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const { ROOT } = require('../build/site.config.js');
const { startServer } = require('./serve.js');

const WIDTH = 1200;
const HEIGHT = 630;
const OUT = path.join(ROOT, 'assets', 'images', 'og-default.png');
const PORT = 8123;
const TIMEOUT_MS = 120000;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].filter(Boolean);

function findChrome() {
  const found = CHROME_CANDIDATES.find(p => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome/Chromium binary.');
  return found;
}

function screenshot(chrome, url, out) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',   // render at 2x, downsample for crisp type
      '--window-size=' + WIDTH + ',' + HEIGHT,
      '--screenshot=' + out,
      url
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => { child.kill(); reject(new Error('Chrome timed out')); }, TIMEOUT_MS);
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', () => {
      clearTimeout(timer);
      if (fs.existsSync(out)) return resolve();
      reject(new Error('Chrome produced no screenshot.\n' + stderr.slice(0, 800)));
    });
  });
}

async function main() {
  const chrome = findChrome();
  const server = await startServer(ROOT, PORT);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-og-'));
  const shot = path.join(tmp, 'og.png');

  try {
    await screenshot(chrome, 'http://127.0.0.1:' + PORT + '/tools/og/og-image.html', shot);

    const meta = await sharp(shot).metadata();
    await sharp(shot)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .flatten({ background: '#FAF7EE' })   // OG images must be opaque
      .png({ compressionLevel: 9 })
      .toFile(OUT);

    const kb = Math.round(fs.statSync(OUT).size / 102.4) / 10;
    console.log('captured ' + meta.width + 'x' + meta.height + ' -> ' + WIDTH + 'x' + HEIGHT + '  ' + kb + ' KB');
    console.log('wrote ' + path.relative(ROOT, OUT).split(path.sep).join('/'));
  } finally {
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(err => { console.error('gen-og-image: ' + err.message); process.exit(1); });
