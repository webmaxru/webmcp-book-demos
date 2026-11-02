import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, diff } from '../standards-watch.mjs';

const fx = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('spec status line is read from the document header', async () => {
  assert.equal(parse.spec(await fx('spec-head.html')), 'Draft Community Group Report, 14 October 2026');
});

test('newest spec commit comes from the Atom feed', async () => {
  assert.equal(parse.commits(await fx('commits.atom')),
    "2026-10-14T22:00:40Z Fix inactive document unregistration's notification algorithm (#345)");
});

test('chromestatus: origin trial range includes the extension', async () => {
  assert.deepEqual(parse.chromestatus(await fx('chromestatus.json')), { trialFrom: 149, trialThrough: 162 });
});

test('Edge origin trial expiry date', async () => {
  assert.equal(parse.edgeTrial(await fx('edge-trial.html')), 'March 30, 2027');
});

test('only current labels count, not removed ones in the timeline', async () => {
  const labels = parse.labels(['Progress:', 'Missing:'])(await fx('tag-issue.html'));
  assert.deepEqual(labels, ['Missing: Multi-stakeholder support', 'Progress: in progress']);
});

test('charter stage comes from the strategy issue labels', async () => {
  assert.deepEqual(parse.labels(['In Charter', 'AC review', 'Council'])(await fx('charter-issue.html')),
    ['In Charter Refinement']);
});

test('diff reports exactly the sources that changed', () => {
  const before = { spec: 'Draft Community Group Report, 13 October 2026', webkit: ['position: oppose'] };
  const after = { spec: 'Draft Community Group Report, 14 October 2026', webkit: ['position: oppose'] };
  assert.deepEqual(diff(before, after).map((c) => c.source).filter((s) => s in after), ['spec']);
});
