# PROMPT 1 — Design & structure revamp (for Fable 5 in Claude Code)

> Paste everything below this line into Claude Code with Fable 5 selected, from inside `C:\DollarSeeds-Landing\dollarseeds-landing`.

---

You are redesigning the DollarSeeds marketing site. The repo is a plain static site deployed on Netlify — no framework, no build step, no bundler. Keep it that way.

**Read these first:** `index.html`, `netlify.toml`, `privacy.html`, `terms-termly.html`, `cookie-policy.html`, `delete-account.html`.

## Critical context

The app **launched on the App Store on August 7, 2026**. The site still says "Coming Soon · iOS" and collects waitlist emails. Every visitor is currently being told the product doesn't exist yet. Fixing that is the point of this work.

- App Store URL: `https://apps.apple.com/us/app/dollarseeds/id6780037284`
- App Store ID: `6780037284`
- Production site: `https://dollarseeds.app` (apex is primary; `www.dollarseeds.app` auto-redirects to it). The old `dollarseeds.netlify.app` still resolves and 301s to the new domain — never link to it.
- iOS only for now. Do not add Google Play badges.
- Current rating: 5.0 from 11 ratings. Do not hardcode these — see "Trust bar" below.

Use **root-relative** internal links (`/about`, `/lessons/tithing`) everywhere, never absolute ones.

## Scope

**In scope:** page structure, section inventory, copy, layout, responsive behavior, semantic HTML, media markup, new pages, internal linking, and the SEO concerns that are inseparable from design (headings, landmarks, alt text, anchor IDs, image/video attributes, content that carries search terms).

**Out of scope — a second pass handles all of this, do not do it:** `robots.txt`, `sitemap.xml`, `llms.txt`, JSON-LD structured data, favicons/manifest, canonical and Open Graph tags, analytics, Netlify headers, font self-hosting, image format conversion, `apple-app-site-association`.

You are, however, responsible for leaving **clean hooks** for that pass: correct heading order, one `<h1>` per page, real landmarks, stable `id` attributes on every section, and FAQ/review markup structured so schema can be attached later without restructuring.

## Hard constraints

1. The Termly resource-blocker `<script>` must remain the **first** script in `<head>` on every page, ahead of the font links. Do not move, defer, or remove it.
2. Do not change the URLs `/privacy`, `/terms`, `/cookie-policy`, `/delete-account`. They are referenced from the live App Store listing. The `/terms` → `terms-termly.html` rewrite in `netlify.toml` stays.
3. No JavaScript frameworks, no animation libraries, no npm dependencies. Vanilla JS only, and as little as possible — the current page has one small form handler and that is the right amount.
4. Keep CSS inline in a `<style>` block per page. It is small enough that this is the fastest option. Factor shared styles into a single `assets/css/base.css` **only if** the duplication across pages exceeds ~200 lines.
5. Preserve the existing brand tokens (the `:root` custom properties in `index.html`). You have latitude on layout, spacing, and composition; you do not have latitude to invent a new palette or type stack.

---

## Homepage — required section order

Build the homepage in exactly this order. Every section gets a stable `id`.

### 1. Nav (`<nav>`)
Logo (fix the current `href="#"` → `/`), in-page anchor links to Features, How It Works, Budgeting Types, Faith, FAQ, and a persistent **Download on the App Store** CTA. Collapse to a mobile menu below 900px. The CTA must remain visible at every breakpoint.

### 2. Hero (`#hero`)
- Kill "Coming Soon · iOS" and both waitlist forms entirely.
- **`<h1>` must contain the search phrase, not just the tagline.** Something in the shape of "Christian Budgeting App for Real Financial Freedom" — the current H1 ("Make Your Dollar Seeds Sprout into Blessings") is a brand line with zero query terms in it. Keep the brand line, but demote it to the subhead or eyebrow.
- One plain-language sentence under the H1 that states what the app does. "Called to be Faithful Stewards" is a tagline, not a description — it cannot be the only descriptive text.
- Primary CTA: official Apple "Download on the App Store" badge linking to the App Store URL above. Use Apple's official badge artwork, not a custom button.
- The phone mockup currently uses `screen-dashboard.png` and is hidden entirely below 900px. Keep a hero visual at mobile — most of your traffic is mobile and hiding the product shot there is a conversion loss.

