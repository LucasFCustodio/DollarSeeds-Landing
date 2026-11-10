'use strict';

/**
 * Content-hash versions for the CSS and JS the pages link: `/assets/x.css?v=<hash>`.
 *
 * Why: netlify.toml serves /assets/* as `public, max-age=31536000, immutable`, so
 * a file changed under the same URL never reaches a returning visitor. The query
 * changes whenever the bytes do, which makes it a new URL.
 *
 * The one place this logic lives. Used by:
 *   scripts/seed-rush-shell.js      — generated Seed Rush and verse pages
 *   scripts/gen-asset-versions.js   — rewrites every HTML file in the build
 *
 * Images are not here: their derivatives are versioned by filename (see
 * scripts/images.config.js).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT } = require('./site.config.js');

/** Every CSS/JS file under /assets that a page links. */
const VERSIONED_ASSETS = [
  '/assets/css/base.css',
  '/assets/js/site.js',
  '/assets/css/seed-rush.css',
  '/assets/js/seed-rush.js',
  '/assets/js/seed-rush-config.js',
  '/assets/js/vendor/supabase.js'
];

const HASH_LENGTH = 10;
const memo = new Map();   // file -> {key: mtime+size, hash}

/** The first HASH_LENGTH hex characters of the file's SHA-256. */
function assetHash(rel) {
  const file = path.join(ROOT, rel.replace(/^\//, ''));
  const st = fs.statSync(file);
  const key = st.mtimeMs + ':' + st.size;
  const hit = memo.get(file);
  if (hit && hit.key === key) return hit.hash;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, HASH_LENGTH);
  memo.set(file, { key, hash });
  return hash;
}

/** `/assets/...` plus its current `?v=<hash>`. */
function asset(rel) {
  return rel + '?v=' + assetHash(rel);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Point every href/src of a VERSIONED_ASSETS file at its current version,
 * whether the link had no version yet or an older one. Nothing else in the
 * HTML is touched.
 */
function versionHtml(html) {
  let out = html;
  for (const rel of VERSIONED_ASSETS) {
    const re = new RegExp('((?:href|src)=")' + escapeRe(rel) + '(?:\\?v=[0-9a-f]+)?(")', 'g');
    if (re.test(out)) out = out.replace(re, (_, a, b) => a + asset(rel) + b);
  }
  return out;
}

module.exports = { VERSIONED_ASSETS, assetHash, asset, versionHtml };
