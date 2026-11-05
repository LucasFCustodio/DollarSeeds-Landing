# PROMPT 9: Seed Rush on the website (game pages, verse pages, sign-in)

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`.

---

You're building the website half of **Seed Rush**, a free daily Bible-verse game on dollarseeds.app. Players fill in missing words from verses about money, work and stewardship, race a **1-minute clock**, and land on a daily global leaderboard. The backend is already built in the app repo. This prompt builds every page the player sees, plus one SEO page per verse.

This is a **first version** for Lucas to review. Follow the site's existing visual identity closely; he'll suggest changes after seeing it.

## 0. Read first (read-only, don't change anything there)

- **The game spec:** this prompt repeats everything needed. If anything conflicts, this prompt wins.
- **The backend, in `C:\DollarSeeds`, branch `seed-rush-backend`:**
  - `.claude/docs/seed_rush.md`;
  - `backend/seed_rush.py`;
  - the `/seed-rush` routes in `backend/main.py`.

  Use the **exact** endpoint paths, request and response shapes, and error codes (`detail.code`) from there. Don't guess them. Don't edit that repo.
- **This repo:**
  - `docs/README.md` and `scripts/README.md`;
  - `scripts/site.config.js` and `netlify.toml`;
  - one existing content page (e.g. `lessons/tithing.html`), as the template for header, footer, fonts, Termly and head tags.

## Ground rules

- **Git:** create the branch `seed-rush-site` off `main`. Don't commit to `main`, don't push, don't deploy.
- **Keep:**
  - the Termly scripts on every page, exactly as on existing pages (the resource blocker first in `<head>`);
  - the site's look: cream grounds, forest/emerald accents, Montserrat headings, Lato body, JetBrains Mono for small labels, **no italic text anywhere**, the existing header, footer, nav and button styles.
- **Bible text:**
  - It comes only from the verse data described in §2.
  - Never fetch it from BibleGateway or elsewhere.
  - Never retype, correct or invent it.
  - Never show Scripture in a way that could be mistaken for altered text. Blanks must look clearly different from the printed words.
- **Explanations** are Lucas's. Show them exactly as written.
  - The game never shows an explanation before the verse is answered.
  - Explanations appear only on the verse pages and the Study page.
- **The NIV notice:** every Seed Rush page and every verse page shows this in the footer area, word for word:

  > Scripture quotations taken from The Holy Bible, New International Version® NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc. Used with permission. All rights reserved worldwide.

- **Accounts:** the website signs people into the **same Supabase project as the app**. Never write anything to Supabase user metadata. In particular, never set `onboarding_v2_completed_at`: the app uses it to decide whether to show its onboarding. Seed Rush data goes only through the backend.
- **Never touch:**
  - the Supabase **secret / service-role** key;
  - Supabase Auth settings;
  - `privacy.html` and `terms-termly.html`. Their text lives in Termly, and Lucas updates it there.
- **No new frameworks.** Plain HTML, CSS and vanilla JavaScript, as the rest of the site. The one allowed addition is the Supabase JS client (§4).

## 1. Pages

All pages are static HTML generated or written like the rest of the site, with pretty URLs (`/seed-rush/daily`, not `.html`).

| URL | Purpose | Indexed? |
|---|---|---|
| `/seed-rush` | The game's home: what it is, how to play, start buttons, countdown, today's leaderboard | yes |
| `/seed-rush/daily` | Today's daily run | no |
| `/seed-rush/practice` | Practice runs | no |
| `/seed-rush/study` | Study mode: flashcards with explanations | no |
| `/seed-rush/verify` | Email verification landing | no |
| `/verses` | Index of every verse, grouped by category | yes |
| `/verses/<slug>` | One page per verse (SEO) | yes |

Indexed pages go in `PAGES` in `scripts/site.config.js`. The verse pages are added from the data, not by hand. The others go in `NON_INDEXED` and get `<meta name="robots" content="noindex">`.

### `/seed-rush`

- **Header and intro:**
  - an H1, `Seed Rush`;
  - a one-line pitch: a daily 1-minute Bible verse game about money, work and stewardship;
  - a short "How to play": pick a mode, fill in the missing words before the minute runs out, and the day resets at 7:00 AM Eastern.
- **The three modes**, as cards:

  | Mode | Blanks | Options | Points |
  |---|---|---|---|
  | Easy | 1 | pick from 3 | 1 per verse |
  | Medium | 3 | pick from 6 | 2 per correct word |
  | Hard | 3 | type them | 5 per correct word |

  Say that all modes share one leaderboard, so Easy is a good place to practise before moving up.
- **Buttons:**
  - primary: **Play today's Seed Rush** → `/seed-rush/daily`;
  - secondary: **Practice** → `/seed-rush/practice`;
  - a link: **Study the verses** → `/seed-rush/study`.
- **Countdown** to the next daily round, from `GET /seed-rush/day`, corrected by the server-time offset.
- **Status:**
  - the player's streak and whether today's run is played: from `GET /seed-rush/me` when signed in, or local storage for guests;
  - the account area (§4).
- **Today's leaderboard:** the top 10, a "Show all" control that expands to the full top 100, and the player's own row highlighted, with their rank shown even outside the top 100. Each row shows rank, username, mode and score. Add a toggle for yesterday's board.
- **A short link** to `/verses`: "Read the verses behind the game."
- **The app:** a small, calm call to action with the App Store badge, the same as on other pages. DollarSeeds helps you budget, save and get out of debt.
- **Head tags:**
  - `<title>`: `Seed Rush: Daily Bible Verse Game | DollarSeeds`;
  - a meta description about a free daily 1-minute game with Bible verses about money and work;
  - a canonical URL, and Open Graph tags like other pages.
- **JSON-LD:** a `WebApplication` with `applicationCategory: "GameApplication"`, `isAccessibleForFree: true`, plus a `BreadcrumbList`. It must pass `tools/check-schema.js`.

### `/seed-rush/daily` and `/seed-rush/practice`

The same game component; `kind` is `daily` or `practice`.

1. **Mode picker:** Easy / Medium / Hard cards, with the points rule on each, and a Start button.
   - **Daily:** if today's run is already played (signed in: `played_today` from `/me`; guest: `already_played` from the start call, or the local record), skip straight to today's result: score, streak, rank if any, share, countdown to tomorrow, and a link to the leaderboard.
   - **Practice:** a line saying practice runs don't count on the leaderboard.
2. **A short 3-2-1 countdown** before the run, skipped with reduced motion. Then the start call.
3. **The game screen** (§3).
4. **The end screen** (§5).
5. **Practice:** a **Play again** button, which can keep the same mode.

### `/seed-rush/study`

- Flashcard view over all verses, in category order:
  - the reference and category;
  - the full verse;
  - a **Show explanation** button that reveals Lucas's explanation;
  - Previous/Next buttons, also with ← and → keys;
  - a "Read the full page" link to `/verses/<slug>`.
- No timer, no score.
- Generate the verse data **into the page at build time**. Don't fetch it at runtime.

### `/seed-rush/verify`

- Reads `token` from the query string and calls the verification-confirm endpoint.
- Shows one of:
  - verified: "Your email is verified. You'll now appear on the leaderboard." with a button back to `/seed-rush`;
  - invalid: the token isn't valid;
  - expired: offer to send a new email, which needs sign-in.

### `/verses` and `/verses/<slug>`

- **Each verse page:**
  - the H1 is the reference;
  - the full NIV text as a large, clearly styled quotation, not italic;
  - the category;
  - Lucas's explanation under a heading such as "What this verse teaches about money";
  - up to 3 related verses from the same category, linked;
  - a **Play Seed Rush** button → `/seed-rush`;
  - the app call to action;
  - the NIV notice.
- **Title:** `<Reference>: What the Bible Says About <Topic>`. Topic by category:

  | Category | Topic |
  |---|---|
  | Finances & Debt | Money and Debt |
  | Stewardship | Stewardship |
  | Growth | Financial Growth |
  | Responsibility | Responsibility |
  | Timeliness | Timing |
  | Generosity & Giving | Giving |
  | Contentment | Contentment |
  | Work & Diligence | Work |
  | Planning & Wisdom | Planning |
  | Trust & Provision | God's Provision |

  For an unknown category, use the category name.
- **Meta description:** the start of the explanation, cut at a word boundary to at most 155 characters.
- **Head tags:** a canonical URL and Open Graph tags.
- **JSON-LD:** a `BreadcrumbList` (Home → Verses → Reference). It must pass `check-schema`.
- **`/verses`:** an H1 such as "Bible Verses About Money, Work and Stewardship", a short intro, the verses grouped by category (each linking to its page with its reference and the first few words of the verse), and the NIV notice.

## 2. Verse data (build time)

- **Snapshot file:** `assets/data/seed-rush-verses.json`.
  - It holds the public verse list exactly as returned by `GET /seed-rush/verses`: slug, reference, category, text, explanation.
  - Create it now by copying the verses from `C:\DollarSeeds\backend\seed_rush_data\verses.json`, keeping only those five fields.
  - If that file is empty, stop and tell Lucas. The verse builder prompt (`prompts/SEED_RUSH_VERSES_BUILDER.md` in the app repo) has to run first.
- **`scripts/sync-verses.js`:**
  - fetches `GET {API}/seed-rush/verses` and, when it succeeds with a non-empty list, rewrites the snapshot;
  - when it fails, it keeps the existing snapshot and prints a warning. It must **never** fail the build or write an empty list, the same as `sync-app-stats.js`.
  - The backend may not be deployed yet, so the snapshot is what the first builds use.
- **`scripts/gen-verses.js`:** generates `verses/index.html`, `verses/<slug>.html` and the Study page's embedded data from the snapshot, using shared templates.
  - Generated files are committed, like the rest of the site.
  - Verses no longer in the data get their generated page removed.
- **Wiring:**
  - add both scripts to the build in `scripts/index.js`: sync, then generate, before the sitemap step;
  - make `PAGES` include `/verses` and every `/verses/<slug>` from the snapshot, so the sitemap and `llms.txt` pick them up;
  - `/seed-rush` goes in `PAGES` by hand.

## 3. The game screen

### Layout

Mobile first, centered, max-width about 640px, no horizontal scroll at 360px.

- **The 1-minute timer** is the most visible element at the top:
  - a large `0:59`-style countdown in JetBrains Mono, with a full-width bar that shrinks from left to right;
  - in the last 10 seconds, the bar and digits turn amber and then red;
  - `role="timer"`;
  - an `aria-live` announcement at 30 and 10 seconds only, not every second.
- **Next to the timer:** the running score, and the mode as a small label.
- **The verse card:** the reference on top (e.g. "Proverbs 22:7"), then the verse with its blanks.
  - **Blanks** are visibly different from the printed Scripture: a rounded box with a dashed outline and a light tinted fill, sized to the hidden word's length (the server sends segments, not words; use a sensible minimum width). Filled-in words show inside the box in a different color from the verse text.

### Input by mode

- **Easy:** three large option buttons under the verse. Tapping one submits. Keys 1–3 work.
- **Medium:**
  - six word chips;
  - tapping a chip fills the **next empty blank** in order, and the chip greys out;
  - **dragging** a chip onto a specific blank drops it there; use pointer events, so it works with touch and mouse;
  - tapping a filled blank clears it and returns its chip;
  - a **Check** button turns on once all three blanks are filled;
  - keys 1–6 place chips, Backspace clears the last filled blank, and Enter checks.
- **Hard:**
  - a text input inside each blank, auto-focused;
  - Enter or Tab moves to the next blank, and Enter on the last one checks;
  - `autocapitalize="off"`, `autocomplete="off"`, `spellcheck="false"`.

### Feedback

All of it comes from the answer response; the browser never decides right or wrong.

- **All right:** a quick green flash (~400 ms), then the next verse.
- **Any wrong:**
  - show **"Wrong"**;
  - mark each blank right (green) or wrong (red);
  - show the correct words in the blanks for about **1 second**;
  - then the next verse.
- Disable input while a request is in flight. The next question arrives in the same response, so there's no extra wait.

### The clock

The server owns it.
- At the start, compute an offset from `server_time` versus the browser clock, and count down to `deadline_at` with that offset.
- At 0:00, stop input and call finish.
- If the server says the time is up or the run is finished, go to the end screen.
- The timer must keep running correctly when the tab is in the background (use timestamps, not tick counting).

### Leaving mid-run

- Keep the current `run_id` (and kind) in local storage, and warn with `beforeunload` while a run is active.
- If the page loads and finds an unfinished stored run, call finish for it (it's idempotent) and show its end screen. There's no resume, because the server clock kept running.

### Motion and accessibility

- Respect `prefers-reduced-motion`: no flashes or slides, just instant state changes.
- Every control is reachable and usable by keyboard.

## 4. Accounts, guests and the account area

### Supabase client

- Add `@supabase/supabase-js` (latest v2) as a dependency, and have the build copy its UMD browser bundle to `assets/js/vendor/supabase.js`. Commit the copy.
- No CDN: the CSP allows scripts only from this site and Termly.

### Config

- In a small `assets/js/seed-rush-config.js`, generated at build from `scripts/site.config.js`, set:
  - `SUPABASE_URL`: `https://vbvsblpyeylnemrecyqv.supabase.co`;
  - `SUPABASE_PUBLISHABLE_KEY`;
  - `API`: production `https://dollarseeds-1.onrender.com`.
