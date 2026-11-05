'use strict';

/**
 * Shared page shell for every generated Seed Rush and verse page: <head>, the
 * site header, the footer (with the NIV notice), and versioned asset URLs.
 *
 * The header and footer reproduce the hand-written pages' markup exactly, with
 * Seed Rush as the first nav item. scripts/gen-seed-rush.js and
 * scripts/gen-verses.js both build their pages from here, so the two cannot drift.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT, APP, url } = require('./site.config.js');

/** Required, word for word, on every Seed Rush and verse page. */
const NIV_NOTICE = 'Scripture quotations taken from The Holy Bible, New International Version® NIV®. ' +
  'Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc. Used with permission. All rights reserved worldwide.';

/** The order categories appear in (verses index, Study). Unknown ones follow, A–Z. */
const CATEGORY_ORDER = [
  'Finances & Debt', 'Stewardship', 'Growth', 'Responsibility', 'Timeliness',
  'Generosity & Giving', 'Contentment', 'Work & Diligence', 'Planning & Wisdom', 'Trust & Provision'
];

/** Verse page titles: "<Reference>: What the Bible Says About <Topic>". */
const TOPICS = {
  'Finances & Debt': 'Money and Debt',
  'Stewardship': 'Stewardship',
  'Growth': 'Financial Growth',
  'Responsibility': 'Responsibility',
  'Timeliness': 'Timing',
  'Generosity & Giving': 'Giving',
  'Contentment': 'Contentment',
  'Work & Diligence': 'Work',
  'Planning & Wisdom': 'Planning',
  'Trust & Provision': "God's Provision"
};

const topicFor = category => TOPICS[category] || category;

function categoryRank(category) {
  const i = CATEGORY_ORDER.indexOf(category);
  return i === -1 ? CATEGORY_ORDER.length : i;
}

/** Verses grouped by category, in CATEGORY_ORDER, file order within a group. */
function groupByCategory(verses) {
  const groups = new Map();
  for (const v of verses) {
    if (!groups.has(v.category)) groups.set(v.category, []);
    groups.get(v.category).push(v);
  }
  return [...groups.entries()].sort((a, b) =>
    categoryRank(a[0]) - categoryRank(b[0]) || a[0].localeCompare(b[0]));
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Cut at a word boundary to at most `max` characters, ellipsis included. */
function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return (at > 40 ? cut.slice(0, at) : cut).replace(/[\s,;:.—-]+$/, '') + '…';
}

/**
 * `/assets/...` plus `?v=<content hash>`. /assets/* is cached immutable for a
 * year, so a file changed under the same name only reaches returning visitors
 * because this query changes with it.
 */
