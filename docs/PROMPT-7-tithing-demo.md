# PROMPT 7: Homepage restructure, part 4 (tithing demo, remove "Why DollarSeeds", darker debt steps)

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`. Parts 1–3 (`docs/PROMPT-4-…` to `docs/PROMPT-6-…`) are done on the branch `homepage-restructure-1`.

---

This is part 4 of the DollarSeeds homepage restructure. The page has three slider demos built on the shared `setupDemo` script:
- expenses (`#how-logging-works`);
- goals (`#how-goals-work`);
- debts (`#how-debts-work`).

This part:
- adds a fourth demo for tithing, **above** the expense demo;
- removes the "Why DollarSeeds" section;
- picks up three updated debt demo images.

Do **only** what's listed here.

## Ground rules

- **Git:**
  - Stay on `homepage-restructure-1`. Don't commit to `main`, don't push, don't deploy.
  - Also commit `docs/PROMPT-7-tithing-demo.md`.
- **Keep:**
  - The Termly scripts and the CSP in `netlify.toml`, unchanged.
  - Every section not named below.
  - The look and behavior of the existing demos, except the background order in §3.
- **Copy:** use the text in this prompt exactly as written.
- **Images added by hand.** Don't edit or recompress them; they are the masters.
  - **New, untracked:** six 739 × 1600 screens in `assets/images/tithe-demo/`, `tithing-step-1-home-tithe.jpeg` … `tithing-step-6-tithe-given.jpeg`. The darkened areas and arrows are already drawn into them.
  - **Replaced, showing as modified:**
    - `assets/images/debt-demo/debt-snowball-step-1-empty-garden.jpeg`
    - `debt-snowball-step-5-min-payment-toggle.jpeg`
    - `debt-snowball-step-6-extra-payment.jpeg`

    These now darken everything except the button (step 1) or the pot and payment buttons (steps 5 and 6). Keep their file names. `npm run images` will report them as CHANGED under existing names. That's expected and fine, because these files have never been deployed.

## 1. Remove the "Why DollarSeeds" section

- **Delete from `index.html`:**
  - the section `#faith` ("Why DollarSeeds · Lessons", "The name behind the mission"), including its verse quote and its lessons card;
  - its CSS (`.faith`, `.faith-grid`, `.faith-text`, `.faith-verse` and related, with their media-query rules).
- **The lessons screenshot:**
  - `assets/images/screen-lessons.png` is still linked from `press.html`, so **keep the PNG**.
  - Remove its entry from `scripts/images.config.js`.
  - Delete `assets/images/gen/screen-lessons-*`, after grepping to confirm nothing else uses them.
- Leave the JSON-LD as it is.

## 2. Navigation and footer, on all 16 pages

- **Top navigation:** replace "Faith" (`/#faith`) with "Tithing" (`/#how-tithing-works`) and move it to the front. The order becomes:

  Tithing · Expenses · Goals · Debts · Budgeting Types · FAQ

- **Footer "Product" list:** add "Tithing" (`/#how-tithing-works`) before "Expenses", and remove any `/#faith` link.
- Afterwards, `git grep '#faith'` must return nothing.
- **Check:**
  - the desktop navigation still fits on one line at 1024px and 1440px; adjust the gap as you did in part 3 if needed;
  - the mobile menu lists all six links.

## 3. Add the "Tithing" demo section

Put it directly after the trust bar and **before** `#how-logging-works`:

```html
<section class="logdemo logdemo--tithe" id="how-tithing-works" aria-labelledby="tithedemo-heading">
```

- **Same layout, classes, sizes, script and responsive behavior as the other demos,** set up by the same `setupDemo` with no new script. It starts at step 1 (all the way left).
- **IDs:** `tithedemo-heading`, `tithedemo-steps`, `tithedemo-range`.
- **Slider:** `min="1" max="6"`, with the visually hidden label "Choose a step in setting up your tithe" and `aria-valuetext` of `Step N of 6: <label>`.
- **Backgrounds** should keep alternating with the new section on top:
  - tithing: `var(--ground-1)`, no top border, since it follows the trust bar;
  - expenses: `var(--ground-2)` with the `1px solid var(--line-soft)` top border;
  - goals: `var(--ground-1)` with the top border;
  - debts: `var(--ground-2)` with the top border.

  Then make sure the Budgeting Types section after the debts demo still reads as its own section. If it now has the same background as the debts demo, give it a top border too.

### Intro (left column), exactly

