'use strict';

/**
 * Netlify build entry point (`npm run build`).
 *
 * Order matters:
 *   1. images       — derivatives must exist before anything references them
 *   2. verses sync  — refreshes the Seed Rush verse snapshot from the backend
 *   3. seed rush    — vendor bundle, runtime config, the Seed Rush pages
 *   4. verses       — verse pages + Study page from the snapshot
 *   5. static       — robots.txt / llms.txt / AASA / IndexNow key (reads the
 *                     page list, which now includes the verse pages)
 *   6. app-stats    — rewrites the trust bar and the JSON-LD from the live rating
 *   7. versions     — every page's base.css / site.js / Seed Rush asset links
 *                     get their current ?v=<content hash>
 *   8. sitemap      — reads git dates, and syncs lesson dateModified to match
 *   9. indexnow     — announces the deploy, production only, last
 *
 * Steps 2, 6 and 9 reach the network and are written to degrade quietly: a
 * failed fetch logs a warning and leaves the committed files alone. The rest
 * are local and deterministic, so a failure there is a real error and should
 * stop the build.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const STEPS = [
  { name: 'images', script: 'gen-images.js', fatal: true },
  { name: 'verses sync', script: 'sync-verses.js', fatal: false },
  { name: 'seed rush', script: 'gen-seed-rush.js', fatal: true },
  { name: 'verse pages', script: 'gen-verses.js', fatal: true },
  { name: 'static files', script: 'gen-static.js', fatal: true },
  { name: 'app stats', script: 'sync-app-stats.js', fatal: false },
  { name: 'asset versions', script: 'gen-asset-versions.js', fatal: true },
  { name: 'sitemap', script: 'gen-sitemap.js', fatal: true },
  { name: 'indexnow', script: 'ping-indexnow.js', fatal: false }
];

let failed = 0;

for (const step of STEPS) {
  console.log('\n--- ' + step.name + ' ---');
  const res = spawnSync(process.execPath, [path.join(__dirname, step.script)], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  if (res.status !== 0) {
    if (step.fatal) {
      console.error('\nbuild: "' + step.name + '" failed (exit ' + res.status + '). Stopping.');
      process.exit(res.status || 1);
    }
    console.warn('build: "' + step.name + '" exited ' + res.status + ' — continuing.');
    failed++;
  }
}

console.log('\nbuild: done' + (failed ? ' (' + failed + ' non-fatal step(s) reported problems)' : ''));
