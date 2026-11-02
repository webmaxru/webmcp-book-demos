// Chapter 10 tests: Trailhead (React 19 + Vite) with WebMCP tools.
//   npm test                           WebMCP from dev/model-context-mock.js, injected before the app loads
//   npm run test:chrome
//                                      WebMCP from Chromium itself (--enable-features=WebMCPTesting)
// Both scripts run `npm run build` first. Every test drives the built app in dist/, served from localhost (a secure context).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const REAL = process.env.WEBMCP === 'chrome';
const DIST = join(import.meta.dirname, '..', 'dist');
const MOCK = join(import.meta.dirname, '..', 'dev', 'model-context-mock.js');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  let file = join(DIST, path);
  if (!extname(path)) file = join(DIST, 'index.html');          // SPA fallback for client routes
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}`;

const plain = await chromium.launch();
const webmcp = REAL ? await chromium.launch({ args: ['--enable-features=WebMCPTesting'] }) : plain;
console.log(`Chromium ${plain.version()} · WebMCP from ${REAL ? 'the browser (WebMCPTesting)' : 'dev/model-context-mock.js'}\n`);

let passed = 0, failed = 0;
async function test(name, fn) {
  const t0 = Date.now();
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out after 30 s')), 30000))]);
    passed++; console.log(`  ✓ ${name} (${Date.now() - t0} ms)`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${String(e?.stack ?? e).split('\n').slice(0, 4).join('\n      ')}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${msg}: expected ${B}, got ${A}`); }

async function open(browser, path = '/', { withMock = !REAL } = {}) {
  const context = await browser.newContext();
  if (withMock) await context.addInitScript({ path: MOCK });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/^WebMCP tool execution failed/.test(m.text())) problems.push(`console.error: ${m.text()}`);
    if (m.type() === 'warning' && /registerTool/.test(m.text())) problems.push(`console.warn: ${m.text()}`);
  });
  await page.goto(BASE + path);
  return { page, problems, close: () => context.close() };
}

// In-page agent helpers: discover with getTools(), call with executeTool().
const toolNames = (page) => page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());
async function waitForTools(page, predicate, label) {
  const deadline = Date.now() + 5000;
  let names;
  while (Date.now() < deadline) {
    names = await toolNames(page);
    if (predicate(names)) return names;
    await page.waitForTimeout(50);
  }
  throw new Error(`tools never became ${label}; last seen ${JSON.stringify(names)}`);
}
const call = (page, name, input = {}) => page.evaluate(async ({ name, input }) => {
  const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  return JSON.parse(await document.modelContext.executeTool(tool, input));
}, { name, input });
// Start a call without awaiting it; settle it later with settle().
const startCall = (page, name, input = {}) => page.evaluate(async ({ name, input }) => {
  const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
  window.__ctrl = new AbortController();
  window.__pending = document.modelContext.executeTool(tool, input, { signal: window.__ctrl.signal })
    .then((json) => ({ ok: JSON.parse(json) }), (e) => ({ error: e.name }));
}, { name, input });
const settle = (page) => page.evaluate(() => window.__pending);
const isSettled = (page) => page.evaluate(() => Promise.race([window.__pending.then(() => true), new Promise((r) => setTimeout(() => r(false), 300))]));

const BASE_TOOLS = ['add_to_cart', 'compare_products', 'get_cart', 'search_products'];

console.log('Without WebMCP (any browser)');
await test('the store loads cleanly and a person can buy a tent through the UI', async () => {
  const { page, problems, close } = await open(plain, '/', { withMock: false });
  assert(await page.evaluate(() => !('modelContext' in document)), 'plain browser should have no modelContext');
  await page.getByText('WebMCP not available in this browser').waitFor();
  await page.getByLabel('Search products').fill('tent');
  await page.locator('[data-sku="TH-TENT-01"] button', { hasText: 'Add to cart' }).click();
  await page.getByTestId('cart-link').filter({ hasText: 'Cart (1)' }).waitFor();
  await page.getByTestId('cart-link').click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();
  await page.getByTestId('order-placed').filter({ hasText: 'Order TH-10001 placed' }).waitFor();
  eq(problems, [], 'console problems');
  await close();
});

console.log(`\nWith WebMCP (${REAL ? 'Chromium WebMCPTesting' : 'mock'})`);
await test('app-wide tools register once under StrictMode; checkout is absent with an empty cart', async () => {
  const { page, problems, close } = await open(webmcp);
  await page.getByText('WebMCP tools available').waitFor();
  eq(await waitForTools(page, (n) => n.length === 4, '4 tools'), BASE_TOOLS, 'tools on the shop page');
  await page.waitForTimeout(300);
  eq(problems, [], 'console problems (a duplicate registration would warn)');
  await close();
});

