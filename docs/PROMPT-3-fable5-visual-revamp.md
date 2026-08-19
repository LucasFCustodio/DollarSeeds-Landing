# PROMPT 3 — Visual revamp & interactive sections (for Fable 5 in Claude Code)

> Run from inside `C:\DollarSeeds-Landing\dollarseeds-landing`. This is a second design pass on top of the structural revamp that already shipped.

---

The DollarSeeds site has the right structure but the wrong feel. It reads as a static document: no movement, no depth, nothing that rewards scrolling. The section separators fight each other — slabs of dark forest green alternating with cream, which works inside the app but reads as harsh banding on a web page. Your job is to make it feel like a considered, modern product site, and to turn two static sections into genuinely interactive ones.

**Read first:** `index.html`, `assets/css/base.css`, `assets/video/README.md`, and skim the sub-pages (`50-30-20-rule.html`, `budgeting-types.html`, `about.html`, `lessons/*.html`) so the new visual language can be carried to them afterward.

## Reference feel — do not copy palettes

- https://captivahq.com/ — the primary reference. Note specifically: cream/warm-grey ground with *tonal* section steps rather than inverted color blocks; alternating media-left / text-right rows; small uppercase mono eyebrows with a `·` separator; large tight-tracked headings; muted body copy; soft rounded cards holding simplified UI illustrations; generous whitespace.
- https://c3poperator.ai/
- https://utsconsult.com/

Take the *rhythm, spacing, restraint, and motion vocabulary*. Take none of the colors — DollarSeeds stays on its own brand tokens.

---

## 1. Global visual direction

### Color — cream everywhere

The current `--cream` / `--forest` / `--dark` alternation is the core problem. Replace it:

- **No section may use `--forest` or `--dark` as a background.** That includes the nav, the hero, and the footer. The whole page sits on cream.
- Build a **tonal ramp** off `#F5F1E6` — roughly four to six steps from near-white warm to a deeper warm greige. Sections are separated by stepping one notch up or down the ramp, never by inverting. Adjacent steps should be *felt*, not announced: the boundary should read as a change in light, not a change in color.
- `--forest` becomes the primary **text** color. `--emerald` stays the accent. `--dark` is reserved for high-contrast type and solid button fills only.
- Keep every existing token in `:root`. Add the ramp as new tokens alongside them; don't redefine the originals.
- Section boundaries can use a hairline rule at very low opacity where a tonal step alone is too subtle — but prefer the tonal step.

**Nav:** light now. Translucent cream with backdrop blur, transparent at scroll-top, gaining a hairline bottom border and a touch more opacity once the user scrolls. Text in forest, CTA in emerald.

**Footer:** the deepest step of the cream ramp, not dark forest.

### Typography rhythm

Adopt the reference pattern: a small uppercase mono eyebrow with a `·` separator (`GROWTH · EVERY DOLLAR`), then a large serif or tight-tracked heading, then muted body copy at comfortable measure (~60–70ch). Existing font stack stays.

### Depth and surface

Rounded cards (16–24px), 1px borders at very low opacity, shadows that are large and extremely soft rather than tight and dark. Nothing should look stamped on; everything should look like it's resting.

### Motion

This is what the site is missing most.

- **Scroll reveals:** fade in + 12–16px rise as elements enter the viewport, via `IntersectionObserver`, triggering **once**. Stagger siblings ~60–80ms.
- **Hover:** cards and buttons lift subtly with an eased transform. Nothing bouncy.
- **Transitions:** 200–400ms, custom cubic-bezier ease-out. No linear timing anywhere.
- **`prefers-reduced-motion: reduce` must disable every scroll reveal, the hero animation loop, and all transform transitions.** Content must be fully visible and legible with motion off — never rely on a reveal to make something appear.
- Vanilla JS only. **No animation libraries, no npm dependencies, no frameworks.**

---

## 2. Hero

### Phone visual

Replace the old phone screenshot with `assets/images/dashboard-screen.jpeg` (739×1600, current UI). Declare explicit `width`/`height`, `fetchpriority="high"`. This is the LCP element — nothing may block it.

**Keep it visible on mobile.** The previous build hid the phone below 900px; most traffic is mobile and hiding the product there is a conversion loss.

### The growth animation

To the **right of the phone screenshot**, build an animated illustration of a seed becoming a fruiting tree:

1. A seed drops into soil.
2. It sprouts — a small seedling breaking the surface.
3. It grows into a tree, ending roughly the height of the phone screenshot.
4. Fully grown, it begins bearing fruit, and the fruit are **coins**.

