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
    // Hero phone screen — the LCP element. Frame is 250px wide (200 under
    // 900px, 185 under 580px), so 250/500 covers 1x/2x.
    src: 'assets/images/dashboard-screen.jpeg',
    widths: [250, 500],
    formats: ['avif', 'webp'],
    note: 'hero / LCP'
  },
  {
    // Hero tree illustration — rendered at 540px tall (square source), scaling
    // down to 230px on small viewports.
    src: 'assets/images/dollarseeds-tree.png',
    widths: [400, 540, 1080],
    formats: ['avif', 'webp'],
    note: 'hero decoration'
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
  },
  {
    // Video poster frames. A poster="" attribute cannot take a <picture>, so
    // these get one resized JPEG each rather than a format ladder — the win is
    // dropping 720px sources down to the 600px the 2x layout actually needs.
    src: 'assets/images/posters/*.jpg',
    widths: [600],
    formats: ['jpeg'],
    replacesPoster: true,
    note: 'video posters'
  }
];