- **Ask Lucas for the publishable key** before you start this part. It's the "publishable" (or legacy "anon public") key from Supabase → Project Settings → API Keys, and it's safe to include in a website.
  - **Never** use, request or accept the secret / service-role key. If something that looks like one is given, refuse it and explain.
- **Local testing:** on `localhost` or `127.0.0.1` only, allow overriding `API` with `?api=http://127.0.0.1:8000` (remembered in `sessionStorage`).

### CSP

In `netlify.toml`, add `https://dollarseeds-1.onrender.com` and `https://vbvsblpyeylnemrecyqv.supabase.co` to `connect-src`. Change nothing else in the CSP.

### Sign-in options in v1

- **Email + password:**
  - sign up with `supabase.auth.signUp` **with no `data` / metadata**;
  - sign in with `signInWithPassword`.

  Project-wide email confirmation is off, so sign-up returns a session right away.
- **Continue with Google:** `signInWithOAuth({ provider: 'google', options: { redirectTo: <current page URL> } })`.
- **Apple sign-in isn't in v1.** Apple on the web needs extra Apple and Supabase setup. Show nothing for it.
  - Add a short note in the sign-in panel: "Signed up in the app with Apple? Website sign-in with Apple is coming soon."
  - Mention it in your report.
- **No password reset in v1:** add a "Forgot your password?" line pointing to the support email. Mention it in the report.

