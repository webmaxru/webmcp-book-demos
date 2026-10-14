// The eval harness itself, tested with scripted agents (no model, no API key).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { runSuite, scoreTrajectory } from '../evals/run-evals.js';
import { matchesArgument } from '../evals/matcher.js';
import { fjordTablePage } from '../evals/fjord-table-page.js';
import { scriptedAgent } from './fixtures/scripted-agents.js';
import { serve } from './fixtures/serve.js';

const suite = JSON.parse(await readFile(new URL('../evals/fjord-table.evals.json', import.meta.url)));
let browser, site;
before(async () => {
  site = await serve(new URL('../../../fjord-table/', import.meta.url));
  browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
});
after(async () => { await browser?.close(); await site?.close(); });

test('matcher: subset objects, strict arrays, constraints', () => {
  assert.ok(matchesArgument({ date: '2026-11-20' }, { date: '2026-11-20', partySize: 2 }));
  assert.ok(!matchesArgument({ tags: ['a'] }, { tags: ['a', 'b'] }));
  assert.ok(matchesArgument({ time: { $pattern: '^19:' } }, { time: '19:30' }));
  assert.ok(!matchesArgument({ partySize: { $lte: 4 } }, { partySize: '4' }));
  assert.ok(matchesArgument({ notes: { $contains: 'birthday' } }, { notes: 'mum’s birthday' }));
});

test('scorer: order matters, optional calls may be skipped', () => {
  const expected = [{ functionName: 'a', arguments: {}, optional: true },
                    { functionName: 'b', arguments: { x: 1 } }];
  assert.ok(scoreTrajectory(expected, [{ functionName: 'b', arguments: { x: 1 } }]).ok);
  assert.ok(!scoreTrajectory(expected, [{ functionName: 'b', arguments: { x: 2 } }]).ok);
  assert.ok(!scoreTrajectory(expected, []).ok);
});

test('a careful agent passes every case against the live page', async () => {
  const report = await runSuite({ suite, runs: 2, agent: scriptedAgent('careful'),
                                  openPage: fjordTablePage(browser, site.url) });
  for (const r of report) assert.equal(r.passRate, 1, `${r.name}: ${r.failures.join('; ')}`);
});

test('a sloppy agent is caught, with a reason', async () => {
  const report = await runSuite({ suite, runs: 1, agent: scriptedAgent('sloppy'),
                                  openPage: fjordTablePage(browser, site.url) });
  assert.ok(report.every((r) => r.passRate === 0));
  assert.match(report[0].failures[0], /20\/11\/2026/);
});

test('the right calls are not enough: if nothing was booked, the case fails', async () => {
  const report = await runSuite({ suite, runs: 1, agent: scriptedAgent('careful'),
                                  openPage: fjordTablePage(browser, site.url, { human: 'cancels' }) });
  assert.equal(report[0].passRate, 1);                     // a search changes nothing
  assert.equal(report[1].passRate, 0);
  assert.match(report[1].failures[0], /#confirmation/);
  assert.match(report[2].failures[0], /#my-bookings li: expected count 1, saw 0/);
});
