// server.js: serves Fjord Table with the headers a WebMCP deployment needs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
                '.css': 'text/css', '.json': 'application/json' };

export function deploymentHeaders(env = process.env) {
  const headers = {
    // Who may register tools: this origin only (the default, stated explicitly).
    'Permissions-Policy': env.TOOLS_POLICY ?? 'tools=(self)'
  };
  // The WebMCP origin-trial token registered for this origin (Chrome 149–162).
  if (env.WEBMCP_OT_TOKEN) headers['Origin-Trial'] = env.WEBMCP_OT_TOKEN;
  return headers;
}

export function createFjordServer(env = process.env) {
  return createServer(async (req, res) => {
    const path = normalize(new URL(req.url, 'http://x').pathname).replace(/^[/\\]+/, '');
    const file = path === '' ? 'index.html' : path;
    try {
      const body = await readFile(join(ROOT, file));
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
                           ...(file.endsWith('.html') ? deploymentHeaders(env) : {}) });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createFjordServer().listen(port, () => console.log(`Fjord Table on http://localhost:${port}/`));
}
