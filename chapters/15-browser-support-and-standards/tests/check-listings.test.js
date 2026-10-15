// Checks that every listing in the chapter Markdown matches its file here, byte for byte
// (apart from the final newline). Point CHAPTER_MD at the chapter file to run it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const md = process.env.CHAPTER_MD;
const files = {
  '15.1': ['origin-trial-head.html', 'origin-trial.headers.txt'],
  '15.2': ['webmcp-support.js'],
  '15.3': ['standards-watch.mjs'],
  '15.4': ['snapshots/2026-10-15.json'],
};

test('listings match the files', { skip: !md || !existsSync(md) ? 'set CHAPTER_MD' : false }, async () => {
  const text = await readFile(md, 'utf8');
  for (const [n, names] of Object.entries(files)) {
    const start = text.indexOf(`**Listing ${n} —`);
    assert.ok(start >= 0, `Listing ${n} heading`);
    const next = text.indexOf('**Listing ', start + 10);
    const section = text.slice(start, next < 0 ? undefined : next);
    const blocks = [...section.matchAll(/```[a-z]*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
    for (const [i, name] of names.entries()) {
      const file = (await readFile(new URL(`../${name}`, import.meta.url), 'utf8')).replace(/\n$/, '');
      assert.equal(blocks[i], file, `Listing ${n} vs ${name}`);
    }
  }
});
