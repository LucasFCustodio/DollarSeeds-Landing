# PROMPT 4: Homepage restructure, part 1 (fonts, no italics, title/meta, hero, logging demo)

Paste everything below the line into Claude Code, run from `C:\DollarSeeds-Landing\dollarseeds-landing`.

---

You're working on the DollarSeeds marketing site (dollarseeds.app). It's static HTML on Netlify with a small Node build (`npm run build` runs `scripts/index.js`). Read `docs/README.md` and `scripts/README.md` first. This is part 1 of a homepage restructure. Do **only** what's listed here.

## Ground rules

- **Git:**
  - Create a branch `homepage-restructure-1` off `main` before changing anything.
  - Don't commit to `main`, don't push, don't deploy.
  - Commit on the branch at the end, with a clear message.
- **Line-ending noise:** `git status` may show `index.html`, `lessons/*.html`, `sitemap.xml` and `assets/data/app-stats.json` as modified even though only CRLF/LF line endings changed.
  - Confirm that with `git diff --ignore-cr-at-eol --stat`, which should be empty.
  - If it is, restore those files (`git restore <files>`) before starting, so the real diff stays readable.
  - Make sure your own edits don't flip line endings on whole files.
- **Keep:**
  - The Termly scripts exactly as they are. The resource-blocker `<script>` must stay the first script in `<head>`.
  - The CSP in `netlify.toml`, untouched.
  - The site's colors, layout system, `data-reveal` animations and every section not named below.
- **Copy:** use the text in this prompt exactly as written. Don't rewrite it.
- **Images already in the repo** (added by hand, untracked). Don't edit or recompress them; they are the masters:
  - `assets/images/home-screen-2026-11.jpeg`: 739 × 1606, the new 1.2.0 home screen for the hero.
  - `assets/images/log-demo/log-expense-step-1-home.jpeg` … `log-expense-step-6-home-updated.jpeg`: six 739 × 1600 screens for the logging demo. The darkened areas and arrows are already drawn into them.

## 1. Fonts: Montserrat for headings, Lato for body

Everything goes through the `--display` (headings) and `--sans` (body) variables in `assets/css/base.css`, so this is mostly a swap.

- **Montserrat** replaces Urbanist for headings.
  - Self-host the **variable** Latin file as `assets/fonts/montserrat-latin-var.woff2`, `font-weight: 100 900`.
  - Headings use `font-weight: 580`. That only works on a variable face, so keep the `fvar` check for this file.
- **Lato** replaces Figtree for body text.
  - Lato has no variable version. Self-host static Latin files `assets/fonts/lato-latin-300.woff2`, `-400`, and `-700`, each with its own `@font-face` and `font-weight`.
  - 500 will render as 400 and 600 as 700. That's expected.
- **JetBrains Mono stays** for the small uppercase eyebrows and labels.
- **`tools/fetch-fonts.js`:**
  - Change `FACES` to Montserrat (`wght@100..900`, variable), Lato 300, 400 and 700 as separate static entries, and JetBrains Mono as now.
  - Add a `static: true` flag that skips the variable-range and `fvar` assertions for the Lato entries.
  - Update the header comment, then run `npm run fonts`.
  - If Google Fonts can't be reached, use the same files from the `@fontsource-variable/montserrat` (`montserrat-latin-wght-normal.woff2`) and `@fontsource/lato` (`lato-latin-{300,400,700}-normal.woff2`) npm packages, and say so.
- **`assets/css/base.css`:**
  - Replace the Urbanist and Figtree `@font-face` blocks.
  - Update the comment above them.
  - Set `--display: 'Montserrat', 'Montserrat Fallback', system-ui, sans-serif;` and `--sans: 'Lato', 'Lato Fallback', system-ui, sans-serif;`.
  - Rename the fallback faces to `Montserrat Fallback` and `Lato Fallback`.
