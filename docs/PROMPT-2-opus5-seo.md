# PROMPT 2 — Technical SEO & performance pass (for Opus 5 in Claude Code)

> Run this **only after** the Fable 5 redesign is merged and you've reviewed it. Paste everything below the line into Claude Code with Opus 5 selected, from inside `C:\DollarSeeds-Landing\dollarseeds-landing`.

---

You are doing the technical SEO and performance pass on the DollarSeeds marketing site. A design pass just landed: the homepage was restructured, new pages were added, and the site now correctly reflects that the app is live. Your job is everything the design pass deliberately left alone.

**Read the whole repo first**, including `netlify.toml` and every HTML page, so your changes apply consistently across all of them. Do not restructure layout, rewrite copy, or change section order — if you believe something structural is wrong, flag it in your summary instead of changing it.

## Facts you need

- Production domain: `https://dollarseeds.app` — **apex is the primary domain.** Every canonical tag, `og:url`, sitemap entry, and absolute URL uses the apex, never `www`.
- `www.dollarseeds.app` and the legacy `dollarseeds.netlify.app` both redirect to the apex, handled by Netlify. Verify both are **301** (permanent), not 302 — a 302 does not consolidate link equity. Fix in `netlify.toml` if Netlify's default isn't a 301.
- Put the origin in exactly one constant that every build script reads. Do not scatter the literal string across files.
- `.app` is an HSTS-preloaded TLD — the entire TLD is HTTPS-only at the browser level. Confirm Netlify's "Force HTTPS" is on and that nothing in the repo emits an `http://` URL, including inside JSON-LD.
- App Store URL: `https://apps.apple.com/us/app/dollarseeds/id6780037284`
- App Store ID: `6780037284`
- Apple Team ID: `{{APPLE_TEAM_ID}}` — needed for universal links. Stop and ask if unfilled.
- Bundle ID: `{{BUNDLE_ID}}` — same.
- App released 2026-08-07. iOS only. Free. Categories: Finance, Education.
- Author/publisher: Lucas Custodio.
- Static site on Netlify. No framework, no bundler. Adding a small Node build step is acceptable; adding a framework is not.

## Explicitly out of scope

Do **not** write any code related to prompting users for in-app reviews. That's app-side work being handled separately. Nothing in this task should touch the iOS project.

---

## A. Site-wide files to create

**`robots.txt`**
- Allow all standard crawlers.
- Explicitly `Allow` the AI crawlers: `GPTBot`, `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`.
- `Sitemap:` directive pointing at the absolute sitemap URL.

**`sitemap.xml`**
- Every indexable page including the legal pages. Accurate `<lastmod>` per page.
- Generate it from the filesystem with a Node script rather than hand-writing it, so it stays correct as pages are added. Wire the script into the Netlify build command.

**`llms.txt`** at the site root — plain text: what DollarSeeds is in two sentences, the three budgeting types, the key page URLs with one-line descriptions each, and the App Store link. Follow the llms.txt convention.

