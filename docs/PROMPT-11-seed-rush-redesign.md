# PROMPT 11: Seed Rush redesign (fewer elements, one clear Play, a growing streak)

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`. The Seed Rush site is on the branch `seed-rush-site`; read `docs/PROMPT-9-seed-rush-site.md` and `docs/PROMPT-10-cache-versioning.md` for what's already built.

---

Seed Rush works well and is fun, but the pages show too much at once. There are three green buttons, mode cards, a countdown, status, the leaderboard and a lot of text, so a new visitor doesn't know what to do. Redesign the screens around one clear action, the way Wordle does it:
- one short line;
- one obvious **Play** button;
- two quiet secondary options;
- instructions only when they're needed.

**Change the presentation, not the game.** Rules, scoring, the clock, the backend calls, the guest/claim logic, error handling and the verse pages all stay as they are. Keep the site's look: cream grounds, forest/emerald, Montserrat/Lato, JetBrains Mono for small labels, no italics. Keep the Termly scripts and the NIV notice on every Seed Rush page.

## Ground rules

- **Git:** stay on `seed-rush-site`. Don't commit to `main`, don't push, don't deploy.
- **No backend changes.** The backend repo (`C:\DollarSeeds`) is read-only; you may read its art files (§4).
- **Don't commit** `docs/seed-rush-verses.pdf` or any Excel lock file.
- **Also commit** `docs/PROMPT-11-seed-rush-redesign.md`.
- **One filled emerald button per screen.** Everything else is an outline or text-style button.

## 1. One page for the game: `/seed-rush`

- **The daily game now runs on `/seed-rush` itself,** like Wordle: the landing state, the pre-run screen, the game and the end screen are states of the same page.
  - `/seed-rush/daily` becomes a 301 redirect to `/seed-rush` in `netlify.toml`.
  - Remove the generated daily page, and update every internal link to it.
- **`/seed-rush/practice`** stays its own page, with the same states, but `kind = practice`.
- **`/seed-rush/study`** and **`/seed-rush/verify`** stay. Restyle them to match the calmer look where it's natural, with no content changes.

### Game toolbar (all states, both game pages)

A slim bar at the top of the game area, under the site header:
- **Left:** "Seed Rush" (Montserrat, small).
- **Right:** three icon buttons with accessible labels and tooltips:
  - **?**: How to play;
  - **trophy**: Leaderboard;
  - **person**: Account.

  When signed in, show a small dot on the person icon if the email isn't verified yet.
- **During a run,** hide the three icons so they can't be tapped by accident. The timer becomes the focus.
- Each icon opens a modal `<dialog>`: Esc closes it, focus is trapped while open and returns to the icon afterwards, and on phones it's a full-width sheet.
  - **How to play:** the same content as §2.
  - **Leaderboard:** everything the old inline leaderboard had: Today/Yesterday, top 10 with Show all up to 100, your own row pinned and highlighted, rank, username, mode and score.
  - **Account:**
    - signed out: sign in / create account, Google, the Apple "coming soon" note and the password note;
    - signed in: username, streak, the verification line with the send button, and Sign out;
    - the username step after sign-up stays.

### Landing state (today's daily not played yet)

Centered, generous white space, everything in the first screen on a phone. Top to bottom:
1. **The mark:** the streak plant (§4) at its current stage, about 96px, or the empty pot for new players.
2. **H1:** `Seed Rush`.
3. **One line:** `Fill in the verse. 60 seconds. Once a day.`
4. **Buttons in one row,** wrapping on small phones, in this visual order like Wordle:
   - signed out: **Practice** (outline), **Log in** (outline), **Play today's Seed Rush** (filled emerald, the most prominent);
   - signed in: **Practice** (outline), **Play today's Seed Rush** (filled).
5. **Small text below:**
   - today's date (`November 9, 2026`), using the game day from `GET /seed-rush/day`;
   - when the streak is 1 or more, `🔥`-free text like `3-day streak` beside or under the date. The plant already shows it, so keep this line small.

Nothing else above the fold: no mode cards, countdown, leaderboard, account panel or app call to action.

### Below the fold on `/seed-rush`: kept for search

A quiet "About Seed Rush" section after a generous gap. This is the text search engines read; keep it, keep it out of the way:
- `<h2>`: About Seed Rush;
- two short paragraphs: what the game is (verses about money, work and stewardship), the three modes in one sentence each, and that the day resets at 7:00 AM Eastern;
- links: "Read the verses behind the game" → `/verses`, and "Study mode" → `/seed-rush/study`;
- the existing app call to action (App Store badge);
- the NIV notice.

Keep the page's existing `<title>`, meta description and JSON-LD.

### Pre-run state (after tapping Play)

- **The first time on this browser** (`localStorage` flag; not tied to sign-in), open **How to play** automatically first. Closing it continues to the pre-run screen.
- **The pre-run screen:**
  - a heading: `Today's Seed Rush` (practice: `Practice`);
  - a **mode switch**: one segmented control, Easy | Medium | Hard, not three cards;
    - the default is **Easy** for first-timers, or the **last mode used** (remembered in `localStorage`);
    - under it, one line describing the selected mode: Easy `Pick 1 word from 3 · 1 pt per verse`, Medium `Place 3 words from 6 · 2 pts per word`, Hard `Type 3 words · 5 pts per word`;
  - one filled **Start** button;
  - practice only: one small line, `Practice runs don't count on the leaderboard.`