### 3. Trust bar (`#trust`)
A thin band directly under the hero with exactly these four items:
- Star rating and rating count
- "No bank login required"
- "Free to download"
- "iPhone · iOS"

**Do not display a download count.** The field exists in the data file for later use but must not be rendered — leave it out of the markup entirely, not hidden with CSS.

**Do not hardcode the rating or the count.** Read them from `assets/data/app-stats.json`, a file you create with this shape and these current values:

```json
{
  "rating": 5.0,
  "ratingCount": 11,
  "downloads": 48,
  "updated": "2026-08-19"
}
```

Render it with a tiny inline script that fetches the JSON and fills the spans, with the JSON values also written into the HTML as static fallback text so the bar is correct with JS disabled and never renders empty. The second pass will wire `rating` and `ratingCount` to auto-refresh at build time from Apple's lookup API. Structure the markup so that swap needs no changes.

### 4. Who it's for (`#who-its-for`)
New section. Use this positioning:

> DollarSeeds is for anyone chasing financial freedom — people getting out of debt, people multiplying what they already have, and people aiming at goals bigger than next month's bills. It's also for people who don't want money just to fill their pockets, but to use it in a way that pleases God and blesses the people around them.

Then name what it replaces, as four concrete items: **lack of control · lack of direction · lack of planning · lack of self-knowledge about where the money actually goes** — replaced with financial control.

Write this as real prose plus a short structured list. Don't turn it into four icon cards with two words each; the words are the value here.

### 5. How it works (`#how-it-works`)
Three steps: log your income → your money splits automatically across **Needs / Wants / Savings** → track every category against its target and adjust.

**Use "Needs / Wants / Savings" throughout the site.** The current site and the App Store description say "Goals" for the third bucket. "Savings" is the correct label. Be consistent everywhere.

End this section with a link into Budgeting Types (§7) — the split isn't one-size-fits-all, and that's the hook.

### 6. Features (`#features`)
Six cards. Five are video, two are image:

| Card | Media | Note |
|---|---|---|
| Dashboard | screenshot | Existing `screen-dashboard.png` until replaced |
| Log income | video | `assets/video/log-income.mp4` |
| Log expenses | video | `assets/video/log-expense.mp4` |
| Create a savings goal | video | `assets/video/create-goal.mp4` |
| Create a debt goal | video | `assets/video/create-debt-goal.mp4` — **new feature, not on the site today** |
| Set money aside for a goal | video | `assets/video/fund-goal.mp4` |
| Lessons | screenshot | Video-series screen. Lessons include **Tithing** and **Entrepreneurship** — name them, users are reviewing the app specifically for these |

The video files and the Lessons screenshot **do not exist yet**. Reference the paths above, and create a lightweight placeholder poster image for each so the page renders correctly before the real media lands. Leave a `README.md` in `assets/video/` listing the exact filenames, the target aspect ratio, and the max file size you're designing for.

**Video markup requirements — these are non-negotiable for performance:**
- `<video muted loop playsinline preload="none" poster="...">` — never autoplay-on-load for all six at once.
- Play on hover (desktop) / on tap or on entering viewport (mobile), one at a time. Pause every video that scrolls out of view.
- Explicit `width` and `height` attributes on every `<video>` and `<img>` on the site. There are currently none anywhere, and every image is a layout-shift source.
- Wrap each in `<figure>` with a real `<figcaption>`. The caption is the searchable text.

**Rewrite the card copy.** Current titles are pure metaphor — "Plant where it counts", "Every harvest counts" — and rank for nothing. Each card title must contain the noun a person would search: expense tracker, income tracking, savings goals, debt payoff, budget dashboard. Keep the metaphor in the card body where it belongs.

