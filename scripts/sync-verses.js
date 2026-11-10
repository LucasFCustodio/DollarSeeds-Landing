'use strict';

/**
 * Refresh the Seed Rush verse snapshot (assets/data/seed-rush-verses.json) from
 * the backend's public list, GET {API}/seed-rush/verses.
 *
 * The snapshot is what scripts/gen-verses.js builds the verse pages and the
 * Study page from, and it is committed, so a build never depends on the
 * backend being up — or deployed at all.
 *
 * FAILURE POLICY (as sync-app-stats.js): a failed fetch, a bad response, or an
 * EMPTY list warns and exits 0 without writing. Writing an empty list would
 * delete every verse page on the next generate; a stale snapshot is fine.
 *
 * Only the five public fields are kept, so nothing else the endpoint might one
 * day return ends up in the site.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, SEED_RUSH } = require('./site.config.js');

const SNAPSHOT = path.join(ROOT, 'assets', 'data', 'seed-rush-verses.json');
const FIELDS = ['slug', 'reference', 'category', 'text', 'explanation'];
// Render's free tier sleeps and a cold start can take most of a minute. Waiting
// that long on every deploy is not worth it: a timeout just keeps the snapshot.
const TIMEOUT_MS = 30000;

function warn(message) {
  console.warn('verses: ' + message + ' — keeping the existing snapshot.');
}

function valid(v) {
  return v && typeof v.slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug) &&
    ['reference', 'category', 'text'].every(k => typeof v[k] === 'string' && v[k].trim()) &&
    (v.explanation == null || typeof v.explanation === 'string');
}

async function fetchVerses() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(SEED_RUSH.api + '/seed-rush/verses', {
      signal: controller.signal,
      headers: { 'User-Agent': 'DollarSeeds-site-build/1.0 (+https://dollarseeds.app)' }
    });
    if (!res.ok) { warn('the API returned HTTP ' + res.status); return null; }
    const data = await res.json();
    const list = data && Array.isArray(data.verses) ? data.verses : null;
    if (!list) { warn('the response had no verse list'); return null; }
    if (!list.length) { warn('the API returned no verses'); return null; }
    const bad = list.find(v => !valid(v));
    if (bad) { warn('a verse is malformed (' + JSON.stringify(bad).slice(0, 80) + ')'); return null; }
    if (new Set(list.map(v => v.slug)).size !== list.length) { warn('duplicate slugs'); return null; }
    return list.map(v => Object.fromEntries(FIELDS.map(k => [k, v[k] == null ? null : v[k]])));
  } catch (err) {
    warn(err.name === 'AbortError' ? 'the API timed out after ' + TIMEOUT_MS / 1000 + ' s'
      : 'the API could not be reached (' + err.message + ')');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  let previous = [];
  try { previous = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')); } catch { /* none yet */ }

  const verses = await fetchVerses();
  if (!verses) {
    console.log('verses: unchanged — ' + previous.length + ' verse(s) in the snapshot');
    return;
  }

  const body = JSON.stringify(verses, null, 2) + '\n';
  if (fs.existsSync(SNAPSHOT) && fs.readFileSync(SNAPSHOT, 'utf8') === body) {
    console.log('verses: ' + verses.length + ' verse(s) — snapshot already current');
    return;
  }
  fs.writeFileSync(SNAPSHOT, body);
  console.log('verses: snapshot updated, ' + previous.length + ' -> ' + verses.length + ' verse(s)');
}

main().catch(err => {
  warn('unexpected error: ' + err.message);
  process.exit(0);
});