**Style:** black, white, and grey only. Match `assets/brand/logo.png` — 1930s rubber-hose cartoon: thick confident outlines, rounded organic forms, flat fills with a subtle paper grain, no gradients. Open the logo and match its line weight and character.

**Implementation:** inline SVG animated with CSS and vanilla JS. Not a video, not a GIF, not a canvas library. It must stay crisp at any size and small in bytes.

**Behavior — continuous loop:**
- Full cycle roughly **14–18 seconds**. Slow enough to read as growth, not as a spinner.
- **Hold on the fruiting stage for several seconds** at the end of each cycle — that's the payoff frame and the one people will actually look at.
- Reset with a gentle fade or a wilt-and-reseed, **never a hard cut** back to the seed.
- Pause via `IntersectionObserver` when scrolled out of view.
- With reduced motion, render the fully-grown fruiting tree as a static frame.

The loop must feel like ambient background growth, not a demanding GIF. If in doubt, slow it down.

---

## 3. Budgeting types — replace with a live interactive demo

Currently three text blocks explaining each type with no real numbers. Replace the entire section.

**Heading:** `Three budgeting types. One philosophy.`

**Paragraph, verbatim:**
> Switch between the 3 different budgeting types to see how each of them splits your income into expenses. Every track saves at least 20% of what you earn.

**Below the paragraph:** three buttons, one per budgeting type — `50/30/20`, `Wealth Builder`, `Firm Foundation`.

**Below the buttons:** the live demo.

### The splits

| Type | Needs | Wants | Savings |
|---|---|---|---|
| 50/30/20 | 50% | 30% | 20% |
| Wealth Builder | 30% | 20% | 50% |
| Firm Foundation | 70% | 10% | 20% |

### Demo behavior

- **Income input defaults to $1,000.**
- A **slider** from **$100 to $50,000**, plus a **number field** the user can type into directly. The two stay in sync bidirectionally.
- Below the income control: a subheading naming the currently selected budgeting type.
- Below that, three category rows in this order, top to bottom: **Needs, Wants, Savings.**
- Each row shows the dollar amount available for that category, and its percentage.
- **Changing the budgeting type animates the numbers to their new values** — a tween of roughly 400–500ms, eased. Numbers count, they don't jump. If you use bars or proportional fills, animate those on the same curve.
- **Changing income recalculates live** and animates the same way.

### Demo detail requirements

- Round to whole dollars, and assign any rounding remainder so the three categories **always sum to exactly the income**. Off-by-one cents in a finance demo destroy credibility.
- Use `font-variant-numeric: tabular-nums` on every figure so digits don't shift width mid-tween.
- Reserve the layout height so nothing reflows as values change.
- Visually this should echo the app's UI but **simplified** — show only what's available to spend per category. No "already spent", no progress against actuals. The point is the split.
- **Accessibility:** the three buttons are a `tablist`/radio group, keyboard operable with arrow keys, with the active state exposed via `aria-selected` or `aria-checked`. The slider needs `aria-valuetext` reading the formatted dollar amount. The number input needs `min`, `max`, and sane clamping on blur.
- With reduced motion, values update instantly instead of tweening.

### Layout

Give it real presence — this is the most important section on the page. Match the horizontal rhythm of the rest of the site (same max-width, same gutters) and give it generous vertical breathing room. It should not feel like a narrow widget dropped into a wide page.

---

## 4. Features — five video rows

Replace the current card grid. New layout follows **captivahq.com**: full-width alternating rows, media on one side, text on the other, alternating sides down the page. Stack to single column on mobile with media first.

Each row's text block gets: a mono eyebrow, an `<h3>`, and a description that says **both what the feature does and how you use it.** Current copy only states what it is.

### The videos — mapping and renaming

Five real recordings are already in `assets/video/`. Rename to consistent kebab-case and map as follows:

| Current file | New name | Row content |
|---|---|---|
| `logging-income.mov` | `log-income.mp4` | Logging income and watching it split |
| `logging-expense.mov` *(was loggin-expense.mov before, but the typo was fixed)* | `log-expense.mp4` | Logging an expense with category + subcategory |
| `adding-goal.mov` | `create-goal.mp4` | Creating a savings goal with target and timeline |
| `saving-for-goal.MP4` | `fund-goal.mp4` | Setting money aside toward a goal |
| `saving-for-debt-general-savings.MP4` | `pay-debt.mp4` | Paying off debt using general savings |

**Note the last one changed meaning.** The existing markup has a "Debt payoff goals" card about *creating* a debt goal. The actual video shows *paying off debt from general savings*. Rewrite that row's copy to match what the video shows.