await test('search_products returns NOK products and reports bad input as a value', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.includes('search_products'), 'ready');
  const r = await call(page, 'search_products', { query: 'sleeping bag', maxPrice: 2000 });
  eq(r.products.map((p) => p.sku), ['TH-SB-02'], 'cheap sleeping bags');
  eq(r.products[0].price, { amount: 1299, currency: 'NOK' }, 'price shape');
  const bad = await call(page, 'search_products', { query: 'tent', category: 'kayaks' });
  eq([bad.status, bad.code], ['error', 'INVALID_ARGUMENT'], 'bad category is an error result');
  assert(/category must be one of/.test(bad.message), `expected a category error, got ${JSON.stringify(bad)}`);
  await close();
});

await test('add_to_cart and get_cart share the store with the UI (header updates)', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.includes('add_to_cart'), 'ready');
  const r = await call(page, 'add_to_cart', { sku: 'TH-SB-01', quantity: 2 });
  eq(r.cart, { itemCount: 2, total: { amount: 7598, currency: 'NOK' } }, 'cart after add');
  await page.getByTestId('cart-link').filter({ hasText: 'Cart (2)' }).waitFor();
  await page.locator('[data-sku="TH-CL-02"] button', { hasText: 'Add to cart' }).click();   // a person adds one too
  const cart = await call(page, 'get_cart');
  eq(cart.lines.map((l) => [l.sku, l.quantity]), [['TH-SB-01', 2], ['TH-CL-02', 1]], 'agent sees the person\'s item');
  const oos = await call(page, 'add_to_cart', { sku: 'TH-TENT-03', quantity: 1 });
  eq([oos.status, oos.code], ['refused', 'OUT_OF_STOCK'], 'out of stock is a refusal');
  assert(/TH-TENT-03 is out of stock/.test(oos.message), 'out-of-stock message');
  const big = await call(page, 'add_to_cart', { sku: 'TH-SB-01', quantity: 50 });
  eq([big.status, big.code], ['error', 'INVALID_ARGUMENT'], 'quantity error result');
  assert(/quantity must be/.test(big.message), 'quantity validated in code');
  await close();
});

await test('compare_products returns table data and shows the comparison to the person', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.includes('compare_products'), 'ready');
  const r = await call(page, 'compare_products', { skus: ['TH-FW-01', 'TH-FW-02'] });
  eq(r.rows[0], { attribute: 'price (NOK)', values: [2599, 1699] }, 'price row');
  await page.waitForURL(/\/compare\?skus=TH-FW-01,TH-FW-02$/);
  await page.getByRole('heading', { name: 'Compare' }).waitFor();
  const bad = await call(page, 'compare_products', { skus: ['TH-FW-01', 'NOPE'] });
  eq([bad.status, bad.code], ['error', 'UNKNOWN_SKU'], 'unknown sku is an error result');
  assert(/Unknown SKU/.test(bad.message), 'unknown sku reported');
  await close();
});

await test('checkout exists only on the cart route, and only with items in the cart', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.length === 4, 'ready');
  await page.getByTestId('cart-link').click();
  await page.getByText('Your cart is empty.').waitFor();
  await page.waitForTimeout(200);
  assert(!(await toolNames(page)).includes('checkout'), 'no checkout with an empty cart');
  await call(page, 'add_to_cart', { sku: 'TH-BP-02', quantity: 1 });
  await waitForTools(page, (n) => n.includes('checkout'), 'with checkout');
  await page.getByRole('link', { name: 'Shop' }).click();
  await waitForTools(page, (n) => !n.includes('checkout'), 'without checkout after leaving /cart');
  await close();
});

await test('checkout waits for the person: Cancel returns "cancelled_by_user", Place order returns an order ID', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.length === 4, 'ready');
  await call(page, 'add_to_cart', { sku: 'TH-TENT-01', quantity: 1 });
  await page.getByTestId('cart-link').click();
  await waitForTools(page, (n) => n.includes('checkout'), 'with checkout');
  await startCall(page, 'checkout');
  await page.getByRole('dialog').waitFor();
  assert(!(await isSettled(page)), 'checkout must not settle before the person answers');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  eq((await settle(page)).ok.status, 'cancelled_by_user', 'cancel');
  await startCall(page, 'checkout');
  await page.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();
  const placed = (await settle(page)).ok;
  eq([placed.status, placed.orderId, placed.total.amount], ['placed', 'TH-10001', 4499], 'placed');
  await page.getByTestId('order-placed').waitFor();
  await waitForTools(page, (n) => !n.includes('checkout'), 'without checkout once the cart is empty');
  await close();
});