- Eyebrow: `Tithing · Step by Step`
- `<h2 class="section-heading" id="tithedemo-heading">Honor God by putting him first in your <span class="accent">finances</span></h2>`
- `<p>God is pleased when we give our first and best fruit to him. It is a sign of gratitude and respect, and something that DollarSeeds encourages. When activated, 10% of your income will be separated into the tithing container, before performing the needs/wants/goals split.</p>`
- `<p>DollarSeeds is a Christian budgeting app with tithing built in. Your tithe comes off the top of the income you log, following the firstfruits principle of Proverbs 3:9, so your budget is planned on what's left. Want to give more than a tenth? Raise your tithe rate in settings at any time. New to tithing? Read our guide on <a href="/lessons/tithing">what tithing is and how to budget for it</a>.</p>`
- `<p>Slide through the steps to see how your tithe is set aside, adjusted and marked as given.</p>`

Style the link like the site's other inline text links.

### Steps: image, alt text, step label and explanation (use the text exactly)

The image path is `/assets/images/tithe-demo/<file>`.

| Step | File | Alt text | Label | Explanation |
|---|---|---|---|---|
| 1 | `tithing-step-1-home-tithe.jpeg` | DollarSeeds home screen with everything darkened except the tithe card, which shows a $100 tithe on $1,000 of income | Home | In the home page, you see how much your tithe is based on your income. |
| 2 | `tithing-step-2-open-settings.jpeg` | The DollarSeeds home screen with everything darkened except the settings button in the top corner, and an arrow pointing to it | Settings | Tap the settings to look at your tithe settings. |
| 3 | `tithing-step-3-tithe-settings.jpeg` | The Tithing settings in focus: tithing switched on, a 10% tithe rate, and a note that 10% of new income goes into a Tithe envelope before the budget split | Tithe settings | Here you can toggle tithing on or off, and you can change your tithe amount to more than 10% if desired. |
| 4 | `tithing-step-4-tithe-20-percent.jpeg` | The Tithing settings in focus with the tithe rate changed to 20%, so 20% of new income goes into the Tithe envelope first | 20% | A change to 20% means that 20% of your income will be reserved to the tithing envelope before making the needs/wants/goals split. |
| 5 | `tithing-step-5-tithe-toggle.jpeg` | The green top of the home screen in focus with the tithe now $200, and an arrow pointing to the tithe toggle | Mark as given | Back in the home page, the tithing amount is updated. Clicking the toggle will count the tithe as given, and deduct from your total income left for the month. |
| 6 | `tithing-step-6-tithe-given.jpeg` | The green top of the home screen in focus with the tithe toggle switched on and the money left this month lowered from $1,000 to $800 | Given | The tithe toggle now shows green, and your income left for the month is adjusted. |

### Images

- Add one entry to `scripts/images.config.js`: `src: 'assets/images/tithe-demo/*.jpeg'`, widths `[300, 600]`, formats `['avif', 'webp']`, note `tithe demo`.
- The markup is identical to the other demos: a `<picture>` per step with AVIF and WebP (`-300` at 1x, `-600` at 2x), the JPEG as `<img>` with `width="739" height="1600" loading="lazy" decoding="async"`, and the alt text above.
- Eager loading near the viewport, like the others.

## 4. Debt demo: updated alt text

The three replaced debt images now darken part of the screen. Update their alt text in `#how-debts-work` to exactly:

| Step | Alt text |
|---|---|
| 1 | DollarSeeds debts page with everything darkened except the Plant your first debt button, and an arrow pointing to it |
| 5 | The new BofA Credit Card debt in focus as a sprout in a pot, 2% paid, with its Min payment logged toggle and Extra button, and an arrow pointing to the toggle |
| 6 | The BofA Credit Card plant and its payment buttons in focus, with an arrow pointing to the Extra button |

## 5. Build and check

1. Run `npm run images`, then `npm run build`. Commit:
   - the generated `assets/images/gen/tithing-*` files;
   - the regenerated `debt-snowball-step-{1,5,6}-*` files;
   - the deletions from §1.
2. Run `node tools/check-page.js` on `/`, `/lessons/tithing` and `/press`, then `node tools/check-schema.js` and `node tools/check-urls.js`. All must pass, and no request may fail.
3. Check `/` at 1440, 1024, 768 and 390px:
   - all four demos work independently by dragging, keyboard and clicking labels;
   - the backgrounds alternate;
   - the navigation fits on one line on desktop, and "Tithing" scrolls to the new section;
   - the link to `/lessons/tithing` works;
   - nothing scrolls sideways.

   Also check the no-JavaScript view of the tithing demo.
4. Commit on `homepage-restructure-1`.
5. Report:
   - what changed, file by file, including every file deleted;
   - screenshots of the tithing demo at steps 1, 3 and 6, and of debt steps 1 and 5, at desktop and phone widths;
   - anything you couldn't do or had to decide.

## Out of scope (later passes, don't do now)

- Budgeting types content, reviews, FAQ, JSON-LD, the trust bar text, the social card text.
- Benny, Premium pricing.