The Dashboard card is now redundant — the dashboard is the hero image. The Lessons card moves into the combined faith section (§5). So: **five rows, all video.**

### Transcoding — required, the current files are unplayable

The source files are **HEVC (H.265), 1170×2532, 60fps, with audio, 7–18 MB each — about 62 MB total.** HEVC does not play in Chrome or Firefox. As-is, these videos are broken for most visitors.

**First, verify ffmpeg exists:**
```
ffmpeg -version
```
If it's missing, stop and tell me to install it (`winget install Gyan.FFmpeg`) rather than trying to work around it.

**Then, per file — H.264 MP4, audio stripped, downscaled, 30fps:**
```
ffmpeg -i "assets/video/SOURCE" -vf "scale=720:-2,fps=30" -c:v libx264 -profile:v main -crf 28 -preset slow -movflags +faststart -an -y "assets/video/NEW.mp4"
```

**WebM alternate for better compression:**
```
ffmpeg -i "assets/video/NEW.mp4" -c:v libvpx-vp9 -crf 36 -b:v 0 -an -y "assets/video/NEW.webm"
```

**Poster frame per video:**
```
ffmpeg -i "assets/video/NEW.mp4" -frames:v 1 -q:v 3 -y "assets/images/posters/NEW.jpg"
```

Then:
- **Target under 2.5 MB per MP4.** If any file exceeds it, raise `-crf` (try 30, then 32) and report the final sizes. Clips longer than ~20s should be trimmed with `-t`.
- **Run `ffprobe` on each output and set the `<video>` `width`/`height` attributes to the exact output dimensions.** Do not assume 720×1560 — `scale=720:-2` rounds height to the nearest even number and a mismatch causes layout shift.
- Delete the original `.mov`/`.MP4` sources once the transcodes are verified playable.
- Report before/after file sizes for all five.

### Video element requirements

- `<video muted loop playsinline preload="none" poster="...">` with `<source>` for WebM then MP4.
- Play when the row scrolls into view; **pause when it leaves.** Only one video plays at a time.
- Explicit `width`/`height` on every element.
- No video may be in the LCP path.
- With reduced motion, show the poster and expose a manual play control instead of autoplaying.

---

## 5. Combine "The name behind the mission" with "Lessons from the field"

Merge them into a single section. The faith narrative and the Proverbs 13:11 pull quote lead; the three lesson links (Tithing, Entrepreneurship, Saving for the Unexpected) close it as the natural "go deeper" step.

Keeping them separate gains nothing for SEO — the ranking value lives on the `/lessons/*` pages themselves, not on having two homepage blocks. **All three links to `/lessons/*` must survive the merge**; they're the site's main internal linking into the content hub.

---

## 6. Carry the language to the sub-pages

Once the homepage is right, apply the same ground, tonal steps, nav, footer, motion, and typography to `50-30-20-rule.html`, `budgeting-types.html`, `about.html`, `support.html`, `security.html`, `press.html`, `changelog.html`, `404.html`, `lessons/*.html`, and the four legal pages. The legal pages get the visual treatment only — **do not touch their content.**

---

## Guardrails — do not break these

1. The Termly resource-blocker `<script>` stays the **first** script in `<head>` on every page.
2. `/privacy`, `/terms`, `/cookie-policy`, `/delete-account` URLs are unchanged — the App Store listing points at them.
3. Preserve heading order (one `<h1>` per page, no skipped levels), landmarks, and every existing section `id`. Structured data will be attached to this markup in a later pass.
4. The trust bar keeps reading `assets/data/app-stats.json` with static HTML fallback. Do not hardcode the rating.
5. All internal links stay root-relative. Production domain is `https://dollarseeds.app`.
6. No frameworks, no animation libraries, no npm dependencies. Vanilla JS and CSS.
7. Shared styles stay in `assets/css/base.css`; page-specific styles stay inline per page.
8. Do not add a download-count figure anywhere.

## Performance

The hero image is the LCP element and must stay fast. The SVG animation, scroll observers, and video controllers must not run layout-thrashing work on scroll — use `IntersectionObserver` and `transform`/`opacity` only, never animate layout properties. Test at 375px, 768px, and 1440px.

## Deliverable

1. Every file created or modified.
2. Before/after byte sizes for all five videos, and their final output dimensions.
3. Anything you guessed at, flagged explicitly.
4. Any place the new visual direction fights the existing content, with your recommendation.

Do not deploy. I'll review locally.
