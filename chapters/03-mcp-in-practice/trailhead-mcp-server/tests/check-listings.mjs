// Checks that every numbered listing in the Chapter 3 Markdown is byte-identical
// to its file in this folder (ignoring the file's final newline).
// Usage: node tests/check-listings.mjs path/to/manuscript/03-mcp-in-practice.md
// Label format (book v2): **Listing 3.N** `trailhead-mcp-server/<file>` — title, a blank line, then the fence.
import { readFileSync } from 'node:fs';

const files = {
  '3.1': 'wire/listing-3-1.txt', '3.2': 'src/catalog.js', '3.3': 'src/tools.js',
  '3.4': 'src/context.js', '3.5': 'src/server.js', '3.6': 'src/stdio.js',
  '3.7': 'src/http.js', '3.8': 'src/client.js', '3.9': 'wire/listing-3-9.txt',
  '3.10': 'scripts/inspect.sh'
};
const md = readFileSync(process.argv[2], 'utf8');
const re = /\*\*Listing (3\.\d+)\*\*[^\n]*\n\n```\w*\n([\s\S]*?)\n```/g;
let seen = 0, bad = 0;
for (const [, id, body] of md.matchAll(re)) {
  seen++;
  const file = readFileSync(files[id], 'utf8').replace(/\n$/, '');
  const ok = file === body;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'DIFF'} Listing ${id} = ${files[id]}`);
}
console.log(`${seen} listings checked, ${bad} differ`);
process.exit(bad || seen !== Object.keys(files).length ? 1 : 0);
