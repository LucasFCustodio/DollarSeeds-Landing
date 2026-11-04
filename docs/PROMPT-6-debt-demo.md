# PROMPT 6: Homepage restructure, part 3 (remove "What's Inside", add the debt snowball demo)

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`. Parts 1 and 2 (`docs/PROMPT-4-…` and `docs/PROMPT-5-…`) are done on the branch `homepage-restructure-1`.

---

This is part 3 of the DollarSeeds homepage restructure. The page now has two slider demos built on the shared `setupDemo` script:
- expenses (`#how-logging-works`);
- goals (`#how-goals-work`).

This part removes the old "What's Inside" section and adds a third demo for debts, built the same way. Do **only** what's listed here.

## Ground rules

- **Git:**
  - Stay on `homepage-restructure-1`. Don't commit to `main`, don't push, don't deploy.
  - Also commit `docs/PROMPT-6-debt-demo.md`.
- **Keep:**
  - The Termly scripts and the CSP in `netlify.toml`, unchanged.
  - Every section not named below.
  - The look and behavior of the two existing demos.
- **Copy:** use the text in this prompt exactly as written.
- **Images already in the repo** (added by hand, untracked). Don't edit or recompress them; they are the masters. There are eight 739 × 1600 screens in `assets/images/debt-demo/`, `debt-snowball-step-1-empty-garden.jpeg` … `debt-snowball-step-8-mark-paid-off.jpeg`. The arrows are already drawn into them.

## 1. Remove the "What's Inside" section

- **Delete from `index.html`:**
  - the section `#features` ("What's Inside · Real Screens", "Everything you need to grow your finances");
  - its CSS (`.features`, `.feature-row`, `.feature-media`, `.feature-text`, `.feature-screen` and related, including their media-query rules);
  - any script that only served its videos, such as play on hover or scroll.
- **Delete the files only it used,** after grepping to confirm nothing else uses them:
  - `assets/video/*.mp4`, `*.webm` and `assets/video/README.md`;
  - `assets/images/posters/*`;
  - their generated posters in `assets/images/gen/`;
  - the posters entry in `scripts/images.config.js`.

  If `netlify.toml` has a rule that exists only for `/assets/video/`, remove it; otherwise leave `netlify.toml` alone.
- Leave the JSON-LD as it is, including its `featureList`. A later pass rewrites it.

## 2. Navigation and footer, on all 16 pages

The top navigation and the footer's "Product" list have "Features" (`/#features`) and "How It Works" (`/#how-logging-works`). Replace those two links with three, in this order:

| Label | Link |
|---|---|
| Expenses | `/#how-logging-works` |
| Goals | `/#how-goals-work` |
| Debts | `/#how-debts-work` |

- Keep "Budgeting Types", "Faith" and "FAQ" after them as they are.
- The body link in `lessons/tithing.html` stays on `/#how-logging-works`.
- Afterwards, `git grep "#features"` must return nothing.
- **Check the desktop navigation at 1024px and 1440px:**
  - it must stay on one line next to the "Download on the App Store" button;
  - if it doesn't fit at 1024px, reduce the gap between links slightly rather than dropping a link, and say what you changed;
  - the mobile menu must list all six links.

## 3. Add the "Debt snowball" demo section

Put it directly after `#how-goals-work`, where "What's Inside" used to be:

```html
<section class="logdemo logdemo--debts" id="how-debts-work" aria-labelledby="debtdemo-heading">
```

- **Same layout, classes, sizes, script and responsive behavior as the other two demos.** It's set up by the same `setupDemo` function, with no new script, and it starts at step 1 (all the way left).
- **Background:** `var(--ground-1)` with a `1px solid var(--line-soft)` top border, so the three demos alternate.
- **IDs:** `debtdemo-heading`, `debtdemo-steps`, `debtdemo-range`.
- **Slider:** `min="1" max="8"`, with the visually hidden label "Choose a step in paying off a debt" and `aria-valuetext` of `Step N of 8: <label>`.
- **Step labels:** 8 labels under the slider, showing only the numbers under 580px, like the others. Check that 8 labels fit without overlapping at 768px and 1024px; if not, shrink their font slightly, for this demo only.

### Intro (left column), exactly

- Eyebrow: `Debt Snowball · Step by Step`
- `<h2 class="section-heading" id="debtdemo-heading">Add all your debts, and pay them off one by one using the <span class="accent">snowball method</span></h2>`
- `<p>DollarSeeds is a debt payoff tracker built on the debt snowball method. Instead of a snowball, every debt you add becomes a plant in its own pot. You pay the minimum on all of them, put any extra toward the smallest balance first, and each plant grows as its debt shrinks.</p>`
- `<p>When one debt is paid off, its payment waters the next one, so every debt you finish helps you pay off the next one faster. Slide through the steps to watch a $1,500 credit card get planted, paid down and grown into a full plant.</p>`
- `<p class="logdemo-note">Debt Freedom is part of DollarSeeds Premium, which starts with a 1-month free trial.</p>`

  Style `.logdemo-note` as a small muted line (about 0.875rem, `var(--muted)`), below the other paragraphs.