- Then the existing 3-2-1 and the game screen.

### How to play (dialog)

Short. At most about 70 words of text plus the small mode table:
- `Fill in the missing words of each verse before the minute runs out.`
- `One try per verse. Partial credit counts in Medium and Hard.`
- `Everyone gets the same verses each day. A new round starts at 7:00 AM Eastern.`
- a compact three-row table: mode, what you do, points;
- `Practice anytime. It doesn't count on the leaderboard.`

### Game state

Unchanged (timer, verse card, inputs, feedback), except:
- the game toolbar icons are hidden (see above);
- remove any leftover secondary text around the game.

### End state (after a run) and the "already played today" landing

When today's daily is done, landing on `/seed-rush` shows this instead of the Play landing (Wordle does the same). Top to bottom:
1. **The streak plant,** large (about 140px), at the stage the streak has reached (§4), with the streak number big beside or under it (Montserrat, about 2.5rem) and `day streak` small. If this run just made the plant grow a stage, play a short grow animation once: a crossfade or scale from the previous stage. Skip it with reduced motion.
2. **Score:** the points big, then one quiet line: `9 right · 3 wrong · Medium`, plus `· Rank #12` when ranked.
3. **Share:** the one filled button; same share text as now.
4. **Next round:** `Next Seed Rush in 14:22:05` (live countdown).
5. **Secondary buttons** (outline): **See today's verses** (expands the existing verse list with the right/partly/wrong marks, missing words and verse links; collapsed by default) and **Practice**.
6. **Only when relevant,** one small line under these:
   - signed in but not verified: `Verify your email to appear on the leaderboard.` and a text-style **Send email** button;
   - signed in without a username: the username prompt line;
   - guest: the existing sign-up message (keep its wording exactly) with a text-style **Create account** button.

   Show at most one of these.

A **practice** end state is the same layout, without the streak growth, rank, share or countdown. Its filled button is **Play again**, with **Change mode** as an outline button.

## 2. Streak display data

- **Signed in:** the streak from `GET /seed-rush/me` (and from the finish response after a run).
- **Guests:** the server tracks guest streaks, but `/me` is for accounts only. So after each finished daily run, store `{streak, game_day}` from the finish response in `localStorage`. On load, show it if its `game_day` is today's or yesterday's game day (from `GET /seed-rush/day`); otherwise show 0.
- **0, or a brand-new player:** the empty pot, and no number on the landing page. On the end and played states, show `Play tomorrow to grow your streak` under the plant.

