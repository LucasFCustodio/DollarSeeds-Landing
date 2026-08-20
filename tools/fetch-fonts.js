'use strict';

/**
 * One-off: download the Latin subsets of the three site faces from Google Fonts
 * and drop them in assets/fonts/. Not part of the Netlify build — fonts change
 * roughly never, and the files are committed.
 *
 * CRITICAL: headings use font-weight: 580, which only resolves on a VARIABLE
 * font. We request `wght@a..b` ranges (never discrete weights), and we assert
 * against the downloaded file itself that an `fvar` table is present. A static
 * instance here would silently snap every heading to 600.
 *
 * Google's css2 endpoint already serves per-unicode-range subsets, so the
 * "latin" block IS the Latin subset — no local pyftsubset pass needed, and the
 * variable axis survives because the file is never re-instanced.
 *
 *   node tools/fetch-fonts.js
 */

const fs = require('fs');
const path = require('path');
const { ROOT } = require('../scripts/site.config.js');
const { tableTags } = require('./woff2-tables.js');

// A modern-browser UA is required, or Google serves legacy TTF.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const FACES = [
  { family: 'Urbanist',       axis: 'wght@100..900', out: 'urbanist-latin-var.woff2' },
  { family: 'Figtree',        axis: 'wght@300..900', out: 'figtree-latin-var.woff2' },
  { family: 'JetBrains Mono', axis: 'wght@100..800', out: 'jetbrains-mono-latin-var.woff2' }
];

const OUT_DIR = path.join(ROOT, 'assets', 'fonts');

/** Pull the `latin` @font-face block out of a css2 response. */
function latinBlock(css) {
  return css.split('/*').map(b => '/*' + b).find(b => /^\/\*\s*latin\s*\*\//.test(b));
}

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(res.status + ' ' + res.statusText + ' for ' + url);
  return res;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const face of FACES) {
    const cssUrl = 'https://fonts.googleapis.com/css2?family=' +
      encodeURIComponent(face.family).replace(/%20/g, '+') + ':' + face.axis + '&display=swap';

    const block = latinBlock(await (await get(cssUrl)).text());
    if (!block) throw new Error('no latin subset block for ' + face.family);

    const weight = /font-weight:\s*([^;]+);/.exec(block)[1].trim();
    if (!/^\d+\s+\d+$/.test(weight)) {
      throw new Error(face.family + ': expected a variable weight RANGE, got "' + weight +
        '". A static instance would break font-weight: 580.');
    }

    const src = /url\((https:\/\/[^)]+\.woff2)\)/.exec(block);
    if (!src) throw new Error('no woff2 url for ' + face.family);

    const buf = Buffer.from(await (await get(src[1])).arrayBuffer());

    // The file's own answer, not Google's CSS header: no fvar means a static instance.
    if (!tableTags(buf).includes('fvar')) {
      throw new Error(face.family + ': downloaded woff2 has no fvar table — it is a static ' +
        'instance, which would snap font-weight: 580 to 600.');
    }

    fs.writeFileSync(path.join(OUT_DIR, face.out), buf);

    const ranges = /unicode-range:\s*([^;]+);/.exec(block)[1].trim().split(',').length;
    console.log(face.out.padEnd(32) + String(Math.round(buf.length / 1024) + ' KB').padStart(7) +
      '  wght ' + weight + '  fvar OK  (' + ranges + ' unicode ranges)');
  }

  console.log('\nAll faces variable with the wght axis intact.');
}

main().catch(err => { console.error('fetch-fonts: ' + err.message); process.exit(1); });
