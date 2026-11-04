# PROMPT 8: New hero (illustrated scene, centered text, no phone)

Run from `C:\DollarSeeds-Landing\dollarseeds-landing`. Parts 1–4 (`docs/PROMPT-4-…` to `docs/PROMPT-7-…`) are done on the branch `homepage-restructure-1`.

**Before running:** save the two hero images into the repo with exactly these names:
- `assets/images/hero/hero-seed-path-desktop.png`: the wide 16:9 scene, about 2752px wide (upscaled or regenerated).
- `assets/images/hero/hero-seed-path-mobile.png`: the 4:5 portrait version of the same scene.

---

This is part 5 of the DollarSeeds homepage restructure. The four slider demos below the hero each show a phone, so the hero's phone screenshot makes the top of the page blend in with them. This part replaces the hero's phone with a full-width illustrated scene and puts all the hero text centered above it. Do **only** what's listed here.

## Ground rules

- **Git:**
  - Stay on `homepage-restructure-1`. Don't commit to `main`, don't push, don't deploy.
  - Also commit `docs/PROMPT-8-hero.md`.
- **Keep:**
  - The Termly scripts and the CSP in `netlify.toml`, unchanged.
  - Every section other than the hero, including the trust bar.
- **Images:** the two images in `assets/images/hero/` are the masters. Don't edit them.
  - If either file is missing, stop and tell me; don't substitute anything.
  - Report each one's pixel size. If the desktop image is narrower than 2048px, say so; it may look soft on large screens.

## 1. What the scene is

The illustration shows:
- Benny, the coin mascot, planting a gold seed in a pot at the lower left;
- a dirt path winding right past three pots in which the plant grows from a sprout to a leafy plant to a full bloom;
- a sunrise over green hills at the right.

The **top ~55% of the desktop image** and the **top ~40% of the mobile image** are empty sky in **one flat color**. Sample that color from a corner pixel of each final image. Expect about `#F3F0E1`, but use what you measure. If the two images' sky colors differ by more than a couple of RGB values, report it.

## 2. Hero markup and layout

Rewrite the hero section in `index.html`. Keep `id="hero"`, `aria-labelledby="hero-heading"`, and the reveal attributes.

### Remove

- The phone frame, the notch and the home-screen `<picture>` (`.hero-visual`, `.phone-frame` and `.phone-notch` inside the hero).
- The two blurred blobs (`.hero-blob`).
- The two-column grid.
- All CSS and media-query rules that only served those.
- **Check the phone-frame CSS before deleting it.** `.phone-frame` and `.phone-notch` are also used by the four demos. Only remove hero-specific rules, and make sure the demos look unchanged.
- **The home-screen preload:** remove the `<link rel="preload" as="image" … home-screen-2026-11-…>` from `<head>`.
- **The home-screen images:**
  - `assets/images/home-screen-2026-11.jpeg` is still used by `tools/og/og-image.html` (the social card), so **keep the JPEG**.
  - Remove its `images.config.js` entry and delete `assets/images/gen/home-screen-2026-11-*`, after grepping to confirm nothing else uses them.

### Keep

All the hero text and the App Store button, word for word and in the same order:
- the eyebrow;
- the `<h1>`, with its `.accent` span;
- the tagline;
- the description;
- the App Store badge link;
- the note ("Free to download · iPhone").

### New layout

- **Background:** the hero's background is the measured sky color, flat, with no gradient. The image's sky and the page must meet with no visible edge at any width.
- **Text block:**
  - centered horizontally, `text-align: center`, max-width about 760px;
  - the description limited to about 62ch and centered;
  - the CTA row (badge and note) centered.
- **Give the text more presence than before:**
  - `<h1>` at about `clamp(2.25rem, 4.6vw, 3.75rem)`, weight 580, line-height about 1.08;
  - tagline at about 1.375rem;
  - description at about 1.125rem;
  - generous spacing between them.

  Keep the existing colors (`--ink`, `--ink-soft`, `--accent-text`).
- **The scene:** sits under the text, full width (edge to edge, no side padding), and anchored to the bottom of the hero. The trust bar starts directly below the scene's bottom edge.
- **The text sits on the image's empty sky, not above it.** The sky part of the image must not create a large empty gap between the text and the hills. Overlap the text block with the image's sky area, for example by positioning the image at the bottom of the hero and reserving bottom padding equal to the visible scene height.
- **What must hold at every width:**
  - no text, badge or note ever overlaps the hills, the path, Benny, the pots or the sun;
  - Benny and the full-bloom plant are never cropped off the sides;
  - the hills reach both edges of the screen, with no hard vertical edge;
  - on very wide screens (2560px), the scene doesn't grow so tall that the hero becomes taller than the screen. If you cap its height, crop **only sky from the top** (for example `object-fit: cover; object-position: center bottom` inside a height-capped box). Never crop the sides.
- **Phones (≤ 640px):** use the mobile image through `<picture>` `<source media="(max-width: 640px)">`, with the same rules. Text on the sky, scene at the bottom, nothing important cropped.
- Remove any hero padding that only made room for the phone. Keep enough top padding to clear the fixed header.

### Image markup

- **One `<picture>`** with:
  - mobile AVIF and WebP sources (`media="(max-width: 640px)"`);
  - desktop AVIF and WebP sources, with `srcset` widths and a `sizes="100vw"`;
  - an `<img>` whose `src` is the 1440px desktop WebP;
  - the image's real `width` and `height`;
  - `fetchpriority="high"`, and no lazy loading.
- **Alt text:** `Benny, the DollarSeeds coin mascot, plants a glowing gold seed in a pot at the start of a winding path; further along, the same plant grows from a sprout to a leafy plant to a full bloom, leading toward a sunrise over green hills`
- **Preload:** add a responsive image preload in `<head>` for the desktop AVIF (`imagesrcset`/`imagesizes`, `media="(min-width: 641px)"`), and one for the mobile AVIF (`media="(max-width: 640px)"`).
- **`scripts/images.config.js`:** add two entries, both formats `['avif', 'webp']`:
  - `assets/images/hero/hero-seed-path-desktop.png`, widths `[1024, 1440, 2048, 2752]`, note `hero / LCP`;
  - `assets/images/hero/hero-seed-path-mobile.png`, widths `[640, 1080]`, note `hero mobile`.

  Widths larger than the source are skipped automatically. Check that the 1440px desktop WebP is under about 150 KB, and report the sizes.
- **Reduced motion:** keep the existing reveal behavior for the text. Don't animate the image.

## 3. Build and check

1. Run `npm run images`, then `npm run build`. Commit the new masters, the generated files and the deletions.
2. Run `node tools/check-page.js` on `/`, then `node tools/check-schema.js` and `node tools/check-urls.js`. All must pass, with no failed requests.
3. Check `/` at 2560, 1920, 1440, 1024, 768, 640, 390 and 360px. At every width:
   - all the rules in §2;
   - the header never covers the text;
   - nothing scrolls sideways;
   - the demos' phone frames look exactly as before.

   Also check `/` with JavaScript off.
4. Commit on `homepage-restructure-1`.
5. Report:
   - what changed, file by file, including deletions;
   - the measured sky colors;
   - the master pixel sizes;
   - the generated file sizes;
   - screenshots of the hero at 2560, 1440, 768 and 390px;
   - anything you couldn't do or had to decide.

## Out of scope

- The trust bar text, the social card (`og-default.png` keeps the home screen for now), the video series section, FAQ, JSON-LD.
