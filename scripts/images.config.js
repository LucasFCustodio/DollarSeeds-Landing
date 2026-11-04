'use strict';

/**
 * Every raster asset the pages actually render, with the widths each one is
 * displayed at. Widths are the CSS pixel size (1x) and twice that (2x); nothing
 * is upscaled past the source, so a source narrower than a requested width is
 * simply skipped.
 *
 * Derivatives land in assets/images/gen/ and are committed. Sources are never
 * modified — they stay the masters.
 *
 * NOTE ON CACHING: derivative filenames encode width, not content, and
 * /assets/* is served immutable for a year (netlify.toml). Replacing a source
 * image in place therefore needs a filename bump, or returning visitors keep
 * the old bytes. gen-images.js prints a CHANGED warning when a derivative's
 * content moves under an existing name, so this cannot happen silently.
 */

module.exports = [
  {
    // Hero phone screen — the LCP element. Frame is 280px wide (200 under
    // 900px, 185 under 580px), so 280/560 covers 1x/2x.
    src: 'assets/images/home-screen-2026-11.jpeg',
    widths: [280, 560],
    formats: ['avif', 'webp'],
    note: 'hero / LCP'
  },
  {
    // "How logging works" demo: six 739x1600 screens in a 300px phone frame
    // (260 under 580px), so 300/600 covers 1x/2x.
    src: 'assets/images/log-demo/*.jpeg',
    widths: [300, 600],
    formats: ['avif', 'webp'],
    note: 'logging demo'
  },
  {
    // "How goals work" demo: seven 739x1600 screens in the same 300px phone
    // frame (260 under 580px), so 300/600 covers 1x/2x.
    src: 'assets/images/goal-demo/*.jpeg',
    widths: [300, 600],
    formats: ['avif', 'webp'],
    note: 'goal demo'
  },
  {
    // "How debts work" demo: eight 739x1600 screens in the same 300px phone
    // frame (260 under 580px), so 300/600 covers 1x/2x.
    src: 'assets/images/debt-demo/*.jpeg',
    widths: [300, 600],
    formats: ['avif', 'webp'],
    note: 'debt demo'
  },
  {
    // Lessons card screenshot, cropped to a 190px-tall band by object-fit.
    src: 'assets/images/screen-lessons.png',
    widths: [480, 739],
    formats: ['avif', 'webp'],
    note: 'faith section card'
  },
  {
    // Logo: 38px in the nav, 72px in the footer, 240px on the press page.
    src: 'assets/brand/logo.png',
    widths: [76, 144, 240, 480],
    formats: ['avif', 'webp'],
    note: 'nav / footer / press'
  }
];