### Account area

A panel or dialog on `/seed-rush`, `/daily` and `/practice`.

- **Signed out:** sign in / create account, and a line on why: get on the leaderboard and keep your streak on any device.
- **After sign-up, or a first sign-in without a Seed Rush username:**
  - ask for a **username**, live-checked with the username-check endpoint (debounced, with each reason shown in plain words: too short, too long, letters/numbers/underscores only, reserved, not allowed, taken);
  - then save it.
- **Signed in:**
  - show username and streak;
  - **unverified email:** a banner saying "Verify your email to appear on the leaderboard", with a **Send verification email** button. Handle `sent`, `already_verified`, `delayed` ("We couldn't send it right now. Try again later.") and the 3-per-hour limit;
  - Google sign-ins are verified automatically by the backend;
  - a Sign out link.

### Guests

- Guests can play everything.
- Create a guest ID once with `crypto.randomUUID()`, store it in local storage, and send it as the guest header the backend expects on every call while signed out.
- **Claiming:** after a guest signs up or signs in, call the guest-claim endpoint with that ID **when no run is in progress**, then create a fresh guest ID. Show the carried-over streak if the response has one.

### Errors

- Read the error **code from the JSON body** (`detail.code`), not headers: the browser can't read `Retry-After` under the current CORS settings.
- Map every code you find in the backend to a short, friendly message.
- **Network failure or a cold backend:**
  - show "Waking up the game…" after 3 seconds of waiting;
  - retry the start call once;
  - after that, show "Seed Rush is unavailable right now. Please try again in a minute."
