'use strict';

/**
 * Refresh the App Store rating at build time and push it into every place the
 * page shows it.
 *
 * Three copies of the rating exist and all three must agree:
 *   1. assets/data/app-stats.json   — fetched by the trust bar at runtime
 *   2. the trust bar's static fallback text in index.html — what a visitor with
 *      JavaScript disabled (and every crawler) actually sees
 *   3. the aggregateRating in the homepage JSON-LD
 * Google treats rating markup that does not match visible content as a
 * violation, so 2 and 3 are rewritten from the same fetched numbers rather than
 * maintained by hand.
 *
 * FAILURE POLICY: if the fetch fails or returns anything that is not a positive
 * rating, this script warns and exits 0 without writing. A stale rating is
 * fine; a build that fails, or a trust bar reading "0 ratings", is not.
 *
 * `downloads` is preserved untouched — Apple does not publish download counts,
 * so that number is only ever edited by hand.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, APP } = require('./site.config.js');

const STATS_FILE = path.join(ROOT, 'assets', 'data', 'app-stats.json');
const INDEX_FILE = path.join(ROOT, 'index.html');
const TIMEOUT_MS = 10000;

function warn(message) {
  console.warn('app-stats: ' + message + ' — keeping the existing values.');
}

async function fetchRating() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(APP.lookupUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'DollarSeeds-site-build/1.0 (+https://dollarseeds.app)' }
    });
    if (!res.ok) { warn('lookup returned HTTP ' + res.status); return null; }

    const data = await res.json();
    const app = data && Array.isArray(data.results) ? data.results[0] : null;
    if (!app) { warn('lookup returned no results for id ' + APP.appleId); return null; }

    const rating = Number(app.averageUserRating);
    const count = Number(app.userRatingCount);

    // Never write zeros. Apple returns 0/0 for a brand-new or region-missing
    // listing, and "0 ratings" on the trust bar is worse than a stale number.
    if (!Number.isFinite(rating) || rating <= 0) { warn('averageUserRating was ' + app.averageUserRating); return null; }
    if (!Number.isFinite(count) || count <= 0) { warn('userRatingCount was ' + app.userRatingCount); return null; }

    return { rating: Math.round(rating * 10) / 10, ratingCount: Math.round(count) };
  } catch (err) {
    warn(err.name === 'AbortError' ? 'lookup timed out after ' + TIMEOUT_MS + 'ms' : 'lookup failed (' + err.message + ')');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Replace `from` with `to` exactly once, asserting it was there. */
function replaceOnce(html, from, to, label) {
  const i = html.indexOf(from);
  if (i === -1) throw new Error('index.html: cannot find ' + label + ' -> ' + from);
  if (html.indexOf(from, i + 1) !== -1) throw new Error('index.html: ' + label + ' is ambiguous');
  return html.slice(0, i) + to + html.slice(i + from.length);
}

/** Rewrite the visible trust-bar fallback and the JSON-LD aggregateRating. */
function syncIndexHtml(previous, next) {
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const was = html;

  const oldRating = previous.rating.toFixed(1);
  const newRating = next.rating.toFixed(1);

  // 1. Star group's accessible name.
  html = replaceOnce(html,
    'data-stat-label="rating" aria-label="Rated ' + oldRating + ' out of 5 stars"',
    'data-stat-label="rating" aria-label="Rated ' + newRating + ' out of 5 stars"',
    'trust bar aria-label');

  // 2. Visible rating value.
  html = replaceOnce(html,
    '<strong data-stat="rating">' + oldRating + '</strong>',
    '<strong data-stat="rating">' + newRating + '</strong>',
    'trust bar rating');

  // 3. Visible rating count.
  html = replaceOnce(html,
    '<span data-stat="ratingCount">' + previous.ratingCount + '</span>',
    '<span data-stat="ratingCount">' + next.ratingCount + '</span>',
    'trust bar rating count');

  // 4. JSON-LD aggregateRating — the same numbers, so they cannot disagree.
  //    Matched by shape rather than by literal indentation, so re-serialising
  //    the JSON-LD block with different spacing cannot silently break the sync.
  const agg = /("aggregateRating"\s*:\s*\{[\s\S]*?"ratingValue"\s*:\s*")([^"]+)("[\s\S]*?"ratingCount"\s*:\s*")([^"]+)(")/;
  if (!agg.test(html)) throw new Error('index.html: cannot find the JSON-LD aggregateRating block');
  html = html.replace(agg, (_, a, _v, b, _c, d) => a + newRating + b + next.ratingCount + d);

  if (html !== was) fs.writeFileSync(INDEX_FILE, html);
  return html !== was;
}

async function main() {
  const previous = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  const fetched = await fetchRating();
  const today = new Date().toISOString().slice(0, 10);

  if (!fetched) {
    console.log('app-stats: unchanged — ' + previous.rating.toFixed(1) +
      ' from ' + previous.ratingCount + ' ratings (last updated ' + previous.updated + ')');
    return;                                   // exit 0: the build must not fail
  }

  // The trust bar paints five solid stars. If the average ever drops far enough
  // that five solid stars misrepresent it, the markup needs a half-star state —
  // say so loudly rather than shipping a rating the page contradicts.
  if (fetched.rating < 4.75) {
    console.warn('app-stats: rating is ' + fetched.rating.toFixed(1) +
      ' but the trust bar paints five solid stars. Update the star markup in index.html.');
  }

  const changed = fetched.rating !== previous.rating || fetched.ratingCount !== previous.ratingCount;

  const next = {
    rating: fetched.rating,
    ratingCount: fetched.ratingCount,
    downloads: previous.downloads,   // hand-maintained; Apple does not expose this
    updated: today
  };

  // index.html first. If rewriting it throws, the JSON file still holds the old
  // numbers and all three copies stay consistent — the whole point of this
  // script is that they never disagree, including when it fails.
  if (changed) syncIndexHtml(previous, next);
  fs.writeFileSync(STATS_FILE, JSON.stringify(next, null, 2) + '\n');

  if (changed) {
    console.log('app-stats: ' + previous.rating.toFixed(1) + '/' + previous.ratingCount +
      ' -> ' + next.rating.toFixed(1) + '/' + next.ratingCount +
      ' (trust bar + JSON-LD rewritten)');
  } else {
    console.log('app-stats: ' + next.rating.toFixed(1) + ' from ' + next.ratingCount +
      ' ratings — unchanged, timestamp refreshed');
  }
}

main().catch(err => {
  // Anything unexpected still must not take the deploy down.
  warn('unexpected error: ' + err.message);
  process.exit(0);
});
