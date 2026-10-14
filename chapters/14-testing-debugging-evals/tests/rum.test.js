// instrumentTool() in a real page: mock WebMCP by default, Chromium's own with WEBMCP=chrome.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './fixtures/serve.js';

const REAL = process.env.WEBMCP === 'chrome';
const MOCK = fileURLToPath(new URL('../../../fjord-table/dev/model-context-mock.js', import.meta.url));
let browser, site, page;
before(async () => {
  site = await serve(new URL('../', import.meta.url));
  browser = await chromium.launch(REAL ? { args: ['--enable-features=WebMCPTesting'] } : {});
  page = await browser.newPage();
  if (!REAL) await page.addInitScript({ path: MOCK });
  await page.goto(`${site.url}tests/pages/trailhead.html`);
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'ready');
});
after(async () => { await browser?.close(); await site?.close(); });

const call = (name, input, abortAfterMs) => page.evaluate(async ({ name, input, abortAfterMs }) => {
  const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
  const controller = new AbortController();
  if (abortAfterMs !== undefined) setTimeout(() => controller.abort(), abortAfterMs);
  try { return { result: await document.modelContext.executeTool(tool, input, { signal: controller.signal }) }; }
  catch (e) { return { error: e.name }; }
}, { name, input, abortAfterMs });
const lastEvent = () => page.evaluate(() => window.rum.at(-1));

test(`[${REAL ? 'chrome' : 'mock'}] a successful call is recorded as ok, with a duration`, async () => {
  const { result } = await call('search_products', { query: 'tent' });
  assert.ok(JSON.parse(result).products.length > 0);
  const event = await lastEvent();
  assert.equal(event.tool, 'search_products');
  assert.equal(event.outcome, 'ok');
  assert.equal(typeof event.ms, 'number');
  assert.equal(JSON.stringify(event).includes('tent'), false);   // no inputs leave the page
});

test(`[${REAL ? 'chrome' : 'mock'}] a failure returned as a value is recorded as recoverable`, async () => {
  await call('add_to_cart', { sku: 'TH-TENT-4P', quantity: 1 });
  assert.deepEqual(await lastEvent().then(({ outcome, code }) => ({ outcome, code })),
                   { outcome: 'recoverable', code: 'out_of_stock' });
});

test(`[${REAL ? 'chrome' : 'mock'}] a call the agent abandons is recorded as aborted`, async () => {
  const { error } = await call('search_products_slow', { query: 'tent' }, 100);
  assert.equal(error, 'AbortError');
  await page.waitForFunction(() => window.rum.at(-1)?.tool === 'search_products_slow');
  assert.equal((await lastEvent()).outcome, 'aborted');
});

test(`[${REAL ? 'chrome' : 'mock'}] toolactivated fired once per call`, { skip: !REAL && 'Chromium only' },
  async () => {
    const activated = await page.evaluate(() => window.activated);
    assert.deepEqual(activated, ['search_products', 'add_to_cart', 'search_products_slow']);
  });
