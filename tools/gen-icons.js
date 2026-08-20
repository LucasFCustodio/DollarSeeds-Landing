'use strict';

/**
 * One-off: generate the favicon / app-icon set and site.webmanifest.
 * Not part of the Netlify build — outputs are committed. Rerun with
 * `npm run icons` after changing the logo or the seedling mark.
 *
 * Two marks, chosen by size:
 *   - small (favicon.ico 16/32/48, favicon.svg) -> assets/brand/seedling.svg.
 *     The badge logo is a detailed greyscale illustration; below ~96px it turns
 *     to mud, so small marks use the emerald seedling instead.
 *   - large (apple-touch-icon 180, icon-192, icon-512) -> assets/brand/logo.png
 *     on the cream ground, where the badge is still legible and recognisable.
 *   - maskable-512 -> the seedling, full-bleed on forest, art inside the 80%
 *     safe zone so Android's circle mask cannot clip it.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ROOT, APP, ORIGIN } = require('../scripts/site.config.js');
const { buildIco } = require('./ico.js');

// Brand tokens, mirrored from assets/css/base.css :root
const CREAM = '#FAF7EE';   // --ground-0, matches <meta name="theme-color">
const FOREST = '#0F3D2E';  // --forest

const SEEDLING = path.join(ROOT, 'assets', 'brand', 'seedling.svg');
const LOGO = path.join(ROOT, 'assets', 'brand', 'logo.png');

const written = [];
function record(file, buf) {
  fs.writeFileSync(path.join(ROOT, file), buf);
  written.push([file, buf.length]);
}

/** Render the seedling SVG at `size`, optionally full-bleed for maskable use. */
async function seedling(size, { maskable = false } = {}) {
  const svg = fs.readFileSync(SEEDLING, 'utf8');
  if (!maskable) {
    return sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  }
  // Android masks to a circle and can crop the outer 10% on each edge, so the
  // rounded corners come off (the mask supplies them) and the art shrinks into
  // the safe zone.
  const flat = svg.replace('rx="14"', 'rx="0"');
  const art = await sharp(Buffer.from(flat), { density: 600 })
    .resize(Math.round(size * 0.8), Math.round(size * 0.8)).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: FOREST } })
    .composite([{ input: art, gravity: 'center' }]).png({ compressionLevel: 9 }).toBuffer();
}

/** Render the badge logo at `size` on an opaque cream ground. */
async function badge(size, inset = 0.86) {
  const art = await sharp(LOGO)
    .resize(Math.round(size * inset), Math.round(size * inset),
            { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: art, gravity: 'center' }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

async function main() {
  // --- favicon.svg: the seedling, served as-is (scales to any size) ---
  record('favicon.svg', fs.readFileSync(SEEDLING));

  // --- favicon.ico: 16 / 32 / 48, seedling ---
  const icoSizes = [16, 32, 48];
  const icoPngs = await Promise.all(icoSizes.map(s => seedling(s)));
  record('favicon.ico', buildIco(icoSizes.map((size, i) => ({ size, png: icoPngs[i] }))));

  // --- Apple touch icon: 180x180, opaque (iOS ignores alpha and adds its own mask) ---
  record('apple-touch-icon.png', await badge(180));

  // --- PWA / Android icons ---
  record('icon-192.png', await badge(192));
  record('icon-512.png', await badge(512));
  record('icon-maskable-512.png', await seedling(512, { maskable: true }));

  // --- Web app manifest ---
  const manifest = {
    name: APP.name + ' — Christian Budgeting App',
    short_name: APP.name,
    description: 'Split every dollar across Needs, Wants, and Savings automatically. ' +
                 'A Christian budgeting app for iPhone — no bank login required.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: CREAM,
    theme_color: CREAM,
    lang: 'en-US',
    dir: 'ltr',
    categories: ['finance', 'education', 'lifestyle'],
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    related_applications: [
      { platform: 'itunes', url: APP.storeUrl, id: APP.bundleId }
    ],
    prefer_related_applications: true
  };
  record('site.webmanifest', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));

  const pad = Math.max(...written.map(w => w[0].length));
  for (const [file, bytes] of written) {
    console.log(file.padEnd(pad + 2) + String(Math.round(bytes / 102.4) / 10 + ' KB').padStart(9));
  }
  console.log('\nManifest start_url ' + ORIGIN + '/  ·  theme ' + CREAM);
}

main().catch(err => { console.error('gen-icons: ' + err.stack); process.exit(1); });