## 3. Visual hierarchy rules (apply everywhere in Seed Rush)

- One filled emerald button per screen; secondary actions are outline buttons; tertiary actions are text links.
- No colored info boxes (like the current orange verification box). Use plain small text with a text-style button.
- Fewer words: if a sentence repeats what a button or heading already says, remove it.
- Keep everything that's currently accessible (labels, keyboard use, focus states, `aria-live` on the timer).

## 4. The streak plant (art from the app)

Use the app's own debt-plant art so the streak feels like DollarSeeds.

- **Source (read-only):** `C:\DollarSeeds\frontend\assets\debt-freedom\`:
  - `plant-1` … `plant-4`, each with `frame-00` … `frame-10` (`frame-XX-back.svg` and `frame-XX.svg`), `paid-off.svg` and `paid-off-base.svg`;
  - `pot-kit/` (including `empty-pot.svg`);
  - `layout.json` (1000 × 1250 canvas).

  Read `frontend/components/debts/PlantView.tsx` and `plantAssets.ts` to see how a frame is layered: back → pot → (label) → front.
- **Which plant:** use **one species**, the one whose full-grown and paid-off art has flowers (check the files). If two qualify, use the lower-numbered one. Say which you chose. Never show the pot label: no text, and no debt name.
- **Stages,** by streak length:

  | Streak | Art |
  |---|---|
  | 0 | empty pot |
  | 1–2 | frame 01 (sprout) |
  | 3–6 | frame 03 |
  | 7–13 | frame 06 |
  | 14–29 | frame 09 |
  | 30+ | the paid-off art (full bloom) |

- **Images:** composite each stage once into a single image with the same layer order as the app (sharp can render SVG), cropped to the art's bounds with a little padding, and with a transparent background. Save them as WebP at 2 sizes (e.g. 160 and 320 px wide) in `assets/images/streak/`, named `streak-stage-0.webp` … `streak-stage-5.webp`, and commit them. Put the compositing in a small script (`tools/gen-streak-art.js`) so it can be rerun; it reads the app repo path from a constant at the top.
- **Alt text:** stage 0 `An empty pot, waiting for a seed`; others `A DollarSeeds plant at streak stage N of 5`.
- **Next growth hint** under the streak on end and played states, in small text: `2 more days until it grows` (until the next threshold). At 30+, `Fully grown. Keep it blooming.`

## 5. Build and check

1. Run `npm run build`, then the checks: `node tools/check-page.js` on `/seed-rush`, `/seed-rush/practice`, `/seed-rush/study` and `/verses`, then `check-schema` and `check-urls`. There must be no CSP violations, and Termly must still load. Confirm `/seed-rush/daily` redirects.
2. Test with the dev mock (`node tools/seed-rush-dev.js 8090`, then `?api=mock&auth=mock`) **and**, if Lucas has the local backend running on 8000, against it. Ask before assuming. Walk through:
   - a first visit (How to play opens once, Easy is preselected);
   - a run;
   - the end state with plant growth;
   - a reload, which shows the played-today landing;
   - each toolbar dialog, guest and signed in;
   - practice;
   - a returning visit (the last mode is remembered, How to play doesn't reopen).
3. Check at 1440, 768, 390 and 360px: the whole landing state fits in the first screen on a 390 × 844 phone; one filled button per screen; no sideways scroll; no italics.
4. Commit on `seed-rush-site`.
5. Report:
   - what changed, file by file;
   - which plant species you used;
   - screenshots at desktop and phone width of:
     - the landing (signed out, and signed in with a streak);
     - the How to play dialog;
     - the pre-run screen;
     - the end state;
     - the played-today landing;
     - the leaderboard and account dialogs;
     - all six streak stages side by side;
   - anything you had to decide.
