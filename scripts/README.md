# Build pipeline

The site is still plain static HTML — no framework, no bundler, no templating.
This directory holds a small Node build step that keeps the things a human
should not have to maintain by hand in sync: image derivatives, the sitemap,
`robots.txt`, and the App Store rating.

Netlify runs `npm run build` (see `netlify.toml`), which is `node scripts/index.js`.

## Why this directory is not called `build`

It was, and Netlify deploys failed with `Cannot find module
'/opt/build/repo/build'`: the directory never arrived on the build machine even
though it was committed and pushed. `build` is the conventional name for
*generated output*, and the deploy pipeline treats a top-level `build/` as
something it owns rather than source to upload.

Two rules follow from that, and both matter:

- **Keep source directories out of names that mean "output"** — `build`, `dist`,
  `out`. This is source, so it lives in `scripts/`.
- **Name the entry file, never the directory.** `node scripts/index.js`, not
  `node scripts`. Node resolves a bare directory to its `index.js` happily, but
  when the directory is missing it reports `Cannot find module '<repo>/scripts'`,
  which reads like a broken script path rather than an absent directory. Naming
  the file makes the failure say what actually went wrong.

## The one constant

`scripts/site.config.js` holds the production origin, the App Store identifiers,
and the page list. **Nothing else in `scripts/` or `tools/` hard-codes the
origin** — import `ORIGIN` or `url()` from there.

The literal `https://dollarseeds.app` does appear in the HTML (canonical tags,
`og:url`, JSON-LD `@id`s), because those are static attributes in static files.
`tools/check-urls.js` verifies every one of them matches `site.config.js`, so
the two cannot drift silently.

## Build steps, in order

| Step | Script | Fatal on failure? |
|---|---|---|
| 1 | `gen-images.js` — AVIF/WebP/poster derivatives | yes |
| 2 | `gen-static.js` — `robots.txt`, `llms.txt`, AASA, IndexNow key | yes |
| 3 | `sync-app-stats.js` — live App Store rating | **no** |
| 4 | `gen-sitemap.js` — `sitemap.xml` + lesson `dateModified` | yes |
| 5 | `ping-indexnow.js` — announce the deploy | **no** |

Steps 3 and 5 are the only ones that touch the network, and both are written to
degrade quietly: a failed fetch logs a warning, changes nothing, and exits 0.
A deploy must never fail — or worse, publish zeros — because Apple's lookup
endpoint had a bad minute.

Step 1 is idempotent: a derivative is only rebuilt when its source is newer, so
a normal deploy rebuilds nothing.

## The rating appears in three places

`assets/data/app-stats.json`, the trust bar's static fallback text in
`index.html`, and the `aggregateRating` in the homepage JSON-LD.

`sync-app-stats.js` writes all three from one fetch, and writes `index.html`
*before* the JSON file, so a failure leaves all three consistent rather than
half-updated. Google treats rating markup that disagrees with visible content as
a violation, so this is the invariant worth protecting.

`downloads` is never touched by the build — Apple does not publish download
counts, so that number only changes when a human edits it.

## One-off generators (`tools/`)

These are **not** part of the Netlify build. Their outputs are committed; rerun
them by hand when the input changes.

| Command | What it does |
|---|---|
| `npm run fonts` | Download the three variable WOFF2 faces from Google Fonts |
| `npm run icons` | Favicon set, app icons, `site.webmanifest` |
| `npm run og` | Render the 1200×630 Open Graph card in headless Chrome |
| `node tools/gen-font-fallbacks.js` | Recompute the metric-matched fallback `@font-face` rules |

### Fonts: the 580 trap

Headings use `font-weight: 580`. That only resolves on a **variable** font — a
static instance silently snaps every heading to 600. `tools/fetch-fonts.js`
therefore requests weight *ranges*, and asserts that the downloaded WOFF2
contains an `fvar` table before writing it (`tools/woff2-tables.js` reads the
table directory without decompressing). Do not replace these files by hand.

The metric-matched fallback faces in `assets/css/base.css` are not decoration:
without them the webfont swap re-wraps the nav and costs ~0.1 CLS on mobile.
Regenerate them with `gen-font-fallbacks.js` if a face ever changes.

## Checks

| Command | What it verifies |
|---|---|
| `node tools/check-urls.js` | Sitemap URLs resolve, canonicals are self-referencing and unique, redirects, 404, crawler files |
| `node tools/check-schema.js` | JSON-LD parses, `@id` references resolve, Google's required properties present (`--remote` also posts to validator.schema.org) |
| `node tools/check-page.js [path]` | Loads the page in real Chrome with the real `netlify.toml` headers: CSP violations, console errors, failed requests, rendered font weight. `--no-js` for the no-JavaScript pass |
| `npm run serve` | Local preview with production routing and headers |

`check-page.js` is the one that matters most after touching the CSP: it proves
the Termly consent banner still loads. A CSP that blocks Termly breaks cookie
compliance.

## Caching caveat

Image derivatives are named by width (`logo-144.avif`), not by content hash, and
`/assets/*` is served `immutable` for a year. **Replacing a source image in place
therefore needs a filename bump**, or returning visitors keep the old bytes.
`gen-images.js` prints a `CHANGED` warning when a derivative's content moves
under an existing name, so this cannot happen unnoticed.
