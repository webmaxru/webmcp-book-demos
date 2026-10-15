// Chapter 6 tests: syntax checks, behaviour against a dev-only mock, behaviour against
// Chromium's real WebMCP implementation (--enable-features=WebMCPTesting), and a probe that
// records how Chromium reports errors, cancellation and lifecycle events.
// Run: npm install && npx playwright install chromium && npm test
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (suite, name, ok, detail = '') => {
  results.push({ suite, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${suite}] ${name}${ok ? '' : '  ' + detail}`);
};

// 1. Syntax ---------------------------------------------------------------------------
for (const f of readdirSync(join(root, 'trailhead')).filter((f) => f.endsWith('.js'))) {
  const r = spawnSync(process.execPath, ['--check', join(root, 'trailhead', f)], { encoding: 'utf8', timeout: 20000 });
  check('syntax', `node --check trailhead/${f}`, r.status === 0, r.stderr);
}

// Tiny static server (localhost is a secure context) ------------------------------------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/html' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// In-page caller adapter: same scenarios for the mock and for real Chromium.
const adapter = () => {
  const mc = document.modelContext;
  const real = typeof mc.executeTool === 'function';
  window.__pending = {};
  window.__list = async () => real ? (await mc.getTools()).map(({ window: w, origin, ...t }) => t) : mc.__list();
  window.__start = (id, name, input, abortAfterMs) => {
    const ac = new AbortController();
    if (abortAfterMs !== undefined) setTimeout(() => ac.abort(), abortAfterMs);
    const run = async () => {
      if (real) {
        const tool = (await mc.getTools()).find((t) => t.name === name);
        if (!tool) throw new DOMException('not listed', 'NotFoundError');
        return mc.executeTool(tool, input, { signal: ac.signal });
      }
      return mc.__call(name, input, { signal: ac.signal });
    };
    window.__pending[id] = { ac, p: run().then((s) => ({ ok: true, value: s === null ? null : JSON.parse(s) }), (e) => ({ ok: false, error: e.name })) };
  };
  window.__abort = (id) => window.__pending[id].ac.abort();
  window.__result = (id) => window.__pending[id].p;
};

async function scenarios(suite, browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (suite === 'mock') await page.addInitScript({ path: join(root, 'tests/mock-model-context.js') });
  await page.goto(`${base}/trailhead/index.html?debug`);
  await page.waitForFunction(() => window.__trailheadReady === true, null, { timeout: 10000 });
  await page.evaluate(adapter);
  const call = async (name, input = {}, abortAfterMs) => {
    const id = Math.random().toString(36).slice(2);
    await page.evaluate(([i, n, inp, a]) => window.__start(i, n, inp, a), [id, name, input, abortAfterMs]);
    return page.evaluate((i) => window.__result(i), id);
  };
  const list = () => page.evaluate(() => window.__list());
  const names = async () => (await list()).map((t) => t.name).sort();

  let tools = await list();
  check(suite, 'five tools registered with ?debug, checkout absent while cart empty',
    JSON.stringify(await names()) === JSON.stringify(['add_to_cart', 'compare_products', 'debug_dump_cart_state', 'get_cart', 'get_product_reviews', 'search_products']), JSON.stringify(await names()));
  const ann = (n) => tools.find((t) => t.name === n)?.annotations;
  check(suite, 'search_products annotations: readOnlyHint only', ann('search_products')?.readOnlyHint === true && !ann('search_products')?.untrustedContentHint, JSON.stringify(ann('search_products')));
  check(suite, 'get_product_reviews annotations: readOnly + untrustedContent', ann('get_product_reviews')?.readOnlyHint && ann('get_product_reviews')?.untrustedContentHint, JSON.stringify(ann('get_product_reviews')));
  check(suite, 'add_to_cart has no annotations (all hints default to false)', ann('add_to_cart') === undefined || Object.values(ann('add_to_cart')).every((v) => v === false), JSON.stringify(ann('add_to_cart')));
  check(suite, 'debug tool annotations: debugging + readOnly', ann('debug_dump_cart_state')?.debugging === true && ann('debug_dump_cart_state')?.readOnlyHint === true, JSON.stringify(ann('debug_dump_cart_state')));

  let r = await call('search_products', { query: 'tent', inStockOnly: true });
  check(suite, 'search_products returns in-stock tents priced in NOK', r.ok && r.value.products.length === 2 && r.value.products.every((p) => p.inStock && p.price.currency === 'NOK'), JSON.stringify(r));
  check(suite, 'search results are shown in the page', (await page.locator('#products li').count()) === 2);
  r = await call('search_products', { query: 'tent', category: 'boats' });
  check(suite, 'invalid category is returned as a value (error / INVALID_INPUT)', r.ok && r.value.status === 'error' && r.value.code === 'INVALID_INPUT', JSON.stringify(r));

  r = await call('get_product_reviews', { sku: 'TH-TENT-2P' });
  check(suite, 'reviews come back as data fields (injection text stays inside "text")', r.ok && r.value.reviews.length === 3 && r.value.reviews[1].text.includes('Ignore previous instructions'), JSON.stringify(r).slice(0, 200));
  r = await call('get_product_reviews', { sku: 'NOPE' });
  check(suite, 'unknown SKU in reviews → error / UNKNOWN_SKU', r.ok && r.value.status === 'error' && r.value.code === 'UNKNOWN_SKU', JSON.stringify(r));

  r = await call('add_to_cart', { sku: 'TH-TENT-2P', quantity: 0 });
  check(suite, 'add_to_cart quantity 0 → INVALID_QUANTITY', r.ok && r.value.code === 'INVALID_QUANTITY', JSON.stringify(r));
  r = await call('add_to_cart', { sku: 'TH-NOPE', quantity: 1 });
  check(suite, 'add_to_cart unknown SKU → UNKNOWN_SKU', r.ok && r.value.code === 'UNKNOWN_SKU', JSON.stringify(r));
  r = await call('add_to_cart', { sku: 'TH-TENT-4P', quantity: 1 });
  check(suite, 'add_to_cart sold-out tent → refused / OUT_OF_STOCK with available: 0', r.ok && r.value.status === 'refused' && r.value.code === 'OUT_OF_STOCK' && r.value.available === 0, JSON.stringify(r));

  // cancellation right before the side effect
  await page.evaluate(() => { window.__trailheadLatency.stock = 600; });
  r = await call('add_to_cart', { sku: 'TH-TENT-2P', quantity: 1 }, 100);
  check(suite, 'add_to_cart cancelled during stock check → caller gets AbortError', !r.ok && r.error === 'AbortError', JSON.stringify(r));
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__trailheadLatency.stock = 40; });
  r = await call('get_cart');
  check(suite, '…and nothing was added to the cart', r.ok && r.value.lines.length === 0, JSON.stringify(r));

  r = await call('add_to_cart', { sku: 'TH-TENT-2P', quantity: 2 });
  check(suite, 'add_to_cart 2 × TH-TENT-2P → added, total 6980 NOK', r.ok && r.value.status === 'added' && r.value.total.amount === 6980, JSON.stringify(r));
  await page.waitForTimeout(150);
  check(suite, 'checkout is registered once the cart has items (toolchange)', (await names()).includes('checkout'));
  tools = await list();
  check(suite, 'checkout annotations: consequentialHint', ann('checkout')?.consequentialHint === true, JSON.stringify(ann('checkout')));

  r = await call('compare_products', { skus: ['TH-TENT-2P', 'TH-TENT-UL1'] });
  check(suite, 'compare_products (2 SKUs) → complete', r.ok && r.value.status === 'complete' && r.value.rows.length === 2, JSON.stringify(r).slice(0, 200));
  r = await call('compare_products', { skus: ['TH-TENT-2P'] });
  check(suite, 'compare_products with one SKU → error / INVALID_INPUT', r.ok && r.value.status === 'error' && r.value.code === 'INVALID_INPUT', JSON.stringify(r));
  const logBefore = await page.evaluate(() => document.querySelectorAll('#activity li').length);
  r = await call('compare_products', { skus: ['TH-TENT-2P', 'TH-TENT-UL1', 'TH-TENT-4P'] }, 120);
  check(suite, 'compare_products cancelled by the caller → AbortError', !r.ok && r.error === 'AbortError', JSON.stringify(r));
  await page.waitForTimeout(400);
  const log = await page.evaluate(() => [...document.querySelectorAll('#activity li')].map((li) => li.textContent));
  check(suite, 'toolcancel reached the page (activity log)', log.slice(logBefore).includes('■ compare_products cancelled'), JSON.stringify(log.slice(logBefore)));
  check(suite, 'agent banner cleared after the cancelled call settled', await page.locator('#agent-banner').isHidden());
  await page.evaluate(() => { window.__trailheadLatency.specsBySku['TH-TENT-UL1'] = 9000; });
  r = await call('compare_products', { skus: ['TH-TENT-2P', 'TH-TENT-UL1'] });
  check(suite, 'page deadline (8 s) → partial comparison with the slow SKU listed as missing', r.ok && r.value.status === 'partial' && r.value.missing[0] === 'TH-TENT-UL1', JSON.stringify(r).slice(0, 200));
  await page.evaluate(() => { delete window.__trailheadLatency.specsBySku['TH-TENT-UL1']; });

  // checkout: cancelled by the user, cancelled by the caller, then placed
  let id = 'co1';
  await page.evaluate(() => window.__start('co1', 'checkout', {}));
  await page.locator('#confirm-dialog').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('#confirm-cancel');
  r = await page.evaluate((i) => window.__result(i), id);
  check(suite, 'checkout: user presses Cancel → status cancelled_by_user', r.ok && r.value.status === 'cancelled_by_user', JSON.stringify(r));
  await page.evaluate(() => window.__start('co2', 'checkout', {}));
  await page.locator('#confirm-dialog').waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate(() => window.__abort('co2'));
  r = await page.evaluate(() => window.__result('co2'));
  await page.waitForTimeout(200);
  check(suite, 'checkout cancelled by the caller → AbortError and the dialog closes', !r.ok && r.error === 'AbortError' && await page.locator('#confirm-dialog').isHidden(), JSON.stringify(r));
  await page.evaluate(() => window.__start('co3', 'checkout', {}));
  await page.locator('#confirm-dialog').waitFor({ state: 'visible', timeout: 5000 });
  await page.click('#confirm-ok');
  r = await page.evaluate(() => window.__result('co3'));
  check(suite, 'checkout: user presses Place order → placed TH-1001', r.ok && r.value.status === 'placed' && r.value.orderId === 'TH-1001', JSON.stringify(r));
  await page.waitForTimeout(150);
  check(suite, 'checkout unregistered again once the order empties the cart', !(await names()).includes('checkout'), JSON.stringify(await names()));

  r = await call('debug_dump_cart_state');
  check(suite, 'debug tool returns the raw store', r.ok && 'nextLineId' in r.value.raw, JSON.stringify(r));
  check(suite, 'no uncaught page errors', errors.length === 0, errors.join(' | '));

  const page2 = await browser.newPage();
  if (suite === 'mock') await page2.addInitScript({ path: join(root, 'tests/mock-model-context.js') });
  await page2.goto(`${base}/trailhead/index.html`);
  await page2.waitForFunction(() => window.__trailheadReady === true, null, { timeout: 10000 });
  await page2.evaluate(adapter);
  const n2 = (await page2.evaluate(() => window.__list())).map((t) => t.name);
  check(suite, 'without ?debug the debugging tool is not registered', !n2.includes('debug_dump_cart_state'), JSON.stringify(n2));
  await page.close(); await page2.close();
}

// Platform probe: how Chromium reports lifecycle, cancellation and errors.
async function probe(browser) {
  const page = await browser.newPage();
  await page.goto(`${base}/tests/probe.html`);
  const o = await page.evaluate(async () => {
    const mc = document.modelContext, out = {}, ev = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    mc.addEventListener('toolactivated', (e) => ev.push('toolactivated:' + e.toolName));
    mc.addEventListener('toolcancel', (e) => ev.push('toolcancel:' + e.toolName));
    const get = async (n) => (await mc.getTools()).find((t) => t.name === n);
    const run = async (n, input = {}, opts) => { try { return 'resolved ' + JSON.stringify(await mc.executeTool(await get(n), input, opts)); } catch (e) { return 'rejected ' + e.name; } };
    const order = [];
    mc.addEventListener('toolactivated', () => order.push('toolactivated event'));
    await mc.registerTool({ name: 'order', description: 'd', execute: () => { order.push('execute called'); return 1; } });
    await run('order'); out.activatedOrder = order.join(' → ');
    const saw = [];
    await mc.registerTool({ name: 'slow', description: 'd', execute: async (i, { signal }) => {
      signal.addEventListener('abort', () => saw.push('tool signal aborted (' + signal.reason.name + ')'));
      await sleep(300); saw.push('tool kept running and settled'); return 'late'; } });
    ev.length = 0;
    const ac = new AbortController(); const p = run('slow', {}, { signal: ac.signal });
    await sleep(80); ac.abort(); out.callerAbort = await p; await sleep(400);
    out.callerAbortToolSide = saw.join('; '); out.callerAbortEvents = ev.join(', ');
    out.preAborted = await run('slow', {}, { signal: AbortSignal.abort() });
    const reg = new AbortController();
    await mc.registerTool({ name: 'unreg', description: 'd', execute: async (i, { signal }) => { await sleep(150); return { aborted: signal.aborted }; } }, { signal: reg.signal });
    const p2 = run('unreg'); await sleep(40); reg.abort(); out.unregisterMidCall = await p2;
    const reg2 = new AbortController();
    await mc.registerTool({ name: 'gone', description: 'd', execute: () => 1 }, { signal: reg2.signal });
    const stale = await get('gone'); reg2.abort(); await sleep(50);
    try { await mc.executeTool(stale, {}); out.staleTool = 'resolved'; } catch (e) { out.staleTool = 'rejected ' + e.name; }
    await mc.registerTool({ name: 'throws', description: 'd', execute: () => { throw new Error('internal detail'); } });
    await mc.registerTool({ name: 'undef', description: 'd', execute: () => {} });
    await mc.registerTool({ name: 'bigint', description: 'd', execute: () => ({ n: 1n }) });
    await mc.registerTool({ name: 'echo', description: 'd', execute: (i) => i });
    out.thrown = await run('throws'); out.returnsUndefined = await run('undef'); out.returnsBigInt = await run('bigint');
    out.inputNotObject = await run('echo', 'text'); out.inputArray = await run('echo', [1, 2]);
    const conc = [];
    await mc.registerTool({ name: 'conc', description: 'd', execute: async ({ n }) => { conc.push('start ' + n); await sleep(60); conc.push('end ' + n); return n; } });
    await Promise.all([run('conc', { n: 1 }), run('conc', { n: 2 })]); out.concurrentCalls = conc.join(', ');
    let changes = 0; mc.addEventListener('toolchange', () => changes++);
    const many = new AbortController();
    for (const n of ['a1', 'a2', 'a3']) await mc.registerTool({ name: n, description: 'd', execute: () => 1 }, { signal: many.signal });
    await sleep(50); const afterReg = changes; many.abort(); await sleep(50);
    out.toolchangeCounts = `register 3 tools → ${afterReg} events; abort their shared signal → ${changes - afterReg} events`;
    await mc.registerTool({ name: 'plain', description: 'd', execute: () => 1 });
    out.annotationsWhenOmitted = JSON.stringify((await get('plain')).annotations) ?? 'undefined';
    // Target document unloads mid-call (tool in a same-origin iframe navigates it).
    const f = document.createElement('iframe'); f.src = 'probe.html?frame'; document.body.append(f);
    await new Promise((r) => (f.onload = r));
    await f.contentDocument.modelContext.registerTool({ name: 'navigates', description: 'd', execute: () => { f.contentWindow.location.href = 'probe.html?next'; return new Promise(() => {}); } });
    out.targetUnloadedMidCall = await run('navigates');
    f.src = 'probe.html?frame2'; await new Promise((r) => (f.onload = r));
    await f.contentDocument.modelContext.registerTool({ name: 'navigates_after_return', description: 'd', execute: () => { f.contentWindow.location.href = 'probe.html?next2'; return 'navigating'; } });
    out.navigateButReturnFirst = await run('navigates_after_return');
    // Caller document unloads mid-call (iframe calls the top document's tool, then is removed).
    const saw2 = []; ev.length = 0;
    await mc.registerTool({ name: 'top_slow', description: 'd', execute: async (i, { signal }) => { signal.onabort = () => saw2.push('aborted'); await sleep(300); return 1; } });
    f.src = 'probe.html?caller'; await new Promise((r) => (f.onload = r));
    const fmc = f.contentDocument.modelContext;
    fmc.executeTool((await fmc.getTools()).find((t) => t.name === 'top_slow'), {}).catch(() => {});
    await sleep(80); f.remove(); await sleep(400);
    out.callerUnloadedMidCall = `target saw: ${ev.join(', ')}; tool signal: ${saw2.join(', ') || 'not aborted'}`;
    return out;
  });
  await page.close();
  return o;
}

let exitCode = 0;
const browserMock = await chromium.launch();
try { await scenarios('mock', browserMock); } catch (e) { check('mock', 'suite crashed', false, e.stack); } finally { await browserMock.close(); }

let observations = null;
try {
  const real = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
  try {
    const page = await real.newPage();
    await page.goto(`${base}/tests/probe.html`);
    const has = await page.evaluate(() => 'modelContext' in document);
    await page.close();
    if (!has) {
      check('chromium', 'WebMCP available with --enable-features=WebMCPTesting', false, 'document.modelContext missing; skipping real-browser suite');
    } else {
      check('chromium', `WebMCP available in ${real.version()}`, true);
      await scenarios('chromium', real);
      observations = { browser: real.version(), date: new Date().toISOString(), ...(await probe(real)) };
    }
  } finally { await real.close(); }
} catch (e) { check('chromium', 'suite crashed', false, e.stack); }

server.close();
await mkdir(join(root, 'tests/results'), { recursive: true });
if (observations) {
  await writeFile(join(root, 'tests/results/chromium-observations.json'), JSON.stringify(observations, null, 2) + '\n');
  console.log('\nChromium observations:\n' + JSON.stringify(observations, null, 2));
}
const failed = results.filter((r) => !r.ok);
await writeFile(join(root, 'tests/results/summary.json'), JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2) + '\n');
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) exitCode = 1;
process.exit(exitCode);
