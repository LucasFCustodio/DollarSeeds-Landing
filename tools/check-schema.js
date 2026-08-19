'use strict';

/**
 * Audit every page's JSON-LD offline: parse it, resolve the @id references
 * between nodes, and check each node against Google's documented REQUIRED
 * properties for the rich result types this site targets.
 *
 * This is deliberately local. The schema.org validator (the parser behind
 * Google's Rich Results Test) confirms the markup is well formed, but it rate
 * limits, needs network, and does not distinguish "valid" from "eligible for a
 * rich result" — which is the failure that actually costs you the listing.
 *
 *   node tools/check-schema.js            offline audit (default)
 *   node tools/check-schema.js --remote   also POST each page to validator.schema.org
 *
 * Exits non-zero if any page has invalid JSON, an unresolvable @id, or a
 * missing required property.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, ORIGIN } = require('../build/site.config.js');

const ENDPOINT = 'https://validator.schema.org/validate';

/**
 * Deliberate omissions, so the audit stays quiet about choices that are correct.
 * Keyed by page path, then by "Type.property".
 */
const EXEMPT = {
  // /press links out to the App Store for the current rating rather than
  // printing one. Structured data must never state a rating the page does not
  // display, so this SoftwareApplication carries no aggregateRating and gives
  // up its rich-result eligibility on purpose.
  '/press': ['SoftwareApplication.aggregateRating|review']
};

// Google's required properties per rich result type. "a|b" means either will do.
// https://developers.google.com/search/docs/appearance/structured-data
const REQUIRED = {
  SoftwareApplication: ['name', 'offers', 'aggregateRating|review'],
  MobileApplication: ['name', 'offers', 'aggregateRating|review'],
  Article: ['headline', 'datePublished', 'author'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  Question: ['name', 'acceptedAnswer'],
  Answer: ['text'],
  Review: ['author', 'reviewRating'],
  AggregateRating: ['ratingValue', 'ratingCount|reviewCount'],
  Offer: ['price', 'priceCurrency'],
  Person: ['name'],
  // `name` only: Organization also appears as a minimal publisher stub inside
  // each Review ("Apple App Store"), where a url would be noise.
  Organization: ['name'],
  ListItem: ['position', 'name']
};

/** Every JSON-LD block on the page, parsed. */
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(JSON.parse(m[1]));
  return out;
}

/** Walk every typed object in a graph, depth first. */
function walkNodes(value, visit) {
  if (Array.isArray(value)) { value.forEach(v => walkNodes(v, visit)); return; }
  if (!value || typeof value !== 'object') return;
  if (value['@type']) visit(value);
  for (const key of Object.keys(value)) {
    if (key === '@type' || key === '@context') continue;
    walkNodes(value[key], visit);
  }
}

function auditPage(file, pagePath) {
  const exempt = new Set(EXEMPT[pagePath] || []);
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const blocks = jsonLdBlocks(html);
  const problems = [];
  const typeCounts = {};

  if (!blocks.length) return { problems: ['no JSON-LD block'], typeCounts: {} };

  // Collect declared @ids so cross-references can be resolved.
  const declared = new Set();
  for (const block of blocks) {
    walkNodes(block['@graph'] || block, node => { if (node['@id']) declared.add(node['@id']); });
  }

  for (const block of blocks) {
    walkNodes(block['@graph'] || block, node => {
      const types = [].concat(node['@type']);
      for (const type of types) typeCounts[type] = (typeCounts[type] || 0) + 1;

      // A node that is only {"@id": "..."} is a reference; it must point at
      // something this page (or the shared graph) actually declares.
      for (const [key, value] of Object.entries(node)) {
        const refs = [].concat(value).filter(v => v && typeof v === 'object' &&
          v['@id'] && Object.keys(v).length === 1);
        for (const ref of refs) {
          if (!declared.has(ref['@id'])) {
            problems.push(key + ' references ' + ref['@id'] + ', which nothing declares');
          }
        }
      }

      for (const type of types) {
        for (const rule of (REQUIRED[type] || [])) {
          if (exempt.has(type + '.' + rule)) continue;
          if (!rule.split('|').some(k => node[k] !== undefined)) {
            problems.push(type + ' is missing ' + rule.split('|').join(' or '));
          }
        }
      }

      // Absolute URLs only: .app is HSTS-preloaded, and a relative or http://
      // URL in structured data is a silent identity mismatch.
      for (const key of ['url', 'installUrl', 'downloadUrl', 'image', 'logo', 'contentUrl', 'item']) {
        const v = node[key];
        if (typeof v === 'string' && /^https?:\/\//.test(v) && !v.startsWith('https://')) {
          problems.push(key + ' is not https: ' + v);
        }
      }
    });
  }

  return { problems, typeCounts };
}

async function remoteValidate(file) {
  const body = new URLSearchParams();
  body.set('html', fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      body: body
    });
    if (res.ok) {
      const j = JSON.parse((await res.text()).replace(/^\)\]\}'\n?/, ''));
      return { errors: j.totalNumErrors || 0, warnings: j.totalNumWarnings || 0 };
    }
    if (res.status !== 429) return { errors: -1, warnings: -1, note: 'HTTP ' + res.status };
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));   // back off
  }
  return { errors: -1, warnings: -1, note: 'rate limited' };
}

async function main() {
  const remote = process.argv.includes('--remote');
  let bad = 0;

  for (const page of PAGES) {
    const { problems, typeCounts } = auditPage(page.file, page.path);
    const summary = Object.entries(typeCounts)
      .map(([t, n]) => t + (n > 1 ? '×' + n : '')).sort().join(', ');

    let remoteNote = '';
    if (remote) {
      const r = await remoteValidate(page.file);
      remoteNote = r.errors < 0 ? '  [remote: ' + r.note + ']'
        : '  [remote: ' + r.errors + ' errors, ' + r.warnings + ' warnings]';
      if (r.errors > 0) problems.push('schema.org validator reported ' + r.errors + ' errors');
    }

    if (problems.length) bad++;
    console.log((problems.length ? ' FAIL ' : '  OK  ') + page.path.padEnd(26) + summary + remoteNote);
    problems.forEach(p => console.log('        ! ' + p));
  }

  console.log('\n' + (bad ? bad + ' page(s) with problems' : 'All ' + PAGES.length +
    ' pages: valid JSON-LD, resolvable @id graph, required properties present.'));
  process.exitCode = bad ? 1 : 0;
}

main().catch(err => { console.error('check-schema: ' + err.message); process.exit(1); });
