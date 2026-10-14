// Checks that every listing in the chapter Markdown is byte-identical to its file in this folder.
//   node check-listings.mjs path/to/WebMCP_Ch10_WebMCP_in_Frameworks.md
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const md = readFileSync(process.argv[2] ?? '../../../webmcp-book/chapters/10-webmcp-in-frameworks/WebMCP_Ch10_WebMCP_in_Frameworks.md', 'utf8');
const here = import.meta.dirname;
const re = /\*\*Listing (10\.\d+) — [^(]*\(([^)]+)\)\*\*\n\n```\w*\n([\s\S]*?)\n```/g;
let n = 0, bad = 0;
for (const [, num, path, code] of md.matchAll(re)) {
  const file = path.startsWith('angular/') ? join(here, path) : join(here, 'trailhead-react', path);
  const actual = readFileSync(file, 'utf8').replace(/\n$/, '');
  n++;
  if (actual === code) console.log(`  ✓ Listing ${num} = ${path}`);
  else { bad++; console.log(`  ✗ Listing ${num} differs from ${path}`); }
}
console.log(`\n${n} listings checked, ${bad} different`);
process.exit(bad || n === 0 ? 1 : 0);