- **Fallback metrics:**
  - Update `FACES` in `tools/gen-font-fallbacks.js` (Montserrat 580, Lato 400) and run it. It needs Chrome; set `CHROME_PATH` if needed.
  - Paste its output into the fallback blocks in `base.css`.
  - For reference, a measurement against Arial gave:
    - Montserrat: `size-adjust 107.41%`, `ascent 90.12%`, `descent 23.37%`;
    - Lato: `98.44%`, `100.27%`, `21.64%`.

    Use the tool's numbers if they differ.
- **Every page:**
  - Change `<link rel="preload" … urbanist-latin-var.woff2>` to `montserrat-latin-var.woff2`, and its comment.
  - `privacy.html`, `terms-termly.html`, `cookie-policy.html` and `delete-account.html` also redefine `--display` and `--sans` inline; update those too.
  - When you're done, `grep -ri "urbanist\|figtree"` should only find history (git) and nothing in the site.
- Delete `assets/fonts/urbanist-latin-var.woff2` and `assets/fonts/figtree-latin-var.woff2`.

## 2. No italic text anywhere on the site

- Change every `font-style: italic` in page `<style>` blocks to `font-style: normal`. They're all in `index.html`: heading accents (`.accent`), the hero tagline, and the faith quote.
- In `base.css`, after the reset, add:
  ```css
  /* No italic type anywhere on the site. Emphasis stays in the markup for
     meaning; color and weight carry it visually. */
  em, i, cite, address, blockquote { font-style: normal; }
  ```
- Keep the `<em>` tags; only their look changes. Keep the `.accent` color.

## 3. Homepage title and meta description

In `index.html`:

- `<title>Christian Budgeting App to Achieve Goals and Get Out of Debt</title>`. This is exactly 60 characters; don't add a brand suffix.
- `<meta name="description" content="Find peace and purpose with your money. DollarSeeds is a Christian budgeting app that helps you pay off debt with the snowball method and grow toward financial freedom." />`
- `og:description` and `twitter:description`: the same text as the meta description.
- `og:title` and `twitter:title`: `DollarSeeds: Christian Budgeting App to Achieve Goals and Get Out of Debt`.
- Leave the JSON-LD alone in this pass. A later pass rewrites it with the new FAQ.

## 4. Hero (section 1)

- **Remove the money-tree illustration completely:**
  - the `.growth` `<div>` and its `<picture>`;
  - the `/* ===== TREE ILLUSTRATION ===== */` CSS;
  - every `.growth` rule in the media queries, including the whole `@media (max-width: 1440px)` block, which only exists for the tree;
  - the `dollarseeds-tree.png` entry in `scripts/images.config.js`.

  Then delete `assets/images/dollarseeds-tree.png` and `assets/images/gen/dollarseeds-tree-*`. Grep first to confirm nothing else uses them.
- **New phone screen:**
  - In `scripts/images.config.js`, replace the `dashboard-screen.jpeg` entry with `assets/images/home-screen-2026-11.jpeg`, widths `[280, 560]`, formats `['avif', 'webp']`, note `hero / LCP`.
  - The phone frame goes from 250px to **280px** on desktop. Keep the 200px and 185px sizes at the smaller breakpoints.
  - Update the hero `<picture>` sources to `home-screen-2026-11-280/-560` (`.avif` and `.webp`).
  - The `<img>`: `src="/assets/images/home-screen-2026-11.jpeg"`, `width="739" height="1606"`, keep `fetchpriority="high"`.
  - Alt text: `DollarSeeds home screen on iPhone showing $588 left this month, an upcoming medical bill to prune, a tithe toggle, and how much is left in the Needs, Wants, and Goals plus debt paydown budgets`.
  - Update the `<link rel="preload" as="image" … imagesrcset>` in `<head>` to the new AVIF files.
  - Then delete `assets/images/dashboard-screen.jpeg` and `assets/images/gen/dashboard-screen-*`, after grepping. **Don't** touch `screen-dashboard.png`, which the JSON-LD uses.
- **Layout:** with the tree gone, center the phone in the visual column: `.hero-visual { justify-content: center; align-items: center; }`.
- **Description:** replace the `.hero-desc` text with exactly:

  > DollarSeeds is a budgeting app built for those who want to steward their finances in the way God wants. Split your budget into needs, wants, and goals; create goals and see them all the way through completion; follow the Snowball Debt Payment plan to become debt free quicker; and watch exclusive video series from Christian entrepreneurs who are serious about work and God.

