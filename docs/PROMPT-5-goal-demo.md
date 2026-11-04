# PROMPT 5: Homepage restructure, part 2 (remove "How It Works", add the goal tracking demo)

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`. Part 1 (`docs/PROMPT-4-homepage-restructure.md`) is already done on the branch `homepage-restructure-1`.

---

This is part 2 of the DollarSeeds homepage restructure. Part 1 added the "How logging works" slider demo (`#how-logging-works`). This part removes the old "How It Works" section and adds a second slider demo for goals that works exactly like the first. Do **only** what's listed here.

## Ground rules

- **Git:**
  - Stay on `homepage-restructure-1`; check it out if needed. Don't commit to `main`, don't push, don't deploy.
  - Also commit `docs/PROMPT-4-homepage-restructure.md` and `docs/PROMPT-5-goal-demo.md`, which are untracked.
- **Keep:**
  - The Termly scripts exactly as they are, and the CSP in `netlify.toml`.
  - Every section not named below.
  - The expense demo's look and behavior. A refactor of its code is fine (see §3) as long as the result looks and behaves exactly as before.
- **Copy:** use the text in this prompt exactly as written.
- **Images already in the repo** (added by hand, untracked). Don't edit or recompress them; they are the masters. There are seven 739 × 1600 screens in `assets/images/goal-demo/`, `goal-tracking-step-1-goals-page.jpeg` … `goal-tracking-step-7-add-extra-payment.jpeg`. The darkened areas and arrows are already drawn into them.

## 1. Remove the "How It Works" section

- **Delete from `index.html`:**
  - the `<!-- HOW IT WORKS -->` section (`#how-it-works`);
  - its CSS (`.how`, `.how-steps` and related);
  - its references in the media queries. Keep `.logdemo` in the shared mobile padding rule.
- **Links to `/#how-it-works`:** every page has one in the top navigation and one in the footer (16 pages), and `lessons/tithing.html` has one in its body text ("log income in DollarSeeds").
  - Repoint **all** of them to `/#how-logging-works`.
  - Keep the label "How It Works" in the navigation and footer.
  - Afterwards, `git grep "how-it-works"` must return nothing.

## 2. Add the "Goal tracking" demo section

Put it directly after `#how-logging-works`, where "How It Works" used to be:

```html
<section class="logdemo logdemo--goals" id="how-goals-work" aria-labelledby="goaldemo-heading">
```

- **Same layout, classes, sizes and responsive behavior as the expense demo:** intro on the left, the 300px phone in the middle, the step explanation on the right, and the slider with step labels underneath. It also starts at step 1 (all the way left).
- **Background:** `var(--ground-2)` with a `1px solid var(--line-soft)` top border, so the two demos read as separate sections. Leave the expense demo's background as it is.

### Intro (left column), exactly

- Eyebrow: `Savings Goals · Step by Step`
- `<h2 class="section-heading" id="goaldemo-heading">Add your long term goals, and save them <span class="accent">month by month</span></h2>`
- `<p>DollarSeeds is a savings goal tracker built into your budget. Set a goal for what matters, like an emergency fund, a new laptop or a trip, pick a target month, and the app works out how much to save each month and shows whether you're on track.</p>`
- `<p>Slide through the steps to watch a $2,000 laptop goal get planted, saved for month by month, and topped up with an extra payment.</p>`

### Steps: image, alt text, step label and explanation (use the text exactly)

The image path is `/assets/images/goal-demo/<file>`.

