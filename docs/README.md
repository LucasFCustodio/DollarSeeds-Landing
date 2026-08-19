# DollarSeeds Landing — Revamp Docs

Working documents for the post-launch site revamp (Aug 2026).

## Run order

| Step | File | Model | Status |
|---|---|---|---|
| 1 | `PROMPT-1-fable5-design.md` | Fable 5 | Design & structure revamp. Run first. |
| 2 | — | — | Review locally, drop in real video/screenshot media, deploy on its own. |
| 3 | `PROMPT-2-opus5-seo.md` | Opus 5 | Technical SEO & performance. Run only after step 2 is merged and deployed. |

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

## Still unfilled

`PROMPT-2` has two placeholders that must be replaced before it runs:

- `{{APPLE_TEAM_ID}}`
- `{{BUNDLE_ID}}`

Both are needed for `apple-app-site-association` (universal links). Get them from App Store Connect / Xcode.

## Out of scope

In-app review prompting (`SKStoreReviewController`) is deliberately excluded from both prompts — handled separately in the app repo.
