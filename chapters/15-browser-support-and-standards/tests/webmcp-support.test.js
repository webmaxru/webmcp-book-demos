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

test('Chromium 156: waitForToolsUntil is absent and the optional call does not throw', async () => {
  const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
  try {
    const tab = await browser.newPage();
    await tab.goto(base + '/');
    await tab.waitForFunction(() => window.done === true, null, { timeout: 10_000 });
    const observed = await tab.evaluate(async () => {
      const { detectWebMCP } = await import('/webmcp-support.js');
      const mc = document.modelContext;
      let threw = false;
      let value = 'unset';
      try { value = mc.waitForToolsUntil?.(); }
      catch (err) { threw = true; value = err.name; }
      return {
        version: navigator.userAgent,
        type: typeof mc.waitForToolsUntil,
        threw,
        value,
        methods: detectWebMCP().methods,
      };
    });
    assert.equal(observed.type, 'undefined');
    assert.equal(observed.threw, false);
    assert.equal(observed.value, undefined);
    assert.deepEqual(observed.methods, ['registerTool', 'getTools', 'executeTool']);
  } finally {
    await browser.close();
  }
});

test('Chrome 160 shim: detectWebMCP lists waitForToolsUntil(promise)', async () => {
  const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
  try {
    const tab = await browser.newPage();
    await tab.goto(base + '/');
    await tab.waitForFunction(() => window.done === true, null, { timeout: 10_000 });
    const observed = await tab.evaluate(async () => {
      const mc = document.modelContext;
      const seen = [];
      Object.defineProperty(mc, 'waitForToolsUntil', {
        configurable: true,
        writable: true,
        value(promise) {
          seen.push(promise != null && typeof promise.then === 'function');
        },
      });
      const { detectWebMCP } = await import('/webmcp-support.js');
      const methods = detectWebMCP().methods;
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      const registration = (async () => {
        await mc.registerTool({
          name: 'detect_probe',
          description: 'Feature-detection probe.',
          execute: async () => ({ ok: true }),
        });
        await gate;
      })();
      let settled = false;
      registration.then(() => { settled = true; }, () => { settled = true; });
      mc.waitForToolsUntil(registration);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const pendingWhileRegistering = seen[0] === true && settled === false;
      release();
      let threw = false;
      try { await registration; }
      catch (err) { threw = err.name; }
      return { methods, sawPromise: seen[0], calls: seen.length, pendingWhileRegistering, threw };
    });
    assert.deepEqual(observed.methods, ['registerTool', 'getTools', 'executeTool', 'waitForToolsUntil']);
    assert.equal(observed.sawPromise, true);
    assert.equal(observed.calls, 1);
    assert.equal(observed.pendingWhileRegistering, true);
    assert.equal(observed.threw, false);
  } finally {
    await browser.close();
  }
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