**Favicon and icon set** — generate from `assets/brand/logo.png` and the existing inline seedling SVG: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`, and `site.webmanifest`. The logo is greyscale; use the brand emerald from the CSS custom properties for the small marks where a flat greyscale icon would be illegible.

**`_headers`** or an equivalent `netlify.toml` block — the current `netlify.toml` sets no headers at all:
- `Cache-Control: public, max-age=31536000, immutable` on `/assets/*`
- `Cache-Control: public, max-age=0, must-revalidate` on HTML
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
- A Content-Security-Policy that permits Termly (`app.termly.io`), the App Store lookup if called client-side, and self-hosted assets. **Test this against the live consent banner before you commit it** — a CSP that breaks Termly breaks compliance.

**`apple-app-site-association`** — served from `/.well-known/`, no file extension, `Content-Type: application/json`. Populate `applinks` with the team ID and bundle ID above so search results and shared links deep-link into the installed app. The app-side entitlement will need to declare `applinks:dollarseeds.app` — note that in your summary so it gets into the next app build.

---

## B. `<head>` — apply to every page

Currently missing sitewide. Each page needs its own values, not copies.

- `<link rel="canonical">` — absolute URL, self-referencing.
- Open Graph: `og:title`, `og:description`, `og:url`, `og:site_name`, `og:type`, `og:locale`, and `og:image` at 1200×630. **Design and generate the OG image** from the brand logo and app screenshots — right now every share of the URL renders as a bare link.
- `twitter:card` = `summary_large_image`, plus title, description, image.
- `<meta name="theme-color">` matched to the nav background, with a `prefers-color-scheme` variant if the design uses one.
- `<meta name="apple-itunes-app" content="app-id=6780037284">` — the Smart App Banner. Free installs off mobile brand search, one line of HTML.
- On `terms-termly.html`, canonical to `/terms`. It's served at `/terms` via a status-200 rewrite but is still reachable at its raw path, so it can index twice.
- Keep the Termly resource-blocker as the first script in `<head>` on every page.

---

## C. Structured data (JSON-LD)

None exists today. Add as JSON-LD in `<head>`, not microdata. Validate everything against Google's Rich Results Test before you report done.

| Schema | Page | Notes |
|---|---|---|
| `MobileApplication` | home | `applicationCategory: FinanceApplication`, `operatingSystem: iOS`, `offers` with `price: "0"`, `installUrl` + `downloadUrl` = App Store URL, `datePublished: 2026-08-07`, `softwareVersion`, `aggregateRating` |
| `AggregateRating` | home | **Must be driven by the same data source as the visible trust bar** — see section D. Never mark up a rating the page doesn't display. |
| `Review` ×5 | home | Attach to the existing review blockquote markup. `author` = the App Store reviewer handle, `datePublished` from the `<time>` element, `reviewRating` 5. Do not invent or edit review text. |
| `Organization` | home | Name, logo, URL, `sameAs` including the App Store URL, contact point |
| `WebSite` | home | Name, URL, publisher |
| `FAQPage` | home `#faq` and `/50-30-20-rule` | Must mirror the visible `<details>` content exactly |
| `Article` | each `/lessons/*` | `headline`, `datePublished`, `dateModified`, `author` → the `Person` entity |
| `Person` | `/about` | The author entity every lesson's `author` points at. This is the E-E-A-T anchor and it matters disproportionately for financial content. |
| `BreadcrumbList` | every sub-page | |
| `SoftwareApplication` | `/press` | |

---

## D. Live App Store stats at build time

The design pass created `assets/data/app-stats.json` with hardcoded values. Automate the ratings half.

Write a Node script that runs as part of the Netlify build:
1. Fetch `https://itunes.apple.com/lookup?id=6780037284&country=us`.
2. Read `averageUserRating` and `userRatingCount`.
3. Merge them into `assets/data/app-stats.json`, **preserving the manually-maintained `downloads` field** — Apple does not expose download counts publicly, so that value only ever changes when I edit it by hand.
4. On fetch failure, log a warning and leave the existing file untouched. **The build must not fail and must never write zeros** — a trust bar reading "0 ratings" is worse than a stale one.
5. Update `updated` to the build date.

Then make the JSON-LD `aggregateRating` read from the same file at build time so the schema and the visible trust bar can never disagree. Google penalizes rating markup that doesn't match visible content.

Add a `netlify.toml` build command that runs this script and the sitemap generator in sequence.

---

## E. Performance / Core Web Vitals

Current state before the redesign: five PNGs at 300–430KB, no width/height attributes anywhere, three Google Font families loading render-blocking, and a synchronous third-party script ahead of everything.

1. **Self-host the fonts.** Instrument Serif, Inter, JetBrains Mono are all loaded from Google Fonts as a render-blocking stylesheet, behind Termly's auto-blocker. Download WOFF2, subset to Latin, serve from `assets/fonts/`, `font-display: swap`, and `<link rel="preload">` only the face used in the `<h1>`. Drop the `fonts.googleapis.com` / `fonts.gstatic.com` preconnects once nothing loads from them.

2. **Re-evaluate the Termly auto-blocker.** It is the first synchronous script in `<head>` and deliberately gates the font requests, which puts a render-blocking third party directly in front of the LCP element. Once fonts are self-hosted, the only remaining third parties are Termly itself and whatever analytics gets added. Determine whether `autoBlock=on` is still doing necessary work; if it isn't, move the script to `defer`. **Do not remove the consent banner** — if you're not confident the compliance behavior is preserved, leave it exactly as-is and say so.

3. **Image pipeline.** Convert every raster asset to AVIF with WebP fallback and original as last resort, via `<picture>`. Generate 1× and 2× `srcset` variants. Every `<img>` gets explicit `width` and `height`. Lazy-load everything below the fold; the hero image gets `fetchpriority="high"` and a `<link rel="preload">`. Add the conversion step to the build script so new assets are processed automatically.

4. **Video.** The features section uses six short MP4s. Verify: `preload="none"`, poster images on all of them, explicit dimensions, `playsinline muted loop`, and that no video is in the LCP path. If any file exceeds ~2MB, re-encode it (H.264 baseline + a WebM/VP9 alternate) and report the before/after sizes. Videos must never block first paint.

5. **CSS.** Inline `<style>` blocks are correct at this size — keep them. Do not externalize CSS in the name of "best practice"; it would cost a round trip on the critical path.

6. **INP.** The only JS should be the video playback controller and small progressive-enhancement handlers. Audit for anything doing layout work on scroll or resize without throttling.

Report Lighthouse mobile scores before and after, all four categories.

---

## F. Routing and redirects

- **`/download`** — a single URL that redirects to the App Store, so every off-site link points at one measurable destination. Netlify redirect, 302.
- Verify all pretty URLs resolve without extension and that no page is reachable at two URLs.
- **`/404.html`** wired up in `netlify.toml`.
- **Host canonicalization.** Confirm all three of these resolve to a single indexable URL: `www.dollarseeds.app` → apex, `dollarseeds.netlify.app` → apex, and `http://` → `https://`. All must be 301. Grep the repo for `netlify.app` and remove every remaining reference.
- **Legacy URL check.** The App Store listing points at `/terms` and `/privacy`. Those paths must keep working on the new domain — the `netlify.toml` status-200 rewrite for `/terms` stays exactly as it is.

---

## G. Indexing

- **Do not add a Google Search Console verification meta tag.** The domain is already verified as a GSC **Domain property** via a DNS TXT record, which covers every subdomain and both protocols. A meta tag would be redundant.
- **Bing Webmaster Tools** is verified by importing the GSC property, so no Bing meta tag either. If you find one in the repo, remove it.
- Add an **IndexNow** key file at the site root and a build-step ping so Bing and Yandex learn about changes on deploy.
- Confirm no page carries `noindex`, and that the legal pages remain indexable (they're trust signals).

## H. Verification before you report done

1. Rich Results Test on the homepage, `/50-30-20-rule`, and one lesson page.
2. Lighthouse mobile on the homepage — report LCP, CLS, and INP.
3. Confirm the Termly banner still appears and still gates what it gated before your CSP change.
4. Confirm the trust bar renders correctly with JavaScript disabled.
5. Confirm the build script degrades safely: run it with the network unavailable and show that `app-stats.json` survives intact.
6. Validate `sitemap.xml` and confirm every URL in it returns 200.

## Deliverable

1. Every file created or modified, grouped by the section above it belongs to.
2. Before/after Lighthouse numbers.
3. Every placeholder value I still need to supply, with its exact file and line.
4. Anything you chose not to do, and why.

Do not deploy. I'll review and push myself.
