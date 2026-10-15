// tests/run-tests.mjs: Chapter 13 checks (Trailhead checkout, consent and presence).
//   node tests/run-tests.mjs     syntax + mock (plain Chromium) + real Chromium (WebMCPTesting)
// The page is served as https://shop.trailhead.example through Playwright request routing.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ORIGIN = 'https://shop.trailhead.example';
let passed = 0, failures = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failures++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 8).join('\n     ')}`); }
}

for (const f of ['trailhead/confirm-sheet.js', 'trailhead/checkout-tools.js', 'trailhead/session-tools.js',
  'trailhead/agent-presence.js', 'trailhead/store.js', 'app.js', 'dev/model-context-mock.js']) {
  await test(`syntax: ${f}`, () => { execFileSync(process.execPath, ['--check', join(ROOT, f)]); });
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
async function open(browser, { mock = false, init, wait = true } = {}) {
  const context = await browser.newContext();
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    try { route.fulfill({ status: 200, headers: { 'content-type': TYPES[extname(file)] ?? 'text/plain' }, body: await readFile(join(ROOT, file)) }); }
    catch { route.fulfill({ status: 404, body: '' }); }
  });
  if (mock) await context.addInitScript({ path: join(ROOT, 'dev/model-context-mock.js') });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(ORIGIN + '/');
  if (wait) await page.waitForFunction(() => !!window.trailhead);
  return { page, context, errors };
}
const names = (page) => page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name).sort());
const signIn = async (page) => { await page.click('#sign-in'); await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 2); };
const startCheckout = (page) => page.evaluate(() => { window.pending = (async () => {
  const t = (await document.modelContext.getTools()).find((x) => x.name === 'checkout');
  window.ac = new AbortController();
  try { return JSON.parse(await document.modelContext.executeTool(t, {}, { signal: window.ac.signal })); }
  catch (e) { return { thrown: e.name }; }
})(); });
const result = (page) => page.evaluate(() => window.pending);

const plain = await chromium.launch();
const real = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
console.log(`\nChromium ${real.version()}`);

await test('mock (plain Chromium): tools follow the session; decline returns a value', async () => {
  const { page, context, errors } = await open(plain, { mock: true });
  assert.deepEqual(await names(page), []);
  await signIn(page);
  assert.deepEqual(await names(page), ['checkout', 'get_cart']);
  await startCheckout(page);
  await page.waitForSelector('#confirm-sheet[open]');
  await page.click('[data-back]');
  assert.deepEqual(await result(page), { status: 'cancelled_by_user', message: 'The user closed the order without placing it. Nothing was charged.' });
  assert.match(await page.textContent('#agent-presence'), /An assistant is using Trailhead: Place your order\./);
  assert.deepEqual(errors, []);
  await context.close();
});

for (const [label, browser] of [['chromium', real]]) {
  await test(`${label}: no tools while signed out; two after sign-in; none after sign-out`, async () => {
    const { page, context } = await open(browser);
    assert.deepEqual(await names(page), []);
    await signIn(page);
    const tools = await page.evaluate(async () => (await document.modelContext.getTools()).map((t) => [t.name, t.annotations]));
    assert.deepEqual(Object.fromEntries(tools).checkout.consequentialHint, true);
    assert.deepEqual(Object.fromEntries(tools).get_cart.readOnlyHint, true);
    await page.click('#sign-out');
    await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 0);
    await context.close();
  });

  await test(`${label}: get_cart returns prices and summaries, never the address or card`, async () => {
    const { page, context } = await open(browser);
    await signIn(page);
    const r = JSON.parse(await page.evaluate(async () => {
      const t = (await document.modelContext.getTools()).find((x) => x.name === 'get_cart');
      return document.modelContext.executeTool(t, {});
    }));
    assert.deepEqual(Object.keys(r).sort(), ['lines', 'payWith', 'shipTo', 'total']);
    assert.deepEqual(r.total, { amount: 7297, currency: 'NOK' });
    assert.equal(r.shipTo, 'Oslo 0150');
    assert.equal(r.payWith, 'Visa ending 4242');
    await context.close();
  });

  await test(`${label}: checkout waits for the person; scripted and too-early clicks do nothing`, async () => {
    const { page, context } = await open(browser);
    await signIn(page);
    await startCheckout(page);
    await page.waitForSelector('#confirm-sheet[open]');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'confirm-title');
    assert.match(await page.textContent('[data-total]'), /7\s?297/);
    assert.match(await page.textContent('#agent-presence'), /An assistant is using Trailhead: Place your order\./);
    await page.evaluate(() => document.querySelector('[data-place]').click());           // untrusted
    const box = await page.locator('[data-place]').boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);                // trusted, but before arming
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.querySelector('#confirm-sheet').open), true);
    assert.equal(await page.evaluate(() => window.trailhead.orders.placed.length), 0);
    await page.evaluate(() => document.querySelector('[data-place]').addEventListener('click', (e) => { window.lastTrusted = e.isTrusted; }));
    await page.click('[data-place]');        // Playwright waits until the button is enabled, then clicks
    const r = await result(page);
    assert.equal(r.status, 'placed');
    assert.equal(r.orderId, 'TH-100200');
    assert.deepEqual(r.total, { amount: 7297, currency: 'NOK' });
    assert.equal(await page.evaluate(() => window.lastTrusted), true, 'an automation click is isTrusted');
    await context.close();
  });

  await test(`${label}: Back and Esc both decline, and nothing is ordered`, async () => {
    const { page, context } = await open(browser);
    await signIn(page);
    await startCheckout(page);
    await page.waitForSelector('#confirm-sheet[open]');
    await page.click('[data-back]');
    assert.deepEqual(await result(page), { status: 'cancelled_by_user', message: 'The user closed the order without placing it. Nothing was charged.' });
    await startCheckout(page);
    await page.waitForSelector('#confirm-sheet[open]');
    await page.keyboard.press('Escape');
    assert.deepEqual(await result(page), { status: 'cancelled_by_user', message: 'The user closed the order without placing it. Nothing was charged.' });
    assert.equal(await page.evaluate(() => window.trailhead.orders.placed.length), 0);
    await context.close();
  });

  await test(`${label}: the agent cancels: sheet closes, caller gets AbortError, banner says so`, async () => {
    const { page, context } = await open(browser);
    await signIn(page);
    await startCheckout(page);
    await page.waitForSelector('#confirm-sheet[open]');
    await page.evaluate(() => window.ac.abort());
    assert.deepEqual(await result(page), { thrown: 'AbortError' });
    await page.waitForFunction(() => !document.querySelector('#confirm-sheet').open);
    assert.match(await page.textContent('#agent-presence'), /The assistant stopped: Place your order\./);
    assert.equal(await page.evaluate(() => window.trailhead.orders.placed.length), 0);
    await context.close();
  });

  await test(`${label}: signing out mid-checkout ends the pending call as refused (SESSION_ENDED)`, async () => {
    const { page, context } = await open(browser);
    await signIn(page);
    await startCheckout(page);
    await page.waitForSelector('#confirm-sheet[open]');
    await page.evaluate(() => window.trailhead.session.signOut());
    assert.deepEqual(await result(page), { status: 'refused', code: 'SESSION_ENDED', message: 'The user signed out, so nothing was ordered.' });
    assert.equal(await page.evaluate(() => document.querySelector('#confirm-sheet').open), false);
    assert.equal(await page.evaluate(() => window.trailhead.orders.placed.length), 0);
    await context.close();
  });
  await test(`${label}: checkout with an empty cart returns an EMPTY_CART error`, async () => {
    const { page, context } = await open(browser);
    await signIn(page);
    await page.evaluate(() => window.trailhead.cart.clear());
    await startCheckout(page);
    const r = await result(page);
    assert.equal(r.status, 'error');
    assert.equal(r.code, 'EMPTY_CART');
    assert.equal(await page.evaluate(() => !!document.querySelector('#confirm-sheet').open), false);
    await context.close();
  });
}

await test('chromium: a tool call does not give the page user activation', async () => {
  // No Playwright evaluate() before the measurement: evaluate() itself counts as a user gesture.
  const { page, context } = await open(real, { init: () => {
    window.addEventListener('load', () => setTimeout(async () => {
      await document.modelContext.registerTool({ name: 'probe_activation', description: 'Report user activation state',
        execute: async () => ({ isActive: navigator.userActivation.isActive, hasBeenActive: navigator.userActivation.hasBeenActive }) });
      const t = (await document.modelContext.getTools()).find((x) => x.name === 'probe_activation');
      const before = navigator.userActivation.hasBeenActive;
      window.activation = { before, inside: JSON.parse(await document.modelContext.executeTool(t, {})) };
    }, 200));
  }, wait: false });
  await page.waitForTimeout(1500);   // polling with waitForFunction() would itself grant activation
  assert.deepEqual(await page.evaluate(() => window.activation),
    { before: false, inside: { isActive: false, hasBeenActive: false } });
  await context.close();
});

await plain.close(); await real.close();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
