'use strict';

/**
 * Local static server that mirrors production routing closely enough to preview
 * and audit the site: extensionless pretty URLs, directory indexes, the /terms
 * status-200 rewrite, the /download redirect, the 404 page, and the same
 * Cache-Control split described in netlify.toml.
 *
 * Used by tools/gen-og-image.js and by `npm run serve` for Lighthouse runs.
 * It is a dev convenience only — Netlify serves the real thing.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT, APP } = require('../scripts/site.config.js');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm'
};

// Mirrors the [[redirects]] blocks in netlify.toml.
const REWRITES = { '/terms': '/terms-termly.html' };
const REDIRECTS = { '/download': { to: APP.storeUrl, status: 302 } };

/**
 * Parse the [[headers]] blocks out of netlify.toml so local previews carry the
 * same Content-Security-Policy the CDN will send. Without this the CSP can only
 * be tested after deploying, which is exactly when a CSP that breaks the
 * consent banner is most expensive to discover.
 *
 * Deliberately minimal: it understands the `for = "glob"` +
 * `[headers.values] key = "value"` shape this file uses, not TOML in general.
 */
function parseNetlifyHeaders() {
  const toml = path.join(ROOT, 'netlify.toml');
  if (!fs.existsSync(toml)) return [];

  const rules = [];
  let current = null;
  let inValues = false;

  for (const raw of fs.readFileSync(toml, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#') || !line) continue;

    if (line === '[[headers]]') {
      if (current) rules.push(current);
      current = { glob: null, values: {} };
      inValues = false;
      continue;
    }
    if (!current) continue;

    if (line.startsWith('[') && line !== '[headers.values]') {   // a different section
      rules.push(current); current = null; inValues = false; continue;
    }
    if (line === '[headers.values]') { inValues = true; continue; }

    const m = /^([A-Za-z][A-Za-z0-9-]*)\s*=\s*"([\s\S]*)"$/.exec(line);
    if (!m) continue;
    if (m[1] === 'for' && !inValues) current.glob = m[2];
    else if (inValues) current.values[m[1]] = m[2];
  }
  if (current) rules.push(current);
  return rules.filter(r => r.glob);
}

const HEADER_RULES = parseNetlifyHeaders();

/** Netlify header globs: a trailing /* matches any suffix. */
function headersFor(urlPath) {
  const out = {};
  for (const rule of HEADER_RULES) {
    const glob = rule.glob;
    const matches = glob.endsWith('/*')
      ? urlPath.startsWith(glob.slice(0, -1))
      : glob.startsWith('/*.')
        ? urlPath.endsWith(glob.slice(2))
        : urlPath === glob;
    if (matches) Object.assign(out, rule.values);
  }
  return out;
}

function contentType(file) {
  if (path.basename(file) === 'apple-app-site-association') return 'application/json';
  return TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function resolveFile(root, urlPath) {
  const candidates = urlPath.endsWith('/')
    ? [path.join(root, urlPath, 'index.html')]
    : [path.join(root, urlPath), path.join(root, urlPath + '.html'), path.join(root, urlPath, 'index.html')];

  for (const file of candidates) {
    if (!path.resolve(file).startsWith(path.resolve(root))) continue;  // no traversal
    try { if (fs.statSync(file).isFile()) return file; } catch { /* try next */ }
  }
  return null;
}

function handler(root) {
  return (req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);

    const redirect = REDIRECTS[urlPath];
    if (redirect) {
      res.writeHead(redirect.status, { Location: redirect.to });
      return res.end();
    }
    if (REWRITES[urlPath]) urlPath = REWRITES[urlPath];

    const file = resolveFile(root, urlPath);
    if (!file) {
      const notFound = path.join(root, '404.html');
      const body = fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found';
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(body);
    }

    res.writeHead(200, Object.assign(
      { 'Content-Type': contentType(file) },
      headersFor(urlPath)          // the real netlify.toml headers, CSP included
    ));
    res.end(fs.readFileSync(file));
  };
}

/** @returns {Promise<import('http').Server>} listening server */
function startServer(root = ROOT, port = 8080) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler(root));
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startServer };

if (require.main === module) {
  const port = Number(process.argv[2] || 8080);
  startServer(ROOT, port).then(() => {
    console.log('DollarSeeds dev server: http://127.0.0.1:' + port);
    console.log('Ctrl-C to stop.');
  });
}
