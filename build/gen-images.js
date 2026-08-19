'use strict';

/**
 * Generate responsive AVIF / WebP (and resized JPEG poster) derivatives for
 * every raster asset the site renders, driven by build/images.config.js.
 *
 * Runs as part of the Netlify build, but it is a no-op on an unchanged tree:
 * a derivative is only rebuilt when its source is newer. That keeps deploys
 * fast while still processing any asset that gets added or replaced.
 *
 * Sources are never touched. Output goes to assets/images/gen/.
 *
 *   npm run images          rebuild what is stale
 *   npm run images -- --force   rebuild everything
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { ROOT } = require('./site.config.js');
const CONFIG = require('./images.config.js');

const OUT_DIR = path.join(ROOT, 'assets', 'images', 'gen');
const FORCE = process.argv.includes('--force');

// Quality settings. AVIF is far more aggressive than WebP at the same visual
// quality; these are the values that survived side-by-side comparison on the
// phone screenshots, which are the hardest content here (flat UI + gradients).
const ENCODE = {
  avif: img => img.avif({ quality: 55, effort: 6, chromaSubsampling: '4:2:0' }),
  webp: img => img.webp({ quality: 76, effort: 6 }),
  jpeg: img => img.jpeg({ quality: 76, mozjpeg: true, progressive: true })
};

const EXT = { avif: '.avif', webp: '.webp', jpeg: '.jpg' };

function expand(pattern) {
  if (!pattern.includes('*')) return [pattern];
  const dir = path.posix.dirname(pattern);
  const rx = new RegExp('^' + path.posix.basename(pattern).replace(/\./g, '\.').replace(/\*/g, '.*') + '$');
  return fs.readdirSync(path.join(ROOT, dir)).filter(f => rx.test(f)).sort().map(f => dir + '/' + f);
}

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12); }

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let built = 0, skipped = 0, changed = 0, bytesOut = 0;
  const rows = [];

  for (const entry of CONFIG) {
    for (const rel of expand(entry.src)) {
      const srcPath = path.join(ROOT, rel);
      const srcStat = fs.statSync(srcPath);
      const meta = await sharp(srcPath).metadata();
      const stem = path.basename(rel, path.extname(rel));

      for (const width of entry.widths) {
        if (width > meta.width) continue;               // never upscale

        for (const format of entry.formats) {
          const outName = stem + '-' + width + EXT[format];
          const outPath = path.join(OUT_DIR, outName);

          if (!FORCE && fs.existsSync(outPath) && fs.statSync(outPath).mtimeMs >= srcStat.mtimeMs) {
            skipped++;
            bytesOut += fs.statSync(outPath).size;
            continue;
          }

          const before = fs.existsSync(outPath) ? sha(fs.readFileSync(outPath)) : null;
          const buf = await ENCODE[format](
            sharp(srcPath).resize(width, null, { withoutEnlargement: true })
          ).toBuffer();
          fs.writeFileSync(outPath, buf);

          built++;
          bytesOut += buf.length;
          if (before && before !== sha(buf)) {
            changed++;
            console.warn('  CHANGED  assets/images/gen/' + outName +
              ' — /assets/* is cached immutable; bump the filename or returning ' +
              'visitors keep the old bytes.');
          }
          rows.push([rel, outName, srcStat.size, buf.length]);
        }
      }
    }
  }

  for (const [rel, out, srcBytes, outBytes] of rows) {
    const kb = n => (Math.round(n / 102.4) / 10 + ' KB').padStart(9);
    console.log('  ' + out.padEnd(34) + kb(outBytes) + '   from ' + rel + ' (' + kb(srcBytes).trim() + ')');
  }

  console.log('images: ' + built + ' built, ' + skipped + ' up to date, ' +
    Math.round(bytesOut / 1024) + ' KB of derivatives' +
    (changed ? ', ' + changed + ' CHANGED under an existing name' : ''));
}

main().catch(err => { console.error('gen-images: ' + err.message); process.exit(1); });
