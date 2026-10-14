// Support code for the tests (not a listing): a tiny static file server and
// a date on which Fjord Table's fake backend has open tables.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.json': 'application/json', '.png': 'image/png' };

export async function serve(rootUrl) {
  const root = fileURLToPath(rootUrl);
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname))
      .replace(/^([/\\])+/, '') || 'index.html';
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // localhost is a secure context, which WebMCP requires.
  return { url: `http://localhost:${server.address().port}/`,
           close: () => new Promise((r) => server.close(r)) };
}

// Fjord Table's fake backend is closed on Mondays: pick the first other day >= 2 days ahead.
export function nextOpenDate() {
  const d = new Date(Date.now() + 2 * 86400000);
  while (d.getDay() === 1) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
