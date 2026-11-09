'use strict';

/**
 * Seed Rush streak plant: composite the app's debt-plant art into six stage
 * images (assets/images/streak/), so the streak grows the same plant the app does.
 *
 *   node tools/gen-streak-art.js
 *
 * One-off generator, like the others in tools/: the output is committed, rerun
 * only when the art or the stages change. It reads the APP REPO (read-only).
 *
 * Layer order matches the app (frontend/components/debts/PlantView.tsx):
 *   back (stems behind the pot) → empty pot → [pot label: never drawn here] → front
 * The paid-off art is one file. No label text, no debt name, anywhere.
 *
 * Species 2 is used: of the four, species 2 (cactus) and 4 (flowering bush)
 * carry flowers when full-grown and paid off, and the lower number wins.
 *
 * Every stage is cropped to the SAME box (the union of all stages' bounds, plus
 * padding), so the pot keeps its size and place and only the plant grows — which
 * is also what lets the page crossfade one stage into the next.
 *
 * Output: streak-stage-<N>-160.webp and -320.webp (width-suffixed, like the other
 * derivatives: /assets/* is cached immutable, so changed art needs a new name).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/** The DollarSeeds app repo. Read-only. */
const APP_REPO = 'C:/DollarSeeds';
const ART = path.join(APP_REPO, 'frontend', 'assets', 'debt-freedom');
const SPECIES = 2;

const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'images', 'streak');
const CANVAS = { width: 1000, height: 1250 };   // layout.json
const RENDER_WIDTH = 800;                         // working resolution
const WIDTHS = [160, 320];
const PAD = 0.04;                                 // of the cropped box, each side

const plant = f => path.join(ART, 'plant-' + SPECIES, f);
const POT = path.join(ART, 'pot-kit', 'empty-pot.svg');
const frame = n => {
  const id = String(n).padStart(2, '0');
  return [plant('frame-' + id + '-back.svg'), POT, plant('frame-' + id + '.svg')];
};

/** Streak stages: 0 | 1–2 | 3–6 | 7–13 | 14–29 | 30+ (see assets/js/seed-rush.js). */
const STAGES = [
  [POT],                    // 0: empty pot
  frame(1),                 // 1: sprout
  frame(3),                 // 2
  frame(6),                 // 3
  frame(9),                 // 4
  [plant('paid-off.svg')]   // 5: full bloom
];

const RENDER_HEIGHT = Math.round(RENDER_WIDTH * CANVAS.height / CANVAS.width);

async function layer(file) {
  return sharp(fs.readFileSync(file), { density: 72 * RENDER_WIDTH / CANVAS.width })
    .resize(RENDER_WIDTH, RENDER_HEIGHT).png().toBuffer();
}

async function compose(files) {
  const layers = await Promise.all(files.map(layer));
  return sharp({ create: { width: RENDER_WIDTH, height: RENDER_HEIGHT, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers.map(input => ({ input }))).png().toBuffer();
}

/** Bounding box of the non-transparent pixels. */
async function bounds(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

async function main() {
  for (const files of STAGES) for (const f of files) {
    if (!fs.existsSync(f)) throw new Error('missing app art: ' + f + ' (APP_REPO = ' + APP_REPO + ')');
  }
  const stages = await Promise.all(STAGES.map(compose));
  const boxes = await Promise.all(stages.map(bounds));

  // One box for all: the union, padded, kept inside the canvas.
  const u = boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const pad = Math.round(Math.max(u.x1 - u.x0, u.y1 - u.y0) * PAD);
  // Square-ish, horizontally centred on the pot (the canvas centre), so every
  // stage sits in the same place on the page.
  const half = Math.max(RENDER_WIDTH / 2 - u.x0, u.x1 - RENDER_WIDTH / 2) + pad;
  const left = Math.max(0, Math.floor(RENDER_WIDTH / 2 - half));
  const width = Math.min(RENDER_WIDTH - left, Math.ceil(half * 2));
  const top = Math.max(0, u.y0 - pad);
  const height = Math.min(RENDER_HEIGHT - top, u.y1 - u.y0 + pad * 2);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (let i = 0; i < stages.length; i++) {
    const cropped = await sharp(stages[i]).extract({ left, top, width, height }).png().toBuffer();
    for (const w of WIDTHS) {
      const file = path.join(OUT_DIR, 'streak-stage-' + i + '-' + w + '.webp');
      await sharp(cropped).resize({ width: w }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(file);
    }
  }
  const ratio = (height / width).toFixed(4);
  console.log('streak art: species ' + SPECIES + ', 6 stages × ' + WIDTHS.join('/') + ' px, crop ' +
    width + '×' + height + ' (height = width × ' + ratio + ') -> ' + path.relative(process.cwd(), OUT_DIR));
}

main().catch(err => { console.error('gen-streak-art: ' + err.message); process.exit(1); });
