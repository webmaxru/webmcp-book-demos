// Checks that every listing in the chapter Markdown is byte-identical to its file in this folder.
//   node check-listings.mjs path/to/manuscript/10-webmcp-in-frameworks.md
// A listing is a label line "**Listing 10.N** `path/in/this/folder` — title" directly above a fenced block.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const md = readFileSync(process.argv[2] ?? '../../../book/manuscript/10-webmcp-in-frameworks.md', 'utf8');
const here = import.meta.dirname;
// Listings 10.1–10.11 are paths inside this folder. Listing 10.12's label is the
// repo-root path `chapters/10-webmcp-in-frameworks/on-route-change.js`.
function listingFile(path) {
  const stripped = path.replace(/^chapters\/10-webmcp-in-frameworks\//, '');
  for (const candidate of [join(here, path), join(here, stripped)]) {
    if (existsSync(candidate)) return candidate;
  }
  return join(here, stripped);
}
const re = /\*\*Listing (10\.\d+)\*\* `([^`]+)` — [^\n]*\n\n```\w*\n([\s\S]*?)\n```/g;
let n = 0, bad = 0;
for (const [, num, path, code] of md.matchAll(re)) {
  const actual = readFileSync(listingFile(path), 'utf8').replace(/\n$/, '');
  n++;
  if (actual === code) console.log(`  ✓ Listing ${num} = ${path}`);
  else { bad++; console.log(`  ✗ Listing ${num} differs from ${path}`); }
}
console.log(`\n${n} listings checked, ${bad} different`);
process.exit(bad || n === 0 ? 1 : 0);
