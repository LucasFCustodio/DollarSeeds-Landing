'use strict';

/**
 * Verify routing against the local server: every sitemap URL resolves, the
 * pretty URLs work, nothing indexable is reachable at two URLs, the redirects
 * behave, and unknown paths get a real 404.
 *
 *   node tools/check-urls.js
 *
 * Exits non-zero on any failure.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN, PAGES, APP, url } = require('../scripts/site.config.js');
const { startServer } = require('./serve.js');

const PORT = 8171;
const base = 'http://127.0.0.1:' + PORT;

let failures = 0;

function report(ok, label, detail) {
  if (!ok) failures++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + label.padEnd(46) + (detail || ''));
}

async function head(pathname) {
  const res = await fetch(base + pathname, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), headers: res.headers, res };
}

async function main() {
  const server = await startServer(ROOT, PORT);

  try {
    // ---- 1. every sitemap URL resolves ----
    console.log('\nSitemap URLs (all must be 200):');
    const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

    report(locs.length === PAGES.length, 'sitemap URL count',
      locs.length + ' in sitemap, ' + PAGES.length + ' in site.config.js');

    for (const loc of locs) {
      if (!loc.startsWith(ORIGIN + '/')) { report(false, loc, 'not on the canonical origin'); continue; }
      const pathname = loc.slice(ORIGIN.length);
      const { status } = await head(pathname);
      report(status === 200, pathname, 'HTTP ' + status);
    }

    // ---- 2. sitemap well-formedness ----
    console.log('\nSitemap document:');
    report(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML declaration');
    report(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'sitemap namespace');
    report(!/<loc>[^<]*http:\/\//.test(xml), 'no http:// URLs');
    report(!/<loc>[^<]*www\./.test(xml), 'no www URLs');
    report(!/<loc>[^<]*netlify\.app/.test(xml), 'no netlify.app URLs');
    const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    report(lastmods.length === locs.length && lastmods.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)),
      'every URL has an ISO lastmod');
    report(!locs.includes(url('/404')) && !xml.includes('404'), '404 page is not listed');

    // ---- 3. canonical tags are self-referencing and unique ----
    console.log('\nCanonical tags:');
    const seen = new Map();
    for (const page of PAGES) {
      const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
      const m = /<link rel="canonical" href="([^"]+)"/.exec(html);
      const want = url(page.path);
      report(Boolean(m) && m[1] === want, page.file, m ? m[1] : '(none)');
      if (m) {
        if (seen.has(m[1])) report(false, 'duplicate canonical', m[1] + ' also on ' + seen.get(m[1]));
        seen.set(m[1], page.file);
      }
    }

    // ---- 4. no page reachable at two indexable URLs ----
    console.log('\nDuplicate-URL check:');
    // terms-termly.html is served at /terms AND at its raw path; the canonical
    // on it points at /terms, which is what stops the double index.
    const raw = await head('/terms-termly.html');
    const pretty = await head('/terms');
    report(raw.status === 200 && pretty.status === 200, '/terms and /terms-termly.html both serve');
    const rawHtml = await (await fetch(base + '/terms-termly.html')).text();
    report(rawHtml.includes('<link rel="canonical" href="' + url('/terms') + '"'),
      'raw path canonicalises to /terms');

    for (const page of PAGES) {
      if (page.path === '/' || page.path === '/terms') continue;
      // The .html twin of a pretty URL must carry the same canonical, so it
      // cannot index separately.
      const twin = '/' + page.file.replace(/\.html$/, '') + '.html';
      const r = await head(twin);
      if (r.status !== 200) continue;
      const body = await (await fetch(base + twin)).text();
      report(body.includes('<link rel="canonical" href="' + url(page.path) + '"'),
        twin + ' -> canonical ' + page.path);
    }

    // ---- 5. redirects ----
    console.log('\nRedirects:');
    const dl = await head('/download');
    report(dl.status === 302, '/download is a 302', 'HTTP ' + dl.status);
    report(dl.location === APP.storeUrl, '/download points at the App Store', dl.location || '');

    // ---- 6. 404 ----
    console.log('\n404 handling:');
    const missing = await head('/this-page-does-not-exist');
    report(missing.status === 404, 'unknown path returns 404', 'HTTP ' + missing.status);
    const body404 = await (await fetch(base + '/no-such-page')).text();
    report(body404.includes('This seed didn') || body404.includes('<title>Page Not Found'),
      '404 body is the styled 404 page');
    report(!body404.includes('rel="canonical"'), '404 page carries no canonical');

    // ---- 7. crawler-facing files ----
    console.log('\nCrawler files:');
    for (const [file, needle] of [
      ['/robots.txt', 'Sitemap: ' + url('/sitemap.xml')],
      ['/llms.txt', '# DollarSeeds'],
      ['/sitemap.xml', '<urlset'],
      ['/site.webmanifest', '"start_url"'],
      ['/.well-known/apple-app-site-association', 'applinks'],
      ['/favicon.ico', ''], ['/favicon.svg', ''], ['/apple-touch-icon.png', ''],
      ['/icon-192.png', ''], ['/icon-512.png', ''], ['/assets/images/og-default.png', '']
    ]) {
      const r = await head(file);
      let ok = r.status === 200;
      if (ok && needle) ok = (await (await fetch(base + file)).text()).includes(needle);
      report(ok, file, 'HTTP ' + r.status);
    }

    // ---- 8. no page carries noindex ----
    console.log('\nIndexability:');
    for (const page of PAGES) {
      const html = fs.readFileSync(path.join(ROOT, page.file), 'utf8');
      report(!/noindex/i.test(html), page.path + ' has no noindex');
    }
    const aasa = await head('/.well-known/apple-app-site-association');
    report((aasa.headers.get('content-type') || '').includes('application/json'),
      'AASA Content-Type is application/json', aasa.headers.get('content-type') || '');

    console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'All routing checks passed.'));
    process.exitCode = failures ? 1 : 0;
  } finally {
    server.close();
  }
}

main().catch(err => { console.error('check-urls: ' + err.message); process.exit(1); });