### 7. Budgeting types (`#budgeting-types`)
**The most important new section on the site.** The app ships three budgeting types and the site currently advertises one. Give each its own sub-section with its own `<h3>`, its own anchor, and a visible percentage split.

The unifying idea, which should be stated once at the top of the section: **every track saves at least 20%.** What changes between them is how much of the rest goes to needs versus wants. That's the line that makes three options feel like one philosophy instead of three unrelated presets.

Include a compact comparison — three columns, Needs/Wants/Savings rows — so a reader can see all three at once before reading any of them in detail.

**a) 50/30/20 — the balanced track.** 50% Needs, 30% Wants, 20% Savings. Keep this section's existing narrative framing; it's already good. Add: who it fits (steady income that comfortably covers needs with room to spare).

**b) Wealth Builder — 30% Needs, 20% Wants, 50% Savings.** For users who earn well above what their needs cost, so they can save aggressively — investing into future income streams and going after bigger goals. Also the right fit for college students living with parents, who carry few fixed needs and can put money into investments that compound. Lead with the 50% savings rate; it's the headline and it's what makes this track feel aspirational.

**c) Firm Foundation — 70% Needs, 10% Wants, 20% Savings.** For users whose needs eat most of their paycheck and whose salary barely covers them. It still targets a 20% savings rate, deliberately, so the user builds enough margin to grow their finances and find income that comfortably covers their costs. It's a transitional track — the explicit goal is to graduate out of it into one of the other two.

Write this one with care. The reader who picks Firm Foundation is the reader under the most financial stress, and the 10% Wants figure will read as austere if it's presented without reason. Frame it as *temporary and purposeful* — the same 20% savings target as everyone else, held on purpose, because that's the margin that gets them out. Never condescending, never "budget tips for the poor."

Frame these as *profiles a person recognizes themselves in*, not as configuration options. The reader should be able to pick theirs in about five seconds.

### 8. Faith & stewardship (`#faith`)
Keep the existing "Why DollarSeeds" narrative and the Proverbs 13:11 pull quote — it's the strongest writing on the site and it's the differentiator. Two changes: move the 50/30/20 pillars out (they now live in §7), and add links into the Lessons content.

This section must work for a non-Christian reader too. It should read as conviction, not as a gate.

### 9. Reviews (`#reviews`)
Five real App Store reviews, all 5 stars. Use this content verbatim:

1. **Excellent** — Cláudio93, Aug 8 — "Great app! DollarSeeds is easy to use, simple to navigate, and very convenient. Everything is well organized, and the app makes the whole experience quick and hassle-free. I've really enjoyed using it and would definitely recommend it to others."
2. **Awesome Features** — XLUC4O, Aug 7 — "The unique features for Tithing and Entrepreneurship lessons are awesome! The app works great for tracking all my income and expenses!"
3. **Nice App** — OlayBrian, Aug 8 — "Pretty nice money management app, clean design and works well, 5/5."
4. **Amazing App!** — gangagratidao, Aug 9 — "Amazing App to control your finances ! I loved it!"
5. **Best budgeting app on the AppStore** — Fofinho203, Aug 8 — "Very helpful and unique app to work with"

Mark each up as a `<blockquote>` with `<cite>` and a `<time datetime="2026-08-08">` element. Render the stars as inline SVG with an accessible label, not as a text character or an image. The second pass attaches `Review` schema to this markup — do not restructure it into a JS-driven carousel.

### 10. Lessons preview (`#lessons`)
Three lesson titles pulled from the app, each linking to its page under `/lessons/`. Lead with Tithing and Entrepreneurship since those are what reviewers call out. This section is the entry point to the site's entire content engine — treat it as navigation, not decoration.

### 11. FAQ (`#faq`)
8–10 questions in a native `<details>`/`<summary>` accordion — no JS. Each `<summary>` is the question phrased the way a person would type it into Google. Each answer opens with a direct one-sentence answer before any elaboration; that first sentence is what AI search engines lift.

