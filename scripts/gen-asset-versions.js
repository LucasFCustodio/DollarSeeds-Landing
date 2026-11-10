'use strict';

/**
 * Rewrite every page's links to base.css, site.js and the other linked CSS/JS
 * under /assets with their current content hash (`?v=<hash>`), so a changed file
 * reaches returning visitors despite the year-long immutable cache on /assets/*.
 *
 * Runs after the generators, so it covers hand-written pages, generated pages
 * and templates alike. Only the href/src values of the files listed in
 * scripts/asset-version.js change; a file is rewritten only when one of them
 * moved, so a second build with no changes leaves the tree untouched.
 */

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./site.config.js');
const { versionHtml, VERSIONED_ASSETS, assetHash } = require('./asset-version.js');

const SKIP_DIRS = new Set(['node_modules', '.git', '.netlify']);

function htmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) htmlFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.html')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function main() {
  const files = htmlFiles(ROOT);
  let changed = 0;
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const next = versionHtml(html);
    if (next !== html) {
      fs.writeFileSync(file, next);
      changed++;
      console.log('  ' + path.relative(ROOT, file).replace(/\\/g, '/'));
    }
  }
  for (const rel of VERSIONED_ASSETS) console.log('  ' + rel.padEnd(36) + '?v=' + assetHash(rel));
  console.log('asset versions: ' + files.length + ' HTML files checked, ' + changed + ' updated');
}

main();