- Call `GET /seed-rush/day` when any Seed Rush page loads, to warm the server.

## 5. End-of-run screen

- **Score** (big), number of words right and wrong, and the mode.
- **Daily, signed in and verified:** today's rank, from the finish response or the leaderboard.
  - Signed in but not verified: "Verify your email to get ranked", with the send button.
  - Signed in without a username: the username prompt.
- **Streak:** the current streak, with a small 🌱 for each day up to 7.
- **Every verse seen in the run:** the reference, right / partly right / wrong, the correct words, and a link to `/verses/<slug>`. That's where the explanation lives.
- **Share** (daily runs only): copy this text to the clipboard. Use `navigator.share` when it's available on phones, falling back to the clipboard.

  ```
  🌱 Seed Rush · Nov 5 · Hard · 40 pts
  🟩🟩🟨🟥
  dollarseeds.app/seed-rush
  ```

  - one square per verse answered: 🟩 all blanks right, 🟨 some right, 🟥 none right;
  - the date is the game day.

  Show "Copied!" after copying.
- **Guests** see, exactly: "Want to see how well you scored in today's leaderboard and unlock exclusive badges? Sign up with an account." with a sign-up button. Signing up then claims the guest's runs.
- **Buttons:**
  - daily: View leaderboard, Practice;
  - practice: Play again, Change mode.

