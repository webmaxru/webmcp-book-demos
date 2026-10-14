// Chapter 7 tests: syntax, a mock unit test of the agent loop, the full two-origin
// flow in real Chromium with WebMCP (--enable-features=WebMCPTesting), and the
// extension agent loaded unpacked into full Chromium.
// Run: npm install && npx playwright install chromium && npm test
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start, LEDGERLY, SUPPORTLY, rewrite } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name); }
  catch (e) { results.push(['FAIL', name]); console.log('FAIL', name, '\n   ', e.message.split('\n').slice(0, 6).join('\n    ')); }
}
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(`timeout: ${what}`)), ms))]);

// 1. Syntax
const jsFiles = ['supportly/widget-tools.js', 'supportly/helpdesk-api.js', 'supportly/widget-ui.js',
  'ledgerly/agent/discover.js', 'ledgerly/agent/run-tool.js', 'ledgerly/agent/agent-loop.js',
  'ledgerly/agent/assistant.js', 'ledgerly/agent/rule-planner.js',
  'extension/content-script.js', 'extension/background.js'];
for (const f of jsFiles) {
  await test(`syntax: ${f}`, () => { execFileSync(process.execPath, ['--check', path.join(root, f)], { timeout: 20000 }); });
}
await test('syntax: extension/manifest.json is valid JSON', () => { JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8')); });

const stop = start();
const frameOf = (page) => page.frames().find((f) => f.url().startsWith(SUPPORTLY));
async function open(browser, query = '') {
  const page = await browser.newPage();
  await page.goto(`${LEDGERLY}/index.html${query}`);
  await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const widget = frameOf(page);
  await widget.waitForFunction(() => document.body.dataset.tools, null, { timeout: 10000 });
  return { page, widget };
}

try {
  // 2. Mock: agent loop logic without WebMCP
  const plain = await chromium.launch();
  await test('mock: agent loop calls a tool and returns the planner answer', async () => {
    const ctx = await plain.newContext();
    await ctx.addInitScript({ path: path.join(root, 'tests/mock-model-context.js') });
    const page = await ctx.newPage();
    await page.goto(`${LEDGERLY}/index.html?pp=off`);
    await page.waitForFunction(() => window.ledgerlyAgent, null, { timeout: 10000 });
    const out = await page.evaluate(async () => {
      const { runAgent } = await import('./agent/agent-loop.js');
      const { runTool } = await import('./agent/run-tool.js');
      let seen;
      const planner = { async next({ history, tools }) {
        seen = tools;
        return history.length === 1 ? { call: 'ledgerly__find_invoice', args: { number: '2026-118' } } : { answer: 'done' };
      } };
      const h = await runAgent('find invoice 2026-118', planner, { stop: new AbortController().signal });
      await document.modelContext.registerTool({ name: 'boom', description: 'throws', async execute() { throw new Error('secret stack'); } });
      await document.modelContext.registerTool({ name: 'hang', description: 'never ends', annotations: { consequentialHint: true }, execute: () => new Promise(() => {}) });
      const [boom] = (await document.modelContext.getTools()).filter((t) => t.name === 'boom');
      const [hang] = (await document.modelContext.getTools()).filter((t) => t.name === 'hang');
      const failed = await runTool(boom, {}, { stop: new AbortController().signal });
      const timedOut = await runTool(hang, {}, { stop: new AbortController().signal, timeoutMs: 200 });
      const userStop = new AbortController(); setTimeout(() => userStop.abort(), 100);
      const stopped = await runTool(hang, {}, { stop: userStop.signal, timeoutMs: 5000 });
      const missing = await runAgent('x', { next: async ({ history }) => history.length === 1 ? { call: 'nope' } : { answer: 'ok' } }, { stop: new AbortController().signal });
      return { decl: seen.map((t) => t.name), h, failed, timedOut, stopped, missing: missing[1].result };
    });
    assert.deepEqual(out.decl, ['ledgerly__find_invoice']);
    assert.equal(out.h[1].result.ok, true);
    assert.equal(out.h[1].result.value.status, 'unpaid');
    assert.equal(out.h[2].text, 'done');
    assert.deepEqual([out.failed.ok, out.failed.reason, out.failed.retryable], [false, 'UnknownError', true]);
    assert.deepEqual([out.timedOut.reason, out.timedOut.retryable], ['timed out', false]);
    assert.deepEqual([out.stopped.reason, out.stopped.retryable], ['stopped by user', false]);
    assert.equal(out.missing.reason, 'no tool called nope');
    await ctx.close();
  });
  await plain.close();

  // 3. Real Chromium with WebMCP, two origins
  const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
  console.log('Chromium', browser.version());

  await test('chromium: widget registers its tools inside the iframe (allow="tools" + policy)', async () => {
    const { page, widget } = await open(browser);
    assert.equal(await widget.evaluate(() => document.body.dataset.tools), 'registered');
    await page.close();
  });

  await test('chromium: getTools() without fromOrigins returns only same-origin tools', async () => {
    const { page } = await open(browser);
    const names = await page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name));
    assert.deepEqual(names, ['find_invoice']);
    await page.close();
  });

  await test('chromium: discoverTools() (Listing 7.4) merges both origins, keyed by vendor', async () => {
    const { page } = await open(browser);
    const out = await page.evaluate(async () => {
      const { discoverTools } = await import('./agent/discover.js');
      const c = await discoverTools();
      const t = c.get('supportly__get_ticket_status');
      return { keys: [...c.keys()].sort(), origin: t.origin, ann: t.annotations, isFrame: t.window === document.getElementById('supportly').contentWindow };
    });
    assert.deepEqual(out.keys, ['ledgerly__find_invoice', 'supportly__create_ticket', 'supportly__get_ticket_status', 'supportly__search_articles']);
    assert.equal(out.origin, SUPPORTLY);
    assert.equal(out.ann.untrustedContentHint, true);
    assert.equal(out.isFrame, true);
    await page.close();
  });

  await test('chromium: watchTools() saw the toolchange events and built the catalog', async () => {
    const { page } = await open(browser);
    await page.waitForFunction(() => (document.body.dataset.catalog ?? '').includes('supportly__create_ticket'), null, { timeout: 5000 });
    await page.close();
  });

  await test('chromium: search_articles via runTool (Listing 7.5) returns parsed JSON', async () => {
    const { page } = await open(browser);
    const r = await page.evaluate(async () => {
      const { discoverTools } = await import('./agent/discover.js');
      const { runTool } = await import('./agent/run-tool.js');
      const c = await discoverTools();
      return runTool(c.get('supportly__search_articles'), { query: 'export invoices csv' }, { stop: new AbortController().signal });
    });
    assert.equal(r.ok, true);
    assert.equal(r.untrusted, false);
    assert.equal(r.value.articles[0].title, 'Exporting invoices to CSV');
    await page.close();
  });

  await test('chromium: agent loop opens a ticket; the user confirms inside the widget', async () => {
    const { page, widget } = await open(browser);
    const done = page.evaluate(async () => {
      const { runAgent } = await import('./agent/agent-loop.js');
      const { rulePlanner } = await import('./agent/rule-planner.js');
      return runAgent('Please open a ticket: CSV export is missing the VAT column', rulePlanner, { stop: new AbortController().signal });
    });
    await widget.waitForSelector('#send-ticket', { timeout: 5000 });
    assert.match(await widget.textContent('.confirm .subject'), /CSV export/);
    await widget.click('#send-ticket');
    const h = await withTimeout(done, 5000, 'agent loop');
    assert.equal(h[1].name, 'supportly__create_ticket');
    assert.equal(h[1].result.value.status, 'created');
    assert.match(h[1].result.value.ticketId, /^SUP-\d+$/);
    await page.close();
  });

  await test('chromium: get_ticket_status result is flagged untrusted', async () => {
    const { page } = await open(browser);
    const r = await page.evaluate(async () => {
      const { discoverTools } = await import('./agent/discover.js');
      const { runTool } = await import('./agent/run-tool.js');
      return runTool((await discoverTools()).get('supportly__get_ticket_status'), { ticketId: 'SUP-1042' }, { stop: new AbortController().signal });
    });
    assert.deepEqual([r.ok, r.untrusted, r.value.status], [true, true, 'waiting_on_customer']);
    await page.close();
  });

  await test('chromium: user stop cancels the call; the widget gets toolcancel and removes its card', async () => {
    const { page, widget } = await open(browser);
    await widget.evaluate(() => { window.cancels = []; document.modelContext.addEventListener('toolcancel', (e) => cancels.push(e.toolName)); });
    const pending = page.evaluate(async () => {
      const { discoverTools } = await import('./agent/discover.js');
      const { runTool } = await import('./agent/run-tool.js');
      window.userStop = new AbortController();
      return runTool((await discoverTools()).get('supportly__create_ticket'), { subject: 'Test', body: 'Body', priority: 'low' }, { stop: window.userStop.signal });
    });
    await widget.waitForSelector('#send-ticket', { timeout: 5000 });
    await page.evaluate(() => window.userStop.abort());
    const r = await withTimeout(pending, 5000, 'stop');
    assert.deepEqual([r.ok, r.reason, r.retryable], [false, 'stopped by user', false]);
    await widget.waitForFunction(() => !document.querySelector('.confirm') && window.cancels.includes('create_ticket'), null, { timeout: 3000 });
    await page.close();
  });

  await test('chromium: a deadline turns an unanswered confirmation into "timed out"', async () => {
    const { page } = await open(browser);
    const r = await page.evaluate(async () => {
      const { discoverTools } = await import('./agent/discover.js');
      const { runTool } = await import('./agent/run-tool.js');
      return runTool((await discoverTools()).get('supportly__create_ticket'), { subject: 'T', body: 'B', priority: 'high' }, { stop: new AbortController().signal, timeoutMs: 400 });
    });
    assert.deepEqual([r.reason, r.retryable], ['timed out', false]);
    await page.close();
  });

  await test('chromium: recoverable input errors come back as values', async () => {
    const { page } = await open(browser);
    const r = await page.evaluate(async () => {
      const { discoverTools } = await import('./agent/discover.js');
      const { runTool } = await import('./agent/run-tool.js');
      return runTool((await discoverTools()).get('supportly__create_ticket'), { subject: 'x', body: 'y', priority: 'urgent' }, { stop: new AbortController().signal });
    });
    assert.deepEqual([r.ok, r.value.error], [true, 'priority must be low, normal or high']);
    await page.close();
  });

  await test('chromium: without allow="tools" the widget cannot register (NotAllowedError -> "blocked")', async () => {
    const { page, widget } = await open(browser, '?noallow');
    assert.equal(await widget.evaluate(() => document.body.dataset.tools), 'blocked');
    assert.equal(await widget.evaluate(() => 'modelContext' in document), true);   // feature detection still says yes
    await page.close();
  });

  await test('chromium: Permissions-Policy: tools=() disables the page and every frame', async () => {
    const { page, widget } = await open(browser, '?pp=none');
    assert.equal(await widget.evaluate(() => document.body.dataset.tools), 'blocked');
    const e = await page.evaluate(async () => { try { await document.modelContext.getTools(); return 'resolved'; } catch (err) { return err.name; } });
    assert.equal(e, 'NotAllowedError');
    await page.close();
  });

  await test('chromium: tools=(self) in the header overrides allow="tools" on the iframe', async () => {
    // A policy that does not list Supportly.
    const { page, widget } = await open(browser, '?pp=self');
    assert.equal(await widget.evaluate(() => document.body.dataset.tools), 'blocked');
    await page.close();
  });

  await test('chromium: an unknown customer gets an empty exposedTo, so Ledgerly sees no Supportly tools', async () => {
    const { page, widget } = await open(browser, '?customer=acme');
    assert.equal(await widget.evaluate(() => document.body.dataset.tools), 'registered');
    const keys = await page.evaluate(async () => [...(await (await import('./agent/discover.js')).discoverTools()).keys()]);
    assert.deepEqual(keys, ['ledgerly__find_invoice']);
    await page.close();
  });

  await test('chromium: exposedTo/fromOrigins reject non-secure origins with SecurityError', async () => {
    const { page, widget } = await open(browser);
    const a = await widget.evaluate(async () => { try { await document.modelContext.registerTool({ name: 'x', description: 'x', execute: async () => 1 }, { exposedTo: ['http://ledgerly.example'] }); return 'ok'; } catch (e) { return e.name; } });
    const b = await page.evaluate(async () => { try { await document.modelContext.getTools({ fromOrigins: ['http://widget.supportly.example'] }); return 'ok'; } catch (e) { return e.name; } });
    assert.deepEqual([a, b], ['SecurityError', 'SecurityError']);
    await page.close();
  });

  await test('chromium: a thrown error crosses origins as a bare exception name', async () => {
    const { page, widget } = await open(browser);
    await widget.evaluate(async (L) => { await document.modelContext.registerTool({ name: 'crash', description: 'throws', async execute() { throw new Error('db password is hunter2'); } }, { exposedTo: [L] }); }, LEDGERLY);
    const r = await page.evaluate(async (S) => {
      const t = (await document.modelContext.getTools({ fromOrigins: [S] })).find((x) => x.name === 'crash');
      try { await document.modelContext.executeTool(t, {}); return 'resolved'; } catch (e) { return `${e.name}: ${e.message}`; }
    }, SUPPORTLY);
    assert.match(r, /^UnknownError: /);
    assert.doesNotMatch(r, /hunter2/);
    await page.close();
  });
  await browser.close();

  // 4. The extension (Listings 7.7–7.9) in full Chromium
  await test('extension: content scripts in both frames report their own tools; the worker runs one', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ch7-ext-'));
    for (const f of ['manifest.json', 'content-script.js', 'background.js']) {
      let text = fs.readFileSync(path.join(root, 'extension', f), 'utf8');
      // Match patterns take no port; point them at the local hosts.
      text = text.replace('https://app.ledgerly.example/*', 'http://localhost/*').replace('https://widget.supportly.example/*', 'http://127.0.0.1/*');
      fs.writeFileSync(path.join(dir, f), rewrite(text));
    }
    const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'ch7-prof-')), {
      channel: 'chromium', headless: true,
      args: ['--enable-features=WebMCPTesting', `--disable-extensions-except=${dir}`, `--load-extension=${dir}`],
    });
    try {
      let [sw] = ctx.serviceWorkers();
      sw ??= await ctx.waitForEvent('serviceworker', { timeout: 10000 });
      const page = await ctx.newPage();
      await page.goto(`${LEDGERLY}/index.html`);
      const deadline = Date.now() + 8000;
      let frames = [];
      while (Date.now() < deadline) {
        frames = await sw.evaluate(() => [...self.toolInspector.frames].map(([k, v]) => [k, v.origin, v.tools.map((t) => t.name), v.error ?? null]));
        if (frames.some(([, o, names]) => o === 'http://127.0.0.1:47102' && names.length === 3) && frames.some(([, o, n]) => o === 'http://localhost:47101' && n.length)) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      const sup = frames.find(([, o]) => o === SUPPORTLY);
      const led = frames.find(([, o]) => o === LEDGERLY);
      assert.ok(sup && led, `frames seen: ${JSON.stringify(frames)}`);
      assert.deepEqual(sup[2], ['create_ticket', 'get_ticket_status', 'search_articles']);
      assert.deepEqual(led[2], ['find_invoice']);
      const [tabId, frameId] = sup[0].split(':').map(Number);
      const reply = await sw.evaluate(([t, f]) => self.toolInspector.runTool(t, f, 'search_articles', { query: 'bank' }), [tabId, frameId]);
      assert.equal(JSON.parse(reply.result).articles[0].title, 'Connecting your bank account');
      console.log('   extension saw:', JSON.stringify(frames));
    } finally { await ctx.close(); }
  });
} finally {
  stop();
}

const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
