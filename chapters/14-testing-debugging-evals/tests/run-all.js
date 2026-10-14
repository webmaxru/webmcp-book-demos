// npm test: every check for the Chapter 14 examples, in order.
//  1. node --check on every JavaScript file
//  2. unit tests (no browser)                       tests/trailhead-tools.test.js
//  3. instrumentTool() with the dev mock            tests/rum.test.js
//  4. the same with Chromium's own WebMCP           WEBMCP=chrome tests/rum.test.js
//  5. Fjord Table over the WebMCP DevTools domain   tests/fjord-table.cdp.test.js
//  6. the eval harness with scripted agents         tests/evals.test.js
// Steps 4-6 launch Chromium with --enable-features=WebMCPTesting.
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const jsFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (name === 'node_modules') return [];
  return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
});

const steps = [
  ...jsFiles(ROOT).map((f) => [`node --check ${relative(ROOT, f)}`, ['--check', f], {}]),
  ['unit tests', ['--test', 'tests/trailhead-tools.test.js'], {}],
  ['RUM, mock WebMCP', ['--test', 'tests/rum.test.js'], {}],
  ['RUM, Chromium WebMCP', ['--test', 'tests/rum.test.js'], { WEBMCP: 'chrome' }],
  ['Fjord Table over CDP', ['--test', 'tests/fjord-table.cdp.test.js'], {}],
  ['eval harness', ['--test', 'tests/evals.test.js'], {}]
];

let failed = 0;
for (const [label, args, env] of steps) {
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 180_000,
                                                 env: { ...process.env, ...env } });
  const ok = r.status === 0;
  if (!ok) failed++;
  const summary = (r.stdout.match(/^# (pass|fail) \d+$/gm) ?? []).join(', ');
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${summary ? `  (${summary.replaceAll('# ', '')})` : ''}`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').filter((l) => /not ok|Error|error:/.test(l)).slice(0, 15).join('\n'));
}
console.log(failed ? `\n${failed} step(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