await test('checkout orders exactly the cart the person confirmed; a change behind the dialog is refused', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.length === 4, 'ready');
  await call(page, 'add_to_cart', { sku: 'TH-TENT-01', quantity: 1 });
  await page.getByTestId('cart-link').click();
  await waitForTools(page, (n) => n.includes('checkout'), 'with checkout');
  await startCall(page, 'checkout');
  await page.getByRole('dialog').waitFor();
  await call(page, 'add_to_cart', { sku: 'TH-SB-02', quantity: 1 });   // the cart changes while the question is open
  await page.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();
  const r = (await settle(page)).ok;
  eq([r?.status, r?.code], ['refused', 'CART_CHANGED'], 'a stale confirmation is refused');
  assert(/nothing was ordered/.test(r.message), 'the message says nothing was ordered');
  eq(await page.getByTestId('cart-link').textContent(), 'Cart (2)', 'nothing ordered, the cart is intact');
  await close();
});

await test('an in-flight checkout survives navigation that unregisters the tool', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.length === 4, 'ready');
  await call(page, 'add_to_cart', { sku: 'TH-FW-02', quantity: 1 });
  await page.getByTestId('cart-link').click();
  await waitForTools(page, (n) => n.includes('checkout'), 'with checkout');
  await startCall(page, 'checkout');
  await page.getByRole('dialog').waitFor();
  await page.goBack();                                // the person presses Back while the question is open
  await page.waitForURL(BASE + '/');
  await waitForTools(page, (n) => !n.includes('checkout'), 'unregistered');
  await page.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();
  const r = await settle(page);
  eq([r.ok?.status, r.ok?.orderId], ['placed', 'TH-10001'], 'in-flight call completes');
  await close();
});

await test('an agent that aborts the call closes the dialog, and the page says so', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.length === 4, 'ready');
  await call(page, 'add_to_cart', { sku: 'TH-CL-01', quantity: 1 });
  await page.getByTestId('cart-link').click();
  await waitForTools(page, (n) => n.includes('checkout'), 'with checkout');
  await startCall(page, 'checkout');
  await page.getByRole('dialog').waitFor();
  await page.evaluate(() => window.__ctrl.abort());
  eq(await settle(page), { error: 'AbortError' }, 'executeTool rejects');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('status').filter({ hasText: 'Agent cancelled checkout' }).waitFor();
  eq(await page.getByTestId('cart-link').textContent(), 'Cart (1)', 'nothing ordered');
  await close();
});

await test('toolactivated drives the "Agent is using …" indicator', async () => {
  const { page, close } = await open(webmcp);
  await waitForTools(page, (n) => n.length === 4, 'ready');
  await call(page, 'search_products', { query: 'jacket' });
  await page.getByRole('status').filter({ hasText: 'Agent is using search_products' }).waitFor();
  await close();
});

await test('Listing 10.1 useAgentTool: one registration, latest state, re-register on metadata change, unregister on unmount', async () => {
  const { page, problems, close } = await open(webmcp, '/hook-demo.html');
  await waitForTools(page, (n) => n.includes('get_greeting'), 'registered');
  eq(await toolNames(page), ['get_greeting'], 'exactly one tool');
  await page.evaluate(() => { window.__changes = 0; document.modelContext.addEventListener('toolchange', () => window.__changes++); });
  for (let i = 0; i < 3; i++) await page.locator('#click').click();
  eq(await call(page, 'get_greeting'), { greeting: 'Hello', clicks: 3 }, 'latest state, English');
  await page.waitForTimeout(200);
  eq(await page.evaluate(() => window.__changes), 0, 'state changes do not re-register');
  await page.locator('#language').click();
  await page.waitForFunction(async () => (await document.modelContext.getTools())[0]?.description === 'Få en hilsen fra Trailhead.');
  eq(await call(page, 'get_greeting'), { greeting: 'Hei', clicks: 3 }, 'Norwegian');
  assert(await page.evaluate(() => window.__changes) >= 2, 'a metadata change unregisters and re-registers (toolchange x2)');
  await page.locator('#toggle').click();
  await waitForTools(page, (n) => n.length === 0, 'empty after unmount');
  eq(problems, [], 'console problems');
  await close();
});

if (webmcp !== plain) await webmcp.close();
await plain.close();
server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
