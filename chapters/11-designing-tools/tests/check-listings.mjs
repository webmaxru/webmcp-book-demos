// Checks that every listing in the Chapter 11 Markdown is byte-identical to its file here
// (apart from the final newline). Usage:
//   node tests/check-listings.mjs [path/to/manuscript/11-designing-tools.md]
// Without a path it reads CHAPTER_MD, or else downloads the chapter from the book repository.
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_MD = 'https://raw.githubusercontent.com/vibeprogrammer/webmcp-book/main/manuscript/11-designing-tools.md';
const src = process.argv[2] ?? process.env.CHAPTER_MD;
const md = src ? await readFile(src, 'utf8') : await (await fetch(URL_MD, { signal: AbortSignal.timeout(20000) })).text();

const re = /\*\*Listing (11\.\d+)\*\* `([^`\n]+\.js)` — [^\n]*\n\n```js\n([\s\S]*?)\n```/g;
let count = 0, failed = 0;
for (const [, n, file, code] of md.matchAll(re)) {
  count++;
  const actual = (await readFile(join(root, file), 'utf8')).replace(/\n$/, '');
  const ok = actual === code;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} Listing ${n} = ${file}`);
}
console.log(`${count - failed}/${count} listings match`);
process.exit(failed || count === 0 ? 1 : 0);
