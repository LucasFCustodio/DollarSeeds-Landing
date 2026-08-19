'use strict';

/**
 * Tell IndexNow (Bing, Yandex, Seznam, Naver — one endpoint fans out to all of
 * them) that the site changed, so a deploy is discovered in minutes instead of
 * whenever a crawler next wanders past.
 *
 * Google is deliberately not pinged: it does not participate in IndexNow, and
 * the domain is already a verified Search Console Domain property that gets the
 * sitemap. Bing needs no separate verification either — it is verified by
 * importing that same GSC property.
 *
 * Only runs for a production deploy. Netlify sets CONTEXT=production for the
 * live site and something else for deploy previews and branch builds; pinging
 * from a preview would advertise URLs that are not what got published.
 *
 * Never fails the build — an unreachable IndexNow endpoint is not a reason to
 * fail a deploy that is otherwise fine.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, ORIGIN, PAGES, url } = require('./site.config.js');

const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const TIMEOUT_MS = 10000;

/** Same derivation as build/gen-static.js — stable for a given origin. */
function indexNowKey() {
  return crypto.createHash('sha256').update('indexnow:' + ORIGIN).digest('hex').slice(0, 32);
}

async function main() {
  const context = process.env.CONTEXT || 'local';
  const key = indexNowKey();

  const keyFile = path.join(ROOT, key + '.txt');
  if (!fs.existsSync(keyFile)) {
    console.warn('indexnow: key file ' + key + '.txt is missing — run `node build/gen-static.js`. Skipping.');
    return;
  }

  if (context !== 'production') {
    console.log('indexnow: skipped (CONTEXT=' + context + ', only production deploys ping)');
    return;
  }

  const body = {
    host: new URL(ORIGIN).host,
    key: key,
    keyLocation: url('/' + key + '.txt'),
    urlList: PAGES.map(page => url(page.path))
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body)
    });
    // 200 = accepted, 202 = accepted but the key is still being validated.
    if (res.status === 200 || res.status === 202) {
      console.log('indexnow: submitted ' + body.urlList.length + ' URLs (HTTP ' + res.status + ')');
    } else {
      console.warn('indexnow: endpoint returned HTTP ' + res.status + ' — ignored');
    }
  } catch (err) {
    console.warn('indexnow: ping failed (' +
      (err.name === 'AbortError' ? 'timed out' : err.message) + ') — ignored');
  } finally {
    clearTimeout(timer);
  }
}

main().catch(err => {
  console.warn('indexnow: unexpected error (' + err.message + ') — ignored');
  process.exit(0);
});