- **Everything else in the hero stays as it is:** eyebrow, H1, the tagline "Make your dollar seeds sprout into blessings." (now upright, not italic), App Store badge, note.

## 5. Section 2: replace "Who It's For" with a "How logging works" slider demo

Delete the `<!-- WHO IT'S FOR -->` section (`#who-its-for`), all `.who*` CSS, and the `.who` / `.who-grid` references in the media queries. In its place, between the trust bar and "How It Works", add:

```html
<section class="logdemo" id="how-logging-works" aria-labelledby="logdemo-heading">
```

The background is `var(--ground-1)` and the padding matches the old section (`6.5rem 2.5rem 5.5rem`, with the same mobile padding rules).

### Layout

- **Desktop:** a 3-column grid, `minmax(0,1fr) 300px minmax(0,0.8fr)`, gap about 3.5rem, vertically centered. The columns are:
  - **Left: intro text.** It targets expense-tracking searches. Use exactly this:
    - eyebrow: `Expense Tracking · Step by Step`
    - `<h2 class="section-heading" id="logdemo-heading">Log an expense in seconds and see what's <span class="accent">left to spend</span></h2>`
    - `<p>DollarSeeds is an expense tracker built into your budget. Every bill, grocery run or night out goes into Needs, Wants, or Goals, and the app updates how much you have left in that budget for the month the moment you log it.</p>`
    - `<p>Slide through the steps to watch a $165 energy bill get logged as a need, from the home screen to the updated balance.</p>`
  - **Middle: the phone.** Reuse the existing `.phone-frame` and `.phone-notch` at 300px wide (260px under 580px). Inside, a screen box with `aspect-ratio: 739 / 1600; position: relative; overflow: hidden;` holds the six step images stacked (`position: absolute; inset: 0`). Only the active one has `opacity: 1`; they crossfade with `var(--dur) var(--ease-out)`.
  - **Right: the step explanation.** An `<ol aria-live="polite">` with six `<li>`. Each has a small mono label `Step N of 6` in `var(--amber)`, then the explanation in `var(--display)` at about 1.3rem, weight 500.
