# PROMPT 10: Version base.css and site.js; Seed Rush link on Privacy and Terms

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`.

---

Two small fixes before the Seed Rush branch is deployed. Do only these.

## Ground rules

- **Git:** stay on `seed-rush-site`. Don't commit to `main`, don't push, don't deploy.
- **Keep the Termly scripts** exactly as they are.
- **Also commit:** `docs/PROMPT-9-seed-rush-site.md` and `docs/PROMPT-10-cache-versioning.md`.
- **Leave alone:** `docs/seed-rush-verses.xlsx`, `docs/seed-rush-verses.pdf` and any `~$` Excel lock file. Don't commit or delete them.

## 1. Version `base.css` and `site.js`

**The problem:** `/assets/*` is served `public, max-age=31536000, immutable`, but `base.css` and `site.js` are linked without a version. Returning visitors therefore keep old copies for up to a year.
- `base.css` changed heavily since the last deploy: Montserrat and Lato instead of Urbanist and Figtree, no italics, nav changes.
- The old cached copy points to font files that no longer exist.

**The fix:** use the same `?v=<hash>` approach the Seed Rush assets already use (see `scripts/seed-rush-shell.js`).
- Every page's `<link rel="stylesheet" href="/assets/css/base.css">` and `<script src="/assets/js/site.js">` gets a content-hash query, e.g. `/assets/css/base.css?v=3f9a1c2b`.
- That covers every hand-written page, generated page and template, including `404.html`, `privacy.html`, `terms-termly.html`, `cookie-policy.html` and `delete-account.html`.
- The hash is recomputed and rewritten by the build (`npm run build`), so later edits to either file automatically get a new URL. Put the logic in one place and reuse it, rather than a second copy of the hashing code.
- Do the same for any other CSS or JS file under `/assets/` that pages link without a version, if there is one. **Don't** change files that are already versioned by name, like the generated images, or that already carry `?v=`.
- Don't change the cache rules in `netlify.toml`.
- **Check:**
  - after `npm run build`, `git grep -n 'base.css"' -- '*.html'` and `git grep -n 'site.js"' -- '*.html'` return nothing unversioned;
  - running the build twice without changes produces no diff.

## 2. Seed Rush link on Privacy and Terms

`privacy.html` and `terms-termly.html` were left out of the navigation update.
- Add **Seed Rush** (`/seed-rush`) as the first item of their top navigation and to their footer's Product list, exactly as on the other pages.
- **Only the nav and footer markup changes.** The policy content, the Termly embed and its scripts stay byte-for-byte the same.

## 3. Check

1. Run `npm run build`.
2. Run `node tools/check-page.js` on `/`, `/privacy`, `/terms` and `/seed-rush`, then `node tools/check-urls.js`. No CSP violations, Termly loads, no failed requests.
3. Commit on `seed-rush-site`.
4. Report:
   - which files now carry versions;
   - where the hashing logic lives;
   - the two checks from §1.