### Steps: image, alt text, step label and explanation (use the text exactly)

The image path is `/assets/images/debt-demo/<file>`.

| Step | File | Alt text | Label | Explanation |
|---|---|---|---|---|
| 1 | `debt-snowball-step-1-empty-garden.jpeg` | DollarSeeds debts page with an empty pot and the message Your garden is empty, and an arrow pointing to the Plant your first debt button | Debts page | In the debts page, you see all your debts and their details. To track a new debt, click the "Plant your first debt" button. |
| 2 | `debt-snowball-step-2-new-debt-form.jpeg` | Empty New debt form with fields for the name, original balance, current balance, minimum payment, interest rate and due day, and a Plant it button | New debt | Fill the page with information about the debt you're trying to pay off. |
| 3 | `debt-snowball-step-3-debt-filled.jpeg` | New debt form filled in for a BofA Credit Card: $1,500 original and current balance, a $35 minimum payment, 10.90% interest, due on the 22nd | Fill it in | It will look something like this once it's filled out. |
| 4 | `debt-snowball-step-4-plant-it.jpeg` | An arrow pointing to the Plant it button on the filled-in New debt form | Plant it | Clicking the button will save your debt along with its information, giving you useful details for it. |
| 5 | `debt-snowball-step-5-min-payment-toggle.jpeg` | The new BofA Credit Card debt as a sprout in a pot, with $1,465 left, free by April 2031 and 2% paid, and an arrow pointing to the Min payment logged toggle | Min payment | With the debt created, you can see useful details to help you pay off your debt as soon as possible. Turn on the min payment toggle each month after you pay the minimum, so you never miss a payment and get charged fees on any of your debts. |
| 6 | `debt-snowball-step-6-extra-payment.jpeg` | An arrow pointing to the Extra button under the BofA Credit Card plant | Extra | You can pay extra money, but only for your current focused debt. With all your efforts going into the smallest debt at the moment, you'll quickly pay off more debts with the snowball effect. |
| 7 | `debt-snowball-step-7-plant-half-grown.jpeg` | The BofA Credit Card plant half grown, with leaves and flower buds, $665 left, free by August 2028 and 55% paid | Growing | As you pay more, the plant will grow, signifying the growth of your finances. |
| 8 | `debt-snowball-step-8-mark-paid-off.jpeg` | The BofA Credit Card plant fully grown and in bloom at 100% paid with $0 left, and an arrow pointing to the Mark as paid off button | Paid off | In the end, you'll get a beautiful, fully grown plant. Clicking the button completes the debt, and any extra money along with that debt's min payment can snowball into the next debt. |

### Images

- Add one entry to `scripts/images.config.js`: `src: 'assets/images/debt-demo/*.jpeg'`, widths `[300, 600]`, formats `['avif', 'webp']`, note `debt demo`.
- The markup is identical to the other demos: a `<picture>` per step with AVIF and WebP (`-300` at 1x, `-600` at 2x), the JPEG as `<img>` with `width="739" height="1600" loading="lazy" decoding="async"`, and the alt text above.
- Eager loading near the viewport, as the others do.

## 4. Build and check

1. Run `npm run images`, then `npm run build`. Commit the generated `assets/images/gen/debt-snowball-*` files and the deletions from §1.
2. Run `node tools/check-page.js` on `/`, `/lessons/tithing` and `/about`, then `node tools/check-schema.js` and `node tools/check-urls.js`. All must pass, and no request may fail, such as a leftover video or poster URL.
3. Check `/` at 1440, 1024, 768 and 390px:
   - all three demos work independently by dragging, keyboard and clicking labels;
   - the step labels fit;
   - the navigation fits on one line on desktop, and each of the three new links scrolls to its demo;
   - nothing scrolls sideways.

   Also check the no-JavaScript view of the debt demo.
4. Commit on `homepage-restructure-1`.
5. Report:
   - what changed, file by file, including every file deleted;
   - screenshots of the debt demo at steps 1, 5 and 8 at desktop and phone widths, and of the desktop navigation at 1024px;
   - anything you couldn't do or had to decide.

## Out of scope (later passes, don't do now)

- Budgeting types, faith, reviews, FAQ, JSON-LD, the trust bar text, the social card text.
- Benny, Premium pricing beyond the one note above.