## 6. Navigation, caching and build details

- **Navigation:** add **Seed Rush** (`/seed-rush`) as the first item of the top navigation on every page, and to the footer's Product list.
  - It must still fit on one line at 1024px and 1440px; reduce the link gap slightly if needed.
  - The mobile menu lists everything.
  - Also add `/seed-rush` and `/verses` to `llms.txt` through the existing generation.
- **Caching:**
  - `/assets/*` is served `immutable` for a year, so a changed file under an unchanged name never reaches returning visitors.
  - For the new Seed Rush JavaScript and CSS, add a content hash: either in the filename, or as a `?v=<hash>` query that the build writes into the HTML.
  - Do the same for `assets/js/vendor/supabase.js` and `seed-rush-config.js`.
  - Add `netlify.toml` cache rules for `/seed-rush`, `/seed-rush/*`, `/verses` and `/verses/*` matching the existing `/lessons/*` rule (`max-age=0, must-revalidate`).
  - Note in the report that `/assets/js/site.js` already has this problem; don't change it in this pass.
- **Files:**
  - `assets/js/seed-rush.js`: the game, account and leaderboard logic, organized in clear sections or small modules;
  - `assets/css/seed-rush.css`, built on the tokens in `base.css`;
  - no inline secrets.

## 7. Build and check

1. Run `npm install`, then `npm run build`. Commit everything, including the generated verse pages, the snapshot and the vendor bundle.
2. Run `node tools/check-page.js` on:
   - `/seed-rush`, `/seed-rush/daily`, `/seed-rush/practice`, `/seed-rush/study`;
   - `/verses` and two verse pages.

   No CSP violations, no console errors, and Termly still loads. Requests to the backend may fail if it isn't deployed yet; that's expected, but the pages must handle it gracefully. Then run `node tools/check-schema.js` and `node tools/check-urls.js`.
3. **Test the game for real against a local backend,** if Lucas has one running with migration 0015 applied and verses loaded. Ask him before assuming:
   - play one run in each mode, daily and practice, as a guest and signed in;
   - check the timer, scoring display, the 1-second "Wrong" reveal, drag-and-drop in Medium, and typing in Hard;
   - check the end screen, the share text, the claim after sign-up, and the leaderboard.

   If no backend is available, test the game UI against a small **mock** (a local fake server or a flag in development only, never shipped enabled) that mimics the real responses. Say which you did.
4. Check at 1440, 1024, 768, 390 and 360px:
   - the timer is always visible during play;
   - nothing scrolls sideways;
   - no italics;
   - fonts are Montserrat/Lato;
   - the NIV notice is on every Seed Rush and verse page.

   Also check the no-JavaScript view of `/seed-rush` and a verse page: readable, with a message that the game needs JavaScript.
5. Commit on `seed-rush-site`.
6. Report:
   - what you built, file by file;
   - how the verse data flows;
   - every backend error code and the message you show for it;
   - screenshots (the `/seed-rush` home; a game in each mode with the timer visible; the "Wrong" state; the end screen as guest and signed in; Study; a verse page; `/verses`) at desktop and phone width;
   - anything you couldn't do or had to decide;
   - what Lucas must do by hand:
     - add `https://dollarseeds.app/**` (and `http://localhost:8080/**` for testing) to Supabase → Authentication → URL Configuration → Redirect URLs, for Google sign-in;
     - update the Privacy Policy and Terms in Termly;
     - the deploy order.

## Out of scope

- Badges, Portuguese, Instagram reels, Apple sign-in on the web, password reset on the web.
- Any homepage section beyond the nav link.
- Changes to the backend or the app.
