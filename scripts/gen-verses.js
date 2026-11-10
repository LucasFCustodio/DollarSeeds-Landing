'use strict';

/**
 * Generate the verse pages from the snapshot (assets/data/seed-rush-verses.json):
 *
 *   verses/index.html          every verse, grouped by category
 *   verses/<slug>.html         one SEO page per verse
 *   seed-rush/study.html       Study mode, with the verses built into the page
 *
 * A verse that leaves the snapshot has its page removed. The snapshot is the
 * only source of verse text: it is printed exactly as stored, never retyped,
 * fetched from anywhere else or "corrected". The same goes for the explanations.
 *
 * Generated files are committed, like the rest of the site.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, url, seedRushVerses } = require('./site.config.js');
const shell = require('./seed-rush-shell.js');

const GENERATOR = 'scripts/gen-verses.js';
const { esc } = shell;
const changed = [];

function out(rel, body) {
  if (shell.writeIfChanged(rel, body)) changed.push(rel);
}

/** Explanation text → paragraphs (blank lines separate them). */
function paragraphs(text, indent) {
  return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => indent + '<p>' + esc(p).replace(/\n/g, '<br />') + '</p>').join('\n');
}

function firstWords(text, n) {
  const words = String(text).split(/\s+/);
  return words.length <= n ? text : words.slice(0, n).join(' ').replace(/[,;:.]+$/, '') + '…';
}

function quote(v, cls) {
  return `<figure class="${cls}">
          <blockquote class="sr-quote-text" cite="${url('/verses/' + v.slug)}">
            <p>${esc(v.text)}</p>
          </blockquote>
          <figcaption class="sr-quote-ref">${esc(v.reference)} <span>NIV</span></figcaption>
        </figure>`;
}

// ── /verses/<slug> ──────────────────────────────────────────────────────────
function versePage(v, all) {
  const related = all.filter(o => o.category === v.category && o.slug !== v.slug).slice(0, 3);
  const trail = [['Home', '/'], ['Verses', '/verses'], [v.reference, '/verses/' + v.slug]];
  const title = v.reference + ': What the Bible Says About ' + shell.topicFor(v.category);
  const description = v.explanation
    ? shell.clip(v.explanation, 155)
    : shell.clip(v.reference + ' (NIV): "' + v.text + '"', 155);

  const relatedHtml = related.length ? `
      <section class="sr-section" aria-labelledby="related-title">
        <h2 id="related-title">More verses on ${esc(v.category)}</h2>
        <ul class="sr-verse-list" role="list">
${related.map(o => `          <li><a href="/verses/${o.slug}"><span class="sr-verse-list-ref">${esc(o.reference)}</span><span class="sr-verse-list-text">${esc(firstWords(o.text, 9))}</span></a></li>`).join('\n')}
        </ul>
      </section>` : '';

  const body = `  <div class="page-header">
    <div class="page-header-blob"></div>
    <div class="page-header-inner">
${shell.breadcrumbNav(trail)}
      <p class="page-eyebrow">${esc(v.category)}</p>
      <h1 class="page-title">${esc(v.reference)}</h1>
    </div>
  </div>

  <div class="page-body">
    <div class="page-inner sr-verse-page">
        ${quote(v, 'sr-quote')}
${v.explanation ? `
      <section class="sr-section sr-explanation" aria-labelledby="teaches-title">
        <h2 id="teaches-title">What this verse teaches about money</h2>
${paragraphs(v.explanation, '        ')}
      </section>` : ''}
${relatedHtml}

      <section class="sr-play-cta" aria-labelledby="play-title">
        <h2 id="play-title">Know it by heart?</h2>
        <p>Seed Rush is a free daily 1-minute game: fill in the missing words of verses like this one.</p>
        <noscript><p class="sr-noscript">The game needs JavaScript to play. This page reads fine without it.</p></noscript>
        <a class="sr-btn sr-btn-primary" href="/seed-rush">Play Seed Rush</a>
      </section>

${shell.appCta()}
    </div>
  </div>`;

  return shell.page({
    generator: GENERATOR,
    title,
    description,
    path: '/verses/' + v.slug,
    ogType: 'article',
    jsonld: { '@context': 'https://schema.org', '@graph': [shell.breadcrumbs(trail)] },
    body,
    bodyClass: 'sr-page'
  });
}

