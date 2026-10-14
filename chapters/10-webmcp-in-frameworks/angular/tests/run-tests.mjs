// Runs chapter 10's Angular listings in Chromium: app-wide tools, route-scoped tools, a Signal Form as a tool.
//   npm test            WebMCP from ../trailhead-react/dev/model-context-mock.js
//   npm run test:chrome WebMCP from Chromium itself (--enable-features=WebMCPTesting)
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const REAL = process.env.WEBMCP === 'chrome';
const ROOT = join(import.meta.dirname, '..');
const MOCK = join(ROOT, '..', 'trailhead-react', 'dev', 'model-context-mock.js');
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = extname(path) ? join(ROOT, path) : join(ROOT, 'index.html');
  try { const body = await readFile(file);
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}`;
const browser = await chromium.launch(REAL ? { args: ['--enable-features=WebMCPTesting'] } : {});
console.log(`Chromium ${browser.version()} · Angular listings · WebMCP from ${REAL ? 'the browser' : 'the mock'}\n`);

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 30000))]); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}\n      ${String(e?.stack ?? e).split('\n').slice(0, 3).join('\n      ')}`); }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const context = await browser.newContext();
if (!REAL) await context.addInitScript({ path: MOCK });
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/^WebMCP tool execution failed/.test(m.text())) problems.push(m.text()); });
await page.goto(BASE + '/');
await page.getByRole('heading', { name: 'Shop' }).waitFor();

const names = () => page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());
async function until(pred, label) {
  for (let i = 0; i < 100; i++) { const n = await names(); if (pred(n)) return n; await page.waitForTimeout(50); }
  throw new Error(`tools never became ${label}: ${JSON.stringify(await names())}`);
}
const call = (name, input = {}) => page.evaluate(async ({ name, input }) => {
  const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
  const raw = await document.modelContext.executeTool(tool, input);
  try { return JSON.parse(raw); } catch { return raw; }
}, { name, input });

await test('Listing 10.9: search_products is registered for the whole app and runs in its injection context', async () => {
  eq(await until((n) => n.includes('search_products'), 'ready'), ['search_products'], 'tools on /');
  const r = await call('search_products', { query: 'tent', maxPrice: 5000 });
  eq(r.products.map((p) => p.sku), ['TH-TENT-01', 'TH-TENT-03'], 'tents under 5000 NOK');
  const bad = await call('search_products', { query: 'tent', category: 'kayaks' });
  if (!/category must be one of/.test(bad.error)) throw new Error(JSON.stringify(bad));
});

await test('Listing 10.10: get_cart exists only while /cart is active (withAutoCleanupInjectors)', async () => {
  await page.getByRole('link', { name: 'Cart' }).click();
  await page.getByRole('heading', { name: 'Cart' }).waitFor();
  await until((n) => n.includes('get_cart'), 'with get_cart');
  await page.evaluate(() => window.__cart.add('TH-CL-02', 2));
  eq(await call('get_cart'), { lines: [{ sku: 'TH-CL-02', name: 'Senja Merino Base Layer', quantity: 2, unitPrice: 899 }], total: { amount: 1798, currency: 'NOK' } }, 'cart');
  await page.getByRole('link', { name: 'Shop' }).click();
  await until((n) => !n.includes('get_cart'), 'without get_cart after leaving /cart');
});

await test('Listing 10.11: the Signal Form becomes request_stock_alert with an inferred schema', async () => {
  await page.getByRole('link', { name: 'Stock alert' }).click();
  await until((n) => n.includes('request_stock_alert'), 'with the form tool');
  const tool = await page.evaluate(async () => (await document.modelContext.getTools()).find((t) => t.name === 'request_stock_alert'));
  console.log('      inferred inputSchema:', JSON.stringify(tool.inputSchema));
  if (!tool.inputSchema?.properties?.email || !tool.inputSchema?.properties?.quantity) throw new Error('schema missing fields');
});

await test('Listing 10.11: invalid input comes back as validation errors; valid input submits the form', async () => {
  const bad = await call('request_stock_alert', { email: 'not-an-email', sku: 'TH-TENT-03', quantity: 1 });
  console.log('      invalid call returned:', JSON.stringify(bad).slice(0, 300));
  eq(await page.evaluate(() => window.__alerts.saved().length), 0, 'nothing saved on invalid input');
  const ok = await call('request_stock_alert', { email: 'kari@example.no', sku: 'TH-TENT-03', quantity: 1 });
  console.log('      valid call returned:', JSON.stringify(ok).slice(0, 300));
  eq(await page.evaluate(() => window.__alerts.saved()), [{ email: 'kari@example.no', sku: 'TH-TENT-03', quantity: 1 }], 'alert saved');
  eq(await page.locator('input[type=email]').inputValue(), 'kari@example.no', 'the form shows what the agent filled');
});

await test('no console errors', async () => { eq(problems, [], 'problems'); });

await browser.close(); server.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