Write these covering at minimum: is it free, does it connect to my bank, is it only for Christians, what are the three budgeting types, what's the 50/30/20 rule, can I track debt, is my financial data private, is there an Android version, how do I delete my account.

### 12. Final CTA (`#download`)
App Store badge. Must live inside `<main>` — right now the final CTA sits inside `<footer>` and contains an `<h2>`, which is broken document structure.

### 13. Footer
Logo, section nav, legal links (privacy, terms, cookie policy, delete account, consent preferences), support email, and links to `/about`, `/press`, `/changelog`, `/security`.

---

## Sections to remove from the homepage

- **About the Builder** → move to a new `/about` page, linked from the footer. It's the largest block of body copy on the page and it sits between the product story and the conversion CTA. On `/about`, drop the age/school/tech-stack facts and keep what establishes authority on money specifically: the OneHope frontend/SEO work, the TB Financial Services RPA work on accounting workflows, current dev roles at Treevah and UTS Consult.
- **Account deletion block** → footer link only. Keep the `/delete-account` page exactly as it is. Right now "delete your account" is a full-width section sitting between the product story and the download CTA.

---

## New pages to create

Match the existing legal-page template structure. Each needs one `<h1>`, a `<main>` landmark, and breadcrumb navigation back to home.

| Path | Contents |
|---|---|
| `/about` | The builder story, moved and trimmed |
| `/50-30-20-rule` | Pillar page. Full explanation of the rule, worked example with real numbers, how DollarSeeds implements it, and links to the other two budgeting types |
| `/budgeting-types` | Hub page covering all three in depth, with each type at its own anchor |
| `/lessons` | Index of lesson pages |
| `/lessons/tithing` and `/lessons/entrepreneurship` | Two real lesson pages to establish the pattern. Structure them: question-shaped `<h2>`s, direct answer in the first sentence of each section, `<time>` published date, byline linking to `/about` |
| `/support` | Contact route and common issues. The App Store listing requires a support URL |
| `/security` | Plain-language "how your financial data is handled" — separate from the legal privacy policy. This is the top objection for a finance app |
| `/press` | Media kit: app icon, screenshots, one-line description, boilerplate paragraph, contact. This is what directories and review sites pull from |
| `/changelog` | Release notes, newest first. v1.0 shipped 2026-08-07 |
| `/404.html` | None exists today |

---

## Brand asset

The DollarSeeds badge logo (cartoon coin + money tree, "FINANCIAL GROWTH" banner) is already in the repo at `assets/brand/logo.png`. Use it in the nav, footer, and `/press`. Note it is **greyscale** — if a color treatment is needed against the dark backgrounds, flag it in your summary rather than recoloring it yourself. The existing inline SVG seedling icon can stay as the compact/favicon mark.

---

## Design-adjacent SEO requirements

These are yours, not the second pass's:

- **One `<h1>` per page.** Sequential heading order with no skipped levels.
- **Real landmarks:** `<header>`, `<nav>`, `<main>`, `<footer>`. The homepage has no `<main>` today.
- **No `<em>` inside headings for styling** — `index.html` currently does this in both the features and hero headings. Use a `<span>` with a class.
- **Descriptive alt text on every image.** Current alts are one word ("Dashboard", "Expenses"). Describe what the screen shows and what it's for.
- **Stable, human-readable `id`s** on every section, since they become both jump links and schema anchors.
- **Real internal linking.** The site currently has no internal links except footer legal. Every new page should be reachable from at least two places, and body copy should link between related pages inline.
- **Descriptive `<title>` and `<meta name="description">` on every page**, each unique, each written for a click, with the target phrase in the first 60 characters.

## Deliverable

When you're done, give me:
1. A list of every file created or modified.
2. Every place I need to drop in real media, with the exact expected path and dimensions.
3. Anything you had to guess at, flagged explicitly.
4. Any spot where you think the copy is weak and want my input.

Do not run a build or deploy. I'll review locally first.
