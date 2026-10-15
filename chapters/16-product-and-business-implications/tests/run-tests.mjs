// tests/run-tests.mjs: checks for the chapter 16 listings.
// Run from this folder:  npm install && npx playwright install chromium && npm test
//
// 1. Listing 16.5 against Listing 16.1, in Node (the budget check a CI job would run).
// 2. The page (tests/index.html + dist/), in Chromium:
//      npm test             WebMCP comes from dev/model-context-mock.js, injected before the page loads
//      npm run test:chrome  WebMCP comes from Chromium itself (--enable-features=WebMCPTesting); no mock
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REAL = process.env.WEBMCP === 'chrome';
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (err) { failures++; console.log(`FAIL ${name}\n     ${String(err.message).split('\n').slice(0, 12).join('\n     ')}`); }
}

// ---------------------------------------------------------------------------
// 1. Node: the catalog and its budgets
const { toolCatalog } = await import(pathToFileURL(join(ROOT, 'dist/tool-catalog.js')));
const { checkBudgets, BUDGET } = await import(pathToFileURL(join(ROOT, 'dist/check-budgets.js')));

await test('Listing 16.5: the Trailhead catalog is within Chrome\'s budgets', () => {
  assert.deepEqual(checkBudgets(toolCatalog), []);
  assert.deepEqual(BUDGET, { name: 30, description: 500, parameterDescription: 150 });
});
await test('Listing 16.5: catches a long description, a duplicate and a missing owner', () => {
  const bad = [
    { ...toolCatalog[0], description: 'x'.repeat(501) },
    { ...toolCatalog[0], owner: '' },
  ];
  const problems = checkBudgets(bad);
  assert.ok(problems.some((p) => /description is 501 characters/.test(p)), problems.join('; '));
  assert.ok(problems.some((p) => /duplicate name/.test(p)), problems.join('; '));
  assert.ok(problems.some((p) => /no owner or eval suite/.test(p)), problems.join('; '));
});
await test('Listing 16.1: names follow the spec\'s name rule and match the book\'s canonical tool set', () => {
  for (const t of toolCatalog) assert.match(t.name, /^[A-Za-z0-9_.\-]{1,128}$/);
  assert.deepEqual(toolCatalog.map((t) => t.name), ['search_products', 'compare_products', 'add_to_cart', 'get_cart', 'checkout']);
  assert.equal(toolCatalog.find((t) => t.name === 'checkout').annotations.consequentialHint, true);
});

// Listings in the chapter vs. the files here (byte for byte, apart from the final newline).
await test('listings: each listing in the chapter matches its file in src/', async () => {
  const md = process.env.CHAPTER_MD;
  if (!md) { console.log('     (skipped: set CHAPTER_MD to the chapter Markdown)'); return; }
  const text = await readFile(md, 'utf8');
  const found = [...text.matchAll(/\*\*Listing (16\.\d) — [^*]*?\(([^)]+)\)\*\*\s*\n\s*```[a-z]*\n([\s\S]*?)\n```/g)];
  assert.equal(found.length, 5, 'five listings');
  for (const [, n, file, code] of found) {
    const src = (await readFile(join(ROOT, 'src', file), 'utf8')).replace(/\n$/, '');
    assert.equal(code, src, `Listing ${n} vs src/${file}`);
  }
});

// ---------------------------------------------------------------------------
// 2. Browser
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE = `http://localhost:${server.address().port}/tests/index.html`;   // localhost is a secure context

const plain = await chromium.launch();
const webmcp = REAL ? await chromium.launch({ args: ['--enable-features=WebMCPTesting'] }) : plain;
console.log(`\nChromium ${plain.version()} · WebMCP from ${REAL ? 'the browser (flag)' : 'dev/model-context-mock.js'}`);

async function open({ withWebMCP }) {
  const context = await (withWebMCP ? webmcp : plain).newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (withWebMCP && !REAL) await page.addInitScript({ path: join(ROOT, 'dev/model-context-mock.js') });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__trailhead?.ready === true);
  return { page, errors, context };
}
// Calls a tool the way an in-page agent would: getTools() then executeTool().
const call = (page, name, input) => page.evaluate(async ([name, input]) => {
  const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
  try { return { json: await document.modelContext.executeTool(tool, input) }; }
  catch (e) { return { rejected: e.name }; }
}, [name, input]);
const records = (page) => page.evaluate(() => window.__trailhead.sent
  .filter((e) => e.type === 'webmcp_tool_call').map((e) => e.data));

await test('no WebMCP: the page loads cleanly and registers nothing', async () => {
  const { page, errors, context } = await open({ withWebMCP: false });
  assert.equal(await page.evaluate(() => 'modelContext' in document), false);
  assert.deepEqual(errors, []);
  await context.close();
});

const { page, errors, context } = await open({ withWebMCP: true });
const activated = [];
await page.exposeFunction('__activated', (n) => activated.push(n));
await page.evaluate(() => document.modelContext.addEventListener('toolactivated', (e) => window.__activated(e.toolName)));

