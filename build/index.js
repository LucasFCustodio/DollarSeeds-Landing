'use strict';

/**
 * Netlify build entry point (`npm run build`).
 *
 * Order matters:
 *   1. images       — derivatives must exist before anything references them
 *   2. static       — robots.txt / llms.txt / AASA / IndexNow key
 *   3. app-stats    — rewrites the trust bar and the JSON-LD from the live rating
 *   4. sitemap      — reads git dates, and syncs lesson dateModified to match
 *   5. indexnow     — announces the deploy, production only, last
 *
 * Steps 3 and 5 reach the network and are written to degrade quietly: a failed
 * fetch logs a warning and leaves the committed files alone. Steps 1, 2 and 4
 * are local and deterministic, so a failure there is a real error and should
 * stop the build.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const STEPS = [
  { name: 'images', script: 'gen-images.js', fatal: true },
  { name: 'static files', script: 'gen-static.js', fatal: true },
  { name: 'app stats', script: 'sync-app-stats.js', fatal: false },
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