- **Mobile (≤ 900px):** one column, in this order: intro, phone, explanation (centered, with a min-height so the slider doesn't jump), then the slider.

### Steps: image, alt text and explanation (use the text exactly)

| Step | Image (`/assets/images/log-demo/…`) | Alt text | Explanation |
|---|---|---|---|
| 1 | `log-expense-step-1-home.jpeg` | DollarSeeds home screen with everything darkened except the budget cards: $135 left in Needs, $93 left in Wants and $434 left in Goals plus debt paydown | In the home page, you see how much you have left for each category for the month, and you can log new expenses. |
| 2 | `log-expense-step-2-tap-plus.jpeg` | An arrow pointing to the plus button on the Needs card of the DollarSeeds home screen | To log new expenses, click the + sign. |
| 3 | `log-expense-step-3-needs-page.jpeg` | Empty Log Need form in DollarSeeds with a title field, an amount of $0, sub-category chips such as Rent, Groceries and Utilities, the month and day, and a Plant Need button | This is the needs page. It's where you provide details for your needs expenses. |
| 4 | `log-expense-step-4-needs-filled.jpeg` | Log Need form filled in with the title Energy Bill, an amount of $165, the Utilities sub-category selected and the date November 4 | It will look something like this once it's filled out. |
| 5 | `log-expense-step-5-plant-need.jpeg` | An arrow pointing to the Plant Need button on the filled-in Log Need form | Hitting the button logs the expense, and will automatically update the money available for that category in the home page. |
| 6 | `log-expense-step-6-home-updated.jpeg` | DollarSeeds home screen after logging the energy bill, with focus on the Needs card, which now shows $30 over budget and is outlined in red | Back in the home page, you can see the updated number. If over budget, it will get outlined in red. |

### Images

- Add one entry to `scripts/images.config.js`: `src: 'assets/images/log-demo/*.jpeg'`, widths `[300, 600]`, formats `['avif', 'webp']`, note `logging demo`. The glob form already works there, like the posters entry.
- Each step is a `<picture>` with AVIF and WebP `srcset` (`-300` at 1x, `-600` at 2x) and the JPEG as `<img src>`, with `width="739" height="1600" loading="lazy" decoding="async"` and the alt text above.
- All six are real `<img>` tags in the HTML, not injected by JavaScript.
- When the section comes within about 400px of the viewport, switch the six `<img>` to `loading="eager"` (an IntersectionObserver) so the slider never waits on the network.

### Slider

- Below the three columns, full width, about 3.5rem above: a native `<input type="range" id="logdemo-range" min="1" max="6" step="1" value="1">`. It **starts all the way to the left** (step 1).
  - Give it a visually hidden `<label>`. The site has `.sr-only` in `base.css`; use that class.
  - Set `aria-valuetext` to `Step N of 6: <short label>`.
- **Styling:**
  - an 8px rounded track, emerald up to the thumb and `var(--ground-3)` after it, driven by a `--fill` custom property set from JavaScript;
  - a 26px round thumb (`var(--card)` fill, 3px emerald border, soft shadow), with WebKit and Firefox rules;
  - a visible `:focus-visible` outline.
- **Under the track,** six clickable step labels (`<button type="button">`) spaced evenly; the first is left-aligned and the last right-aligned. Each shows a mono number and a short label:
  - `1 Home`
  - `2 Tap +`
  - `3 Needs page`
  - `4 Fill it in`
  - `5 Plant Need`
  - `6 Updated`

  The active one is bold and colored `var(--ink)`, with its number in `var(--accent-text)`. Under 580px, show only the numbers.
- **Behavior:** dragging the slider, using the arrow keys on it, or clicking a step label shows that step: image, explanation, label state, `--fill` and `aria-valuetext`. No autoplay.
- **Script:**
  - Put the script in the existing inline `<script>` at the end of `index.html`, as its own IIFE. Inline scripts are fine under the current CSP.
  - Give the screen box a `data-step` attribute that the script updates, in case the CSS needs it.

### Without JavaScript and with reduced motion

- **Without JavaScript:** the page still makes sense. The `html.js` class is already set in `<head>`, so:
  - hide the slider unless `.js` is set;
  - show all six explanations as a normal list;
  - show step 1's image.

  With `.js`, only the active explanation shows; it can fade and rise 6px in.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, no crossfade or caption animation; change instantly.

### Cleanup

- Nothing on the site links to `#who-its-for`, but grep to confirm.
- The navigation stays as it is.

## 6. Build and check

1. Run `npm run images`, then `npm run build`. IndexNow is skipped locally, which is expected. Commit the generated files in `assets/images/gen/` as the repo already does.
2. Run `node tools/check-page.js`: no CSP violations, no console errors, no failed requests, Termly still loads. Run `node tools/check-schema.js`.
3. Use `npm run serve` and check the homepage at 1440, 1024, 768 and 390px widths:
   - Montserrat headings, Lato body, no italics anywhere;
   - hero without the tree, phone centered;
   - the demo works by dragging, keyboard and clicking labels;
   - nothing scrolls sideways on a phone.

   Also open `/50-30-20-rule`, `/lessons/tithing` and `/privacy` to confirm the new fonts and no italics there.
4. Commit on `homepage-restructure-1`.
5. Report:
   - what changed, file by file;
   - the font file sizes;
   - the fallback metrics the tool produced;
   - screenshots of the hero and the demo at desktop and phone widths;
   - anything you couldn't do or had to decide.

## Out of scope (later passes, don't do now)

- JSON-LD, FAQ, "How It Works", features, budgeting types, faith, reviews and download sections.
- The trust bar, which still says "No bank login required" and "Free to download".
- The Debt Freedom plant section, Benny, and Premium pricing.
- Other pages' titles. Seed Rush.