await test('Listing 16.4: the catalog registers five tools with their annotations', async () => {
  const tools = await page.evaluate(async () => (await document.modelContext.getTools())
    .map((t) => ({ name: t.name, title: t.title, ro: t.annotations?.readOnlyHint === true, cq: t.annotations?.consequentialHint === true })));
  // getTools() order is not specified: the mock keeps registration order, Chromium 156 sorts by name.
  console.log(`     (getTools() order: ${tools.map((t) => t.name).join(', ')})`);
  assert.deepEqual(tools.map((t) => t.name).sort(), ['add_to_cart', 'checkout', 'compare_products', 'get_cart', 'search_products']);
  assert.deepEqual(tools.filter((t) => t.ro).map((t) => t.name).sort(), ['compare_products', 'get_cart', 'search_products']);
  assert.deepEqual(tools.filter((t) => t.cq).map((t) => t.name), ['checkout']);
  assert.equal(tools.find((t) => t.name === 'search_products').title, 'Search products');
});

await test('Listing 16.2: a successful call is recorded as ok, with a duration', async () => {
  const r = await call(page, 'search_products', { query: 'tent', maxPrice: 4000 });
  assert.deepEqual(JSON.parse(r.json).products.map((p) => p.sku), ['TH-TENT-2P']);
  const last = (await records(page)).at(-1);
  assert.equal(last.tool, 'search_products'); assert.equal(last.outcome, 'ok');
  assert.equal(typeof last.ms, 'number');
});

await test('Listing 16.2: a refused call (out of stock) is recorded with its status and code, and still returned to the agent', async () => {
  const r = await call(page, 'add_to_cart', { sku: 'TH-TENT-UL1', quantity: 1 });
  const result = JSON.parse(r.json);
  assert.deepEqual([result.status, result.code], ['refused', 'OUT_OF_STOCK']);
  assert.equal(typeof result.message, 'string');
  const last = (await records(page)).at(-1);
  assert.deepEqual([last.tool, last.outcome, last.code], ['add_to_cart', 'refused', 'OUT_OF_STOCK']);
});

await test('Listing 16.2: an agent-fixable error is recorded as error with its code', async () => {
  const r = await call(page, 'compare_products', { skus: ['TH-TENT-2P', 'NO-SUCH-SKU'] });
  assert.deepEqual([JSON.parse(r.json).status, JSON.parse(r.json).code], ['error', 'UNKNOWN_SKU']);
  const last = (await records(page)).at(-1);
  assert.deepEqual([last.tool, last.outcome, last.code], ['compare_products', 'error', 'UNKNOWN_SKU']);
});

await test('Listing 16.2: a thrown error is recorded as threw, and the call still rejects', async () => {
  await page.evaluate(() => window.__trailhead.breakHandlerForTest('compare_products'));
  const r = await call(page, 'compare_products', { skus: ['TH-TENT-2P', 'TH-BAG-M5'] });
  assert.ok(r.rejected, 'executeTool should reject');
  console.log(`     (executeTool rejected with ${r.rejected})`);
  const last = (await records(page)).at(-1);
  assert.deepEqual([last.tool, last.outcome], ['compare_products', 'threw']);
});

await test('Listing 16.2: an aborted call is recorded as aborted, not cancelled_by_user (wrapper called directly)', async () => {
  const outcome = await page.evaluate(async () => {
    const { withMeasurement } = await import('/dist/measure.js');
    let seen;
    const slow = withMeasurement({
      name: 'slow', description: 'test',
      execute: (_i, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
    }, (rec) => { seen = rec; });
    const ac = new AbortController();
    const p = slow.execute({}, { signal: ac.signal }).catch(() => {});
    ac.abort(new DOMException('user stopped', 'AbortError'));
    await p;
    return seen.outcome;
  });
  assert.equal(outcome, 'aborted');
});

await test('Listing 16.3: an order placed after agent help carries the tools that helped', async () => {
  JSON.parse((await call(page, 'add_to_cart', { sku: 'TH-BAG-M5', quantity: 1 })).json);
  const r = JSON.parse((await call(page, 'checkout', {})).json);
  assert.equal(r.status, 'awaiting_customer');
  await page.click('#place-order');                    // the customer's own click
  const order = await page.evaluate(() => window.__trailhead.sent.find((e) => e.type === 'order_placed').data);
  assert.equal(order.agentAssisted, true);
  assert.deepEqual(order.toolsUsed.sort(), ['add_to_cart', 'checkout', 'search_products']);
});

await test('Listing 16.3: an order with no agent help is not attributed', async () => {
  const { page: p2, context: c2 } = await open({ withWebMCP: true });
  await p2.evaluate(() => { document.querySelector('#view').innerHTML = '<button id="place-order">Place order</button>'; });
  await p2.click('#place-order');
  const order = await p2.evaluate(() => window.__trailhead.sent.find((e) => e.type === 'order_placed').data);
  assert.deepEqual([order.agentAssisted, order.toolsUsed], [false, []]);
  await c2.close();
});

await test('unregistering: aborting the signal removes all five tools', async () => {
  await page.evaluate(() => window.__trailhead.tools.abort());
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 0);
});

await test('no unexpected console errors', async () => {
  // A thrown tool error may be logged by the browser; anything else is a failure.
  const unexpected = errors.filter((e) => !/backend unavailable|invocation failed|Tool rejected/i.test(e));
  assert.deepEqual(unexpected, []);
});
console.log(`info toolactivated events seen by the page: ${activated.length ? activated.join(', ') : 'none'}`);

await context.close();
await plain.close();
if (REAL) await webmcp.close();
server.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
