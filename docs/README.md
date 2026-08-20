# DollarSeeds Landing — Revamp Docs

Working documents for the post-launch site revamp (Aug 2026).

## Run order

| Step | File | Model | Status |
|---|---|---|---|
| 1 | `PROMPT-1-fable5-design.md` | Fable 5 | Structural revamp — sections, new pages, content. **Done.** |
| 2 | `PROMPT-3-fable5-visual-revamp.md` | Fable 5 | Visual revamp — cream ground, motion, hero tree animation, live budgeting demo, video rows. Also transcodes the HEVC videos. |
| 3 | — | — | Review locally, deploy the redesign on its own. |
| 4 | `PROMPT-2-opus5-seo.md` | Opus 5 | Technical SEO & performance. **Run last**, after both design passes are merged — it optimizes markup that step 2 would otherwise churn. |

> Prompt 2 is numbered before Prompt 3 by filename only. **Run order is 1 → 3 → 2.**

Manual (non-Claude Code) steps live in the Google Doc: **DollarSeeds Site Revamp — Manual Steps Checklist**.

## Fixed facts these prompts assume

- Production site: `https://dollarseeds.app` — apex is primary; `www.` and the legacy `dollarseeds.netlify.app` both 301 to it. `.app` is an HSTS-preloaded TLD, so the site is HTTPS-only by design.
- App Store: `https://apps.apple.com/us/app/dollarseeds/id6780037284` · ID `6780037284`
- Released 2026-08-07, iOS only, free, categories Finance + Education
- Budgeting types — Needs / Wants / Savings:
  - **50/30/20** — 50 / 30 / 20
  - **Wealth Builder** — 30 / 20 / 50
  - **Firm Foundation** — 70 / 10 / 20
- Trust bar shows rating and rating count only. **No download count.**
- Logo at `assets/brand/logo.png`

## Placeholders — resolved

`PROMPT-2`'s two placeholders were supplied during the run and now live in
`scripts/site.config.js` (`APP.appleTeamId`, `APP.bundleId`), which is the only
place either value appears:

- `APPLE_TEAM_ID` → `YBSBHHBC5R`
- `BUNDLE_ID` → `com.lucasfcustodio.dollarseeds` (confirmed against Apple's lookup API)

Both feed `/.well-known/apple-app-site-association`. **The app side still needs
its half:** add `applinks:dollarseeds.app` to the Associated Domains entitlement
in the next iOS build, or universal links stay inert no matter what the site serves.

Search Console and Bing no longer need placeholder values — the domain is verified as a GSC **Domain property** via DNS TXT, and Bing is verified by importing that property.

## Out of scope

In-app review prompting (`SKStoreReviewController`) is deliberately excluded from both prompts — handled separately in the app repo.