// ── /verses ─────────────────────────────────────────────────────────────────
function indexPage(verses) {
  const trail = [['Home', '/'], ['Verses', '/verses']];
  const groups = shell.groupByCategory(verses).map(([category, list]) => `
      <section class="sr-section sr-verse-group" aria-labelledby="cat-${slugify(category)}">
        <h2 id="cat-${slugify(category)}">${esc(category)}</h2>
        <ul class="sr-verse-list" role="list">
${list.map(v => `          <li><a href="/verses/${v.slug}"><span class="sr-verse-list-ref">${esc(v.reference)}</span><span class="sr-verse-list-text">${esc(firstWords(v.text, 9))}</span></a></li>`).join('\n')}
        </ul>
      </section>`).join('\n');

  const body = `  <div class="page-header">
    <div class="page-header-blob"></div>
    <div class="page-header-inner">
${shell.breadcrumbNav(trail)}
      <p class="page-eyebrow">The verses behind Seed Rush</p>
      <h1 class="page-title">Bible Verses About Money, Work and Stewardship</h1>
      <p class="page-lede">${verses.length} verses on debt, giving, contentment, planning and work, each with a short explanation of what it teaches about money. They are the verses you play in <a href="/seed-rush">Seed Rush</a>.</p>
    </div>
  </div>

  <div class="page-body">
    <div class="page-inner sr-verses-index">
${groups}

      <section class="sr-play-cta" aria-labelledby="play-title">
        <h2 id="play-title">Learn them by playing</h2>
        <p>One minute, a handful of verses, a new round every morning.</p>
        <a class="sr-btn sr-btn-primary" href="/seed-rush">Play Seed Rush</a>
      </section>
    </div>
  </div>`;

  return shell.page({
    generator: GENERATOR,
    title: 'Bible Verses About Money, Work and Stewardship | DollarSeeds',
    description: 'Bible verses about money, debt, giving, contentment, planning and work, grouped by topic, each with a plain-language explanation of what it teaches.',
    path: '/verses',
    jsonld: { '@context': 'https://schema.org', '@graph': [shell.breadcrumbs(trail)] },
    body,
    bodyClass: 'sr-page'
  });
}

// ── /seed-rush/study ────────────────────────────────────────────────────────
function studyPage(verses) {
  const ordered = shell.groupByCategory(verses).flatMap(([, list]) => list);
  const cards = ordered.map((v, i) => `        <article class="sr-card" id="study-${v.slug}" data-sr-card aria-label="Verse ${i + 1} of ${ordered.length}">
          <p class="sr-card-meta"><span class="sr-card-count">${i + 1} / ${ordered.length}</span><span class="sr-card-cat">${esc(v.category)}</span></p>
          <h2 class="sr-card-ref">${esc(v.reference)}</h2>
          <blockquote class="sr-card-text"><p>${esc(v.text)}</p></blockquote>
${v.explanation ? `          <details class="sr-card-explain">
            <summary>Show explanation</summary>
${paragraphs(v.explanation, '            ')}
          </details>` : ''}
          <a class="sr-text-link" href="/verses/${v.slug}">Read the full page</a>
        </article>`).join('\n');

  const body = `  <div class="sr-simple">
    <div class="sr-simple-inner">
      <h1 class="sr-title sr-title-small">Study the verses</h1>
      <p class="sr-tagline">Every verse in Seed Rush, with its explanation. No timer, no score.</p>
    </div>
  </div>

  <div class="sr-study-wrap">
    <div class="sr-study" data-sr-study>
      <div class="sr-study-cards">
${cards}
      </div>
      <div class="sr-study-nav" data-sr-study-nav hidden>
        <button type="button" class="sr-btn sr-btn-secondary" data-sr-prev>&larr; Previous</button>
        <span class="sr-study-pos" data-sr-study-pos aria-live="polite"></span>
        <button type="button" class="sr-btn sr-btn-secondary" data-sr-next>Next &rarr;</button>
      </div>
      <p class="sr-note sr-study-keys" data-sr-study-keys hidden>Tip: use the &larr; and &rarr; keys.</p>
    </div>
    <p class="sr-center"><a class="sr-btn sr-btn-primary" href="/seed-rush/practice">Practice these verses</a></p>
  </div>`;

  return shell.page({
    generator: GENERATOR,
    title: 'Study the verses | Seed Rush | DollarSeeds',
    description: 'Study every Seed Rush verse as a flashcard, with a plain-language explanation of what it teaches about money.',
    path: '/seed-rush/study',
    navCurrent: '/seed-rush',
    noindex: true,
    body,
    bodyClass: 'sr-page sr-calm-page',
    scripts: ['/assets/js/seed-rush-config.js', '/assets/js/seed-rush.js']
  });
}

function slugify(s) {
  return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function removeStale(verses) {
  const keep = new Set(verses.map(v => v.slug + '.html').concat('index.html'));
  const dir = path.join(ROOT, 'verses');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.html') && !keep.has(name)) {
      fs.unlinkSync(path.join(dir, name));
      changed.push('verses/' + name + ' (removed)');
    }
  }
}

function main() {
  const verses = seedRushVerses();
  if (!verses.length) {
    // An empty snapshot would delete every verse page. Refuse rather than ship that.
    throw new Error('assets/data/seed-rush-verses.json is empty or missing; not generating verse pages.');
  }
  for (const v of verses) out('verses/' + v.slug + '.html', versePage(v, verses));
  out('verses/index.html', indexPage(verses));
  out('seed-rush/study.html', studyPage(verses));
  removeStale(verses);
  for (const rel of changed) console.log('  ' + rel);
  console.log('verses: ' + verses.length + ' verse pages' + (changed.length ? ', ' + changed.length + ' file(s) changed' : ', all current'));
}

main();
