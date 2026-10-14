import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const support = await readFile(new URL('../webmcp-support.js', import.meta.url), 'utf8');
const page = `<!doctype html><title>Trailhead</title>
<script type="module">
  import { detectWebMCP, registerIfSupported } from '/webmcp-support.js';
  window.result = await registerIfSupported([{
    name: 'search_products',
    description: 'Search the Trailhead catalogue by keyword.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    execute: async ({ query }) => ({ results: [], query }),
  }]);
  window.listed = window.result.registered.length
    ? (await document.modelContext.getTools()).map((t) => t.name) : [];
  window.done = true;
</script>`;

let server, base;
before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/webmcp-support.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end(support);
    }
    const headers = { 'content-type': 'text/html' };
    if (req.url === '/blocked') headers['permissions-policy'] = 'tools=()';
    res.writeHead(200, headers);
    res.end(page);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function run(args, path = '/', initScript) {
  const browser = await chromium.launch({ args });
  try {
    const tab = await browser.newPage();
    if (initScript) await tab.addInitScript(initScript);
    await tab.goto(base + path);
    await tab.waitForFunction(() => window.done === true, null, { timeout: 10_000 });
    return { version: browser.version(), ...(await tab.evaluate(() => ({ ...window.result, listed: window.listed }))) };
  } finally {
    await browser.close();
  }
}

test('Chromium with WebMCPTesting: full surface detected, tool registered', async () => {
  const r = await run(['--enable-features=WebMCPTesting']);
  console.log(`  Chromium ${r.version}:`, JSON.stringify(r.support));
  assert.equal(r.support.available, true);
  assert.deepEqual(r.support.methods, ['registerTool', 'getTools', 'executeTool']);
  assert.deepEqual(r.support.events, ['toolchange', 'toolactivated', 'toolcancel']);
  assert.equal(r.support.policyAllows, true);
  assert.equal(r.support.legacyNavigator, false);
  assert.deepEqual(r.registered, ['search_products']);
  assert.deepEqual(r.listed, ['search_products']);
});

test('Permissions-Policy: tools=() blocks registration before any call', async () => {
  const r = await run(['--enable-features=WebMCPTesting'], '/blocked');
  assert.equal(r.support.available, true);
  assert.equal(r.support.policyAllows, false);
  assert.deepEqual(r.registered, []);
});

test('Chromium without the feature: page still works, nothing registered', async () => {
  const r = await run([]);
  assert.equal(r.support.available, false);
  assert.equal(r.support.policyAllows, null);
  assert.deepEqual(r.registered, []);
});

test('mock of a pre-May-2026 build: legacy navigator surface is reported, not used', async () => {
  // Dev-only mock: an old build exposed navigator.modelContext instead of document.modelContext.
  const r = await run([], '/', () => {
    Object.defineProperty(Navigator.prototype, 'modelContext', { get: () => ({ registerTool() {} }) });
  });
  assert.equal(r.support.legacyNavigator, true);
  assert.equal(r.support.available, false);
  assert.deepEqual(r.registered, []);
});
