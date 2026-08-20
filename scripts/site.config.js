'use strict';

/**
 * Single source of truth for everything the build scripts need to know about
 * the site. Nothing else in build/ or tools/ may hard-code the origin, the
 * App Store URL, or the page list — import from here instead.
 *
 * The apex is the canonical host. `www.` and the legacy `dollarseeds.netlify.app`
 * 301 to it (see netlify.toml). `.app` is an HSTS-preloaded TLD, so every URL
 * this file produces is https:// by construction — `origin()` throws otherwise.
 */

const path = require('path');

const ORIGIN = 'https://dollarseeds.app';

if (!ORIGIN.startsWith('https://') || ORIGIN.endsWith('/')) {
  throw new Error('ORIGIN must be an https:// origin with no trailing slash: ' + ORIGIN);
}

/** Repo root, regardless of the cwd the script was invoked from. */
const ROOT = path.resolve(__dirname, '..');

/** Absolute URL for a site-root-relative path. */
function url(pathname) {
  if (!pathname.startsWith('/')) throw new Error('pathname must start with "/": ' + pathname);
  return pathname === '/' ? ORIGIN + '/' : ORIGIN + pathname;
}

const APP = {
  name: 'DollarSeeds',
  appleId: '6780037284',
  bundleId: 'com.lucasfcustodio.dollarseeds',
  appleTeamId: 'YBSBHHBC5R',
  storeUrl: 'https://apps.apple.com/us/app/dollarseeds/id6780037284',
  lookupUrl: 'https://itunes.apple.com/lookup?id=6780037284&country=us',
  datePublished: '2026-08-07',
  operatingSystem: 'iOS 15.1',
  categories: ['Finance', 'Education'],
  author: 'Lucas Custodio',
  email: 'lucasquality555@gmail.com'
};

/**
 * Every indexable page, in sitemap order.
 *
 * `file`  — path on disk, relative to ROOT (drives <lastmod>)
 * `path`  — the canonical URL path (extensionless; this is what ships)
 * `blurb` — one-line description, used by llms.txt
 *
 * 404.html is deliberately absent: it is served with a 404 status and must
 * never appear in the sitemap.
 */
const PAGES = [
  { file: 'index.html',                     path: '/',                        blurb: 'Home — what DollarSeeds is, how the automatic income split works, feature walkthroughs, reviews, and FAQ.' },
  { file: '50-30-20-rule.html',             path: '/50-30-20-rule',           blurb: 'The 50/30/20 budget rule explained from scratch, with a worked example on a $3,200 monthly income.' },
  { file: 'budgeting-types.html',           path: '/budgeting-types',         blurb: 'The three budgeting types DollarSeeds ships — 50/30/20, Wealth Builder, and Firm Foundation — compared side by side.' },
  { file: 'lessons/index.html',             path: '/lessons',                 blurb: 'Scripture-rooted money lessons: what is available to read here and what ships inside the app.' },
  { file: 'lessons/tithing.html',           path: '/lessons/tithing',         blurb: 'Lesson — what the tithe is, where it comes from in the Bible, and how to budget the first tenth without guilt.' },
  { file: 'lessons/entrepreneurship.html',  path: '/lessons/entrepreneurship', blurb: 'Lesson — entrepreneurship as stewardship: the parable of the talents, risk, work, and funding the first step.' },
  { file: 'about.html',                     path: '/about',                   blurb: 'About Lucas Custodio, the developer who builds DollarSeeds, and why the app exists.' },
  { file: 'security.html',                  path: '/security',                blurb: 'How DollarSeeds handles financial data in plain language: no bank logins, no selling data, one-tap deletion.' },
  { file: 'changelog.html',                 path: '/changelog',               blurb: 'Release notes for the DollarSeeds iPhone app.' },
  { file: 'press.html',                     path: '/press',                   blurb: 'Press kit — boilerplate, key facts, logo and screenshot downloads, press contact.' },
  { file: 'support.html',                   path: '/support',                 blurb: 'Support — contact email, common issues, bug reports, and feature requests.' },
  { file: 'delete-account.html',            path: '/delete-account',          blurb: 'How to delete a DollarSeeds account and every record attached to it.' },
  { file: 'privacy.html',                   path: '/privacy',                 blurb: 'Privacy policy.' },
  { file: 'terms-termly.html',              path: '/terms',                   blurb: 'Terms of service.' },
  { file: 'cookie-policy.html',             path: '/cookie-policy',           blurb: 'Cookie policy and consent preferences.' }
];

/** Files that carry a canonical URL but must never be indexed or listed. */
const NON_INDEXED = ['404.html'];

module.exports = { ORIGIN, ROOT, url, APP, PAGES, NON_INDEXED };