| Step | File | Alt text | Label | Explanation |
|---|---|---|---|---|
| 1 | `goal-tracking-step-1-goals-page.jpeg` | DollarSeeds goals page with everything darkened except the Plant a new goal button, and an arrow pointing to it | Goals page | In the goals page, you see all your goals and their details. To create a new goal, click the "Plant a new goal" button. |
| 2 | `goal-tracking-step-2-new-goal-form.jpeg` | Empty Plant a new goal form with fields for the goal name, target amount, amount already saved, target month and year, and a switch to add the monthly amount automatically | New goal | To create a new goal, you'll provide information on it. |
| 3 | `goal-tracking-step-3-goal-filled.jpeg` | Plant a new goal form filled in for a New Laptop goal: a $2,000 target, $0 saved, a target of August 2027 that works out to $200 a month, and automatic monthly adding switched on | Fill it in | It will look something like this once it's filled out. |
| 4 | `goal-tracking-step-4-plant-my-goal.jpeg` | An arrow pointing to the Plant my goal button on the filled-in goal form | Plant my goal | Clicking the button will save your goal along with its information, giving you useful details for it. |
| 5 | `goal-tracking-step-5-goal-created.jpeg` | The new New Laptop goal card in focus: on track for August, right on time, saving $200 a month, with $200 of $2,000 saved and $200 added for November | Goal created | With the goal created, you can see useful details to help you accomplish your goal on schedule. |
| 6 | `goal-tracking-step-6-tap-extra.jpeg` | An arrow pointing to the + Extra button on the New Laptop goal card | Tap + Extra | Besides the minimum monthly amount, you can also add extra money to complete the goal faster. |
| 7 | `goal-tracking-step-7-add-extra-payment.jpeg` | Add an extra payment sheet for the New Laptop goal, with an amount field and a choice between this month's budget and money already saved | Extra payment | In this page, you can specify the amount, and whether it's coming from this month's budget or from money you'd already saved. |

- The slider is `min="1" max="7"`.
- It has a visually hidden label, "Choose a step in creating a savings goal", and `aria-valuetext` of `Step N of 7: <label>`.
- There are 7 step labels under it. Under 580px, show only the numbers, as the expense demo does.

### Images

- Add one entry to `scripts/images.config.js`: `src: 'assets/images/goal-demo/*.jpeg'`, widths `[300, 600]`, formats `['avif', 'webp']`, note `goal demo`.
- The markup is the same as the expense demo's: a `<picture>` per step with AVIF and WebP (`-300` at 1x, `-600` at 2x), the JPEG as `<img>`, `width="739" height="1600" loading="lazy" decoding="async"`, and the alt text above.
- All seven are real `<img>` tags in the HTML.
- When the section comes within about 400px of the viewport, switch them to eager loading.

## 3. Make the demo script reusable

- The expense demo's script currently finds its elements by ID and assumes 6 steps. Turn it into one function that sets up **every** `.logdemo` section on the page from its own markup:
  - its own range input;
  - its own number of steps (from the input's `max`, or the number of images);
  - its own images, explanations and step labels.

  Two demos on one page must not affect each other.
- Keep everything part 1 added for each demo:
  - `aria-hidden` on the hidden images;
  - `aria-current="step"` on the active label;
  - `aria-valuetext`;
  - the `--fill` track color;
  - the shared grid cell that keeps captions from jumping;
  - the no-JavaScript fallback (slider hidden, step 1 image, all explanations as a list);
  - reduced-motion behavior;
  - eager loading near the viewport.
- IDs must stay unique. Rename shared IDs if needed, e.g. `logdemo-range` and `goaldemo-range`, and give the explanation lists their own IDs.
- The expense demo must look and behave exactly as before.

## 4. Build and check

1. Run `npm run images`, then `npm run build`. Commit the generated `assets/images/gen/goal-tracking-*` files.
2. Run `node tools/check-page.js` on `/`, `/lessons/tithing` and `/50-30-20-rule`, then `node tools/check-schema.js` and `node tools/check-urls.js`. All must pass.
3. Serve the site and check `/` at 1440, 1024, 768 and 390px:
   - both demos work independently by dragging, keyboard and clicking labels;
   - the 7 step labels fit at every width;
   - nothing scrolls sideways;
   - "How It Works" in the navigation scrolls to the expense demo.

   Also check the no-JavaScript view of both demos.
4. Commit on `homepage-restructure-1`.
5. Report:
   - what changed, file by file;
   - screenshots of the goal demo at step 1 and step 7 at desktop and phone widths;
   - anything you couldn't do or had to decide.

## Out of scope (later passes, don't do now)

- The Features section. Its old 1.1 recordings, including "Savings goals with targets and timelines" and "Set money aside, goal by goal", now overlap the goal demo.
- Budgeting types, faith, reviews, FAQ, JSON-LD, the trust bar text, the social card text.
- The Debt Freedom plant section, Benny, Premium pricing.