function asset(rel) {
  const file = path.join(ROOT, rel.replace(/^\//, ''));
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10);
  return rel + '?v=' + hash;
}

const NAV_ITEMS = [
  ['/seed-rush', 'Seed Rush'],
  ['/#how-tithing-works', 'Tithing'],
  ['/#how-logging-works', 'Expenses'],
  ['/#how-goals-work', 'Goals'],
  ['/#how-debts-work', 'Debts'],
  ['/#budgeting-types', 'Budgeting Types'],
  ['/#faq', 'FAQ']
];

function header(current) {
  const items = NAV_ITEMS.map(([href, label]) =>
    '      <li><a href="' + href + '"' + (href === current ? ' aria-current="page"' : '') + '>' + label + '</a></li>'
  ).join('\n');
  return `<header class="site-header">
  <nav class="site-nav" aria-label="Primary">
    <a href="/" class="nav-logo">
      <picture>
        <source type="image/avif" srcset="/assets/images/gen/logo-76.avif 1x, /assets/images/gen/logo-144.avif 2x" />
        <source type="image/webp" srcset="/assets/images/gen/logo-76.webp 1x, /assets/images/gen/logo-144.webp 2x" />
        <img src="/assets/brand/logo.png" alt="DollarSeeds logo: a cartoon coin walking beside a money tree" width="38" height="37" />
      </picture>
      <span class="nav-logo-name">DollarSeeds</span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-menu">
      <span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>
      <span class="sr-only">Menu</span>
    </button>
    <ul class="nav-menu" id="site-menu">
${items}
    </ul>
    <a class="nav-cta" href="${APP.storeUrl}">Download on the App&nbsp;Store</a>
  </nav>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-grid">
      <div class="footer-brand">
        <picture>
          <source type="image/avif" srcset="/assets/images/gen/logo-144.avif 1x, /assets/images/gen/logo-240.avif 2x" />
          <source type="image/webp" srcset="/assets/images/gen/logo-144.webp 1x, /assets/images/gen/logo-240.webp 2x" />
          <img src="/assets/brand/logo.png" alt="DollarSeeds badge logo: a cartoon coin walking beside a money tree over the words Financial Growth" width="72" height="71" loading="lazy" />
        </picture>
        <span class="footer-wordmark">DollarSeeds</span>
        <p>A Christian budgeting app for iPhone. Every dollar is a seed — plant it with purpose.</p>
      </div>
      <nav class="footer-col" aria-label="Product">
        <h2>Product</h2>
        <ul>
          <li><a href="/seed-rush">Seed Rush</a></li>
          <li><a href="/#how-tithing-works">Tithing</a></li>
          <li><a href="/#how-logging-works">Expenses</a></li>
          <li><a href="/#how-goals-work">Goals</a></li>
          <li><a href="/#how-debts-work">Debts</a></li>
          <li><a href="/#budgeting-types">Budgeting Types</a></li>
          <li><a href="/#reviews">Reviews</a></li>
          <li><a href="/#faq">FAQ</a></li>
          <li><a href="/changelog">Changelog</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="Learn">
        <h2>Learn</h2>
        <ul>
          <li><a href="/50-30-20-rule">The 50/30/20 Rule</a></li>
          <li><a href="/budgeting-types">Budgeting Types Guide</a></li>
          <li><a href="/lessons">Lessons</a></li>
          <li><a href="/lessons/tithing">Tithing</a></li>
          <li><a href="/lessons/entrepreneurship">Entrepreneurship</a></li>
        </ul>
      </nav>
      <nav class="footer-col" aria-label="Company and legal">
        <h2>Company</h2>
        <ul>
          <li><a href="/about">About the Builder</a></li>
          <li><a href="/press">Press Kit</a></li>
          <li><a href="/support">Support</a></li>
          <li><a href="/security">Security</a></li>
          <li><a href="mailto:${APP.email}">Email Us</a></li>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
          <li><a href="/cookie-policy">Cookie Policy</a></li>
          <li><a href="/delete-account">Delete Account</a></li>
          <li><a href="#" class="termly-display-preferences">Consent Preferences</a></li>
        </ul>
      </nav>
    </div>
    <p class="sr-niv">${esc(NIV_NOTICE)}</p>
    <div class="footer-bottom">
      <a class="appstore-badge" href="${APP.storeUrl}">
        <img src="/assets/images/app-store-badge.svg" alt="Download DollarSeeds on the App Store" width="150" height="50" style="width:150px;height:50px;" loading="lazy" />
      </a>
      <p class="footer-copy">&copy; 2026 DollarSeeds LLC &middot; Built with faith &amp; purpose</p>
    </div>
  </div>
</footer>`;
}

/**
 * A complete page.
 *   title, description, path   — required
 *   ogTitle, ogType            — Open Graph (defaults: title, "website")
 *   noindex                    — robots noindex (the app-like Seed Rush pages)
 *   jsonld                     — an object, serialised into one JSON-LD block
 *   body                       — the <main> contents
 *   scripts                    — extra /assets paths to load after site.js
 *   bodyClass                  — class on <body>
 */
function page(o) {
  const canonical = url(o.path);
  const ogTitle = o.ogTitle || o.title;
  const image = url('/assets/images/og-default.png');
  const imageAlt = 'DollarSeeds — the Christian budgeting app for real financial freedom, shown on an iPhone';
  const scripts = ['/assets/js/site.js'].concat(o.scripts || []).map(src =>
    '<script src="' + (src === '/assets/js/site.js' ? src : asset(src)) + '"></script>').join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- Termly consent banner + Auto Blocker.
       Must stay the FIRST script tag on the page, and ahead of the font/resource
       link tags below so Auto Blocker can gate them before they load. -->
  <script src="https://app.termly.io/resource-blocker/7c89c6bf-1b30-4ac5-801a-a17454fe74f6?autoBlock=on"></script>
  <script>document.documentElement.classList.add('js');</script>

  <!-- Generated by ${o.generator}. Do not edit by hand. -->
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}" />
${o.noindex ? '  <meta name="robots" content="noindex" />\n' : ''}
  <!-- === head: canonical, social, icons === -->
  <link rel="canonical" href="${canonical}" />

  <link rel="preload" href="/assets/fonts/montserrat-latin-var.woff2" as="font" type="font/woff2" crossorigin />

  <link rel="icon" href="/favicon.ico" sizes="32x32" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#FAF7EE" />
  <meta name="apple-itunes-app" content="app-id=${APP.appleId}" />

  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(o.description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="DollarSeeds" />
  <meta property="og:type" content="${o.ogType || 'website'}" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="${imageAlt}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(o.description)}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${imageAlt}" />

  <link rel="stylesheet" href="/assets/css/base.css" />
  <link rel="stylesheet" href="${asset('/assets/css/seed-rush.css')}" />
${o.jsonld ? `
  <script type="application/ld+json">
${JSON.stringify(o.jsonld, null, 2).replace(/^/gm, '  ')}
  </script>
` : ''}</head>
<body${o.bodyClass ? ' class="' + o.bodyClass + '"' : ''}>

${header(o.navCurrent)}

<main>
${o.body}
</main>

${footer()}

${scripts}
</body>
</html>
`;
}

/** Breadcrumb JSON-LD from [[name, path], ...]. */
function breadcrumbs(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, p], i) => ({
      '@type': 'ListItem', position: i + 1, name, item: url(p)
    }))
  };
}

/** The visible breadcrumb, matching the lessons pages. */
function breadcrumbNav(trail) {
  const items = trail.map(([name, p], i) => i === trail.length - 1
    ? '          <li aria-current="page">' + esc(name) + '</li>'
    : '          <li><a href="' + p + '">' + esc(name) + '</a></li>').join('\n');
  return `      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>
${items}
        </ol>
      </nav>`;
}

/** The calm app call to action, as on the lessons pages. */
function appCta() {
  return `      <section class="sr-app-cta" aria-labelledby="app-cta-title">
        <h2 id="app-cta-title">Get DollarSeeds</h2>
        <p>DollarSeeds helps you budget, save and get out of debt, with the same Scripture-rooted approach. Free on the App Store.</p>
        <a class="appstore-badge" href="${APP.storeUrl}">
          <img src="/assets/images/app-store-badge.svg" alt="Download DollarSeeds on the App Store" width="180" height="60" loading="lazy" />
        </a>
      </section>`;
}

/** Write a file only when its bytes change. Returns true when it did. */
function writeIfChanged(rel, body) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === body) return false;
  fs.writeFileSync(file, body);
  return true;
}

module.exports = {
  NIV_NOTICE, CATEGORY_ORDER, TOPICS, topicFor, groupByCategory, esc, clip, asset,
  header, footer, page, breadcrumbs, breadcrumbNav, appCta, writeIfChanged
};
