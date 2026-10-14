// Dev server for the chapter 7 demo: two local origins stand in for the two companies.
//   Ledgerly  https://app.ledgerly.example     -> http://localhost:47101  (serves ledgerly/)
//   Supportly https://widget.supportly.example -> http://127.0.0.1:47102  (serves supportly/)
// Files are served byte-for-byte as in the book, except that the two production origins
// are rewritten to the local ones on the way out. Ledgerly pages get the
// Permissions-Policy header from ledgerly/permissions-policy.txt (Listing 7.2).
// Test-only switches on Ledgerly's index.html: ?pp=none (tools=()), ?pp=self (tools=(self)), ?pp=off (no header),
// ?noallow (drop allow="tools"), ?customer=<id> (change the widget's customer).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
export const LEDGERLY = 'http://localhost:47101';
export const SUPPORTLY = 'http://127.0.0.1:47102';
const REWRITES = [
  ['https://app.ledgerly.example', LEDGERLY],
  ['https://widget.supportly.example', SUPPORTLY],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain' };
export const rewrite = (s) => REWRITES.reduce((acc, [from, to]) => acc.split(from).join(to), s);

function site(dir, isLedgerly) {
  return (req, res) => {
    const url = new URL(req.url, 'http://x');
    let file = path.join(root, dir, decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(root, dir))) { res.writeHead(403); return res.end(); }
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, 'utf8', (err, text) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      const ext = path.extname(file);
      const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' };
      let body = rewrite(text);
      if (isLedgerly && ext === '.html') {
        const pp = url.searchParams.get('pp');
        const policy = rewrite(fs.readFileSync(path.join(root, 'ledgerly/permissions-policy.txt'), 'utf8')).trim();
        if (pp === 'none') headers['permissions-policy'] = 'tools=()';
        else if (pp === 'self') headers['permissions-policy'] = 'tools=(self)';
        else if (pp !== 'off') headers['permissions-policy'] = policy.replace(/^Permissions-Policy:\s*/i, '');
        if (url.searchParams.has('noallow')) body = body.replace(' allow="tools"', '');
        const customer = url.searchParams.get('customer');
        if (customer) body = body.replace('customer=ledgerly', `customer=${encodeURIComponent(customer)}`);
      }
      res.writeHead(200, headers);
      res.end(body);
    });
  };
}

export function start() {
  const a = http.createServer(site('ledgerly', true)).listen(47101);
  const b = http.createServer(site('supportly', false)).listen(47102);
  return () => { a.close(); b.close(); };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
  console.log(`Ledgerly:  ${LEDGERLY}/\nSupportly: ${SUPPORTLY}/embed.html?customer=ledgerly`);
}
