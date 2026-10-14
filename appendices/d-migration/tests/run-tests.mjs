// Appendix D checks.
// 1. node --check on every listing.
// 2. The "after" code (Listings D.3-D.5) in Chromium with --enable-features=WebMCPTesting.
// 3. The "before" code (Listings D.1-D.2): in Chromium 156 it no longer works (no
//    navigator.modelContext); against a dev-only mock of the old shape it does what the
//    appendix says it did.
// Run: npm install && npx playwright install chromium && npm test
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message || e).split('\n').join('\n     ')); }
}

for (const f of ['before/fjord-tools.before.js', 'before/register-unregister.before.js']) {
  await test('node --check ' + f, () => execFileSync(process.execPath, ['--check', path.join(root, f)]));
}
for (const f of ['after/fjord-tools.js', 'after/tool-set.js', 'after/detect.js']) {
  await test('node --check (module) ' + f, () =>
    execFileSync(process.execPath, ['--input-type=module', '--check'], { input: require_(f) }));
}
function require_(f) { return execFileSync('cat', [path.join(root, f)]); }

// Static server for this folder on localhost (a secure context).
const types = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer(async (req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const body = await fs.readFile(p); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'text/plain' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/tests/fixtures/after.html');
  await page.waitForFunction(() => window.ready === true);
  console.log('     Chromium ' + browser.version());

  await test('Listing D.5: webmcpStatus() is "current" in Chromium 156', async () => {
    assert.equal(await page.evaluate(() => webmcpStatus()), 'current');
  });

  const r = await page.evaluate(async () => {
    const out = { changes: 0 };
    document.modelContext.addEventListener('toolchange', () => out.changes++);
    window.view = await registerFjordTools({ availability, bookings, confirmBooking });
    const tools = await document.modelContext.getTools();
    out.names = tools.map((t) => t.name);
    out.annotations = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    const T = (n) => tools.find((t) => t.name === n);
    out.search = JSON.parse(await document.modelContext.executeTool(T('search_availability'), { date: '2026-11-06', partySize: 4 }));
    confirmAnswer = true;
    out.booked = JSON.parse(await document.modelContext.executeTool(T('book_table'), { date: '2026-11-06', time: '19:30', partySize: 4, name: 'Kari' }));
    confirmAnswer = false;
    out.declined = JSON.parse(await document.modelContext.executeTool(T('book_table'), { date: '2026-11-06', time: '19:30', partySize: 4, name: 'Kari' }));
    out.confirmCalls = confirmCalls;
    out.changesBefore = out.changes;
    view.abort();
    await new Promise((s) => setTimeout(s, 150));
    out.after = (await document.modelContext.getTools()).map((t) => t.name);
    return out;
  });

  await test('Listing D.3: both tools register on document.modelContext', () => {
    assert.deepEqual(r.names, ['book_table', 'search_availability']);
  });
  await test('Listing D.3: annotations survive (readOnlyHint, consequentialHint)', () => {
    assert.equal(r.annotations.search_availability.readOnlyHint, true);
    assert.equal(r.annotations.book_table.consequentialHint, true);
  });
  await test('Listing D.3: search_availability returns slots through executeTool()', () => {
    assert.deepEqual(r.search, { date: '2026-11-06', partySize: 4, slots: ['18:00', '19:30'] });
  });
  await test('Listing D.3: book_table goes through the page\'s own confirmation', () => {
    assert.deepEqual(r.booked, { booked: true, reference: 'FT-20261106-4' });
    assert.deepEqual(r.declined, { booked: false, reason: 'The user declined.' });
    assert.equal(r.confirmCalls, 2);
  });
  await test('Listing D.3: view.abort() unregisters both tools (replaces clearContext)', () => {
    assert.deepEqual(r.after, []);
    assert.ok(r.changes > r.changesBefore, 'toolchange fired on unregistration');
  });

  const s = await page.evaluate(async () => {
    const out = {};
    const tool = (name) => ({ name, description: 'test tool ' + name, execute: () => name });
    const names = async () => (await document.modelContext.getTools()).map((t) => t.name);
    const other = new AbortController();
    await document.modelContext.registerTool(tool('someone_elses_tool'), { signal: other.signal });
    const set = createToolSet();
    await set.replace([tool('menu_search'), tool('opening_hours')]);
    out.first = await names();
    await set.replace([tool('book_table')]);
    await new Promise((r) => setTimeout(r, 100));
    out.second = await names();
    set.clear();
    await new Promise((r) => setTimeout(r, 100));
    out.cleared = await names();
    try { await set.replace([tool('dup'), tool('dup')]); out.dup = 'resolved'; } catch (e) { out.dup = e.name; }
    other.abort(); set.clear();
    return out;
  });
  await test('Listing D.4: replace() swaps this set and leaves other tools alone', () => {
    assert.deepEqual(s.first, ['menu_search', 'opening_hours', 'someone_elses_tool']);
    assert.deepEqual(s.second, ['book_table', 'someone_elses_tool']);
    assert.deepEqual(s.cleared, ['someone_elses_tool']);
  });
  await test('Listing D.4: a duplicate name inside one set rejects (InvalidStateError)', () => {
    assert.equal(s.dup, 'InvalidStateError');
  });
  await test('no page errors in the "after" page', () => assert.deepEqual(errors, []));

  // BEFORE code in real Chromium 156: the legacy namespace is gone.
  const p2 = await browser.newPage();
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(e.message));
  await p2.goto(base + '/tests/fixtures/before.html');
  await p2.waitForFunction(() => window.ready === true);
  const legacy = await p2.evaluate(async () => ({
    nav: 'modelContext' in navigator,
    tools: (await document.modelContext.getTools()).map((t) => t.name)
  }));
  await test('Listing D.1 in Chromium 156: the guard skips it, no tools, no errors', () => {
    assert.equal(legacy.nav, false); assert.deepEqual(legacy.tools, []); assert.deepEqual(errs2, []);
  });
  await test('Listing D.2 in Chromium 156: navigator.modelContext is undefined (TypeError)', async () => {
    const err = await p2.evaluate(async (src) => {
      try { (0, eval)(src); return 'ran'; } catch (e) { return e.name; }
    }, require_('before/register-unregister.before.js').toString());
    assert.equal(err, 'TypeError');
  });

  // BEFORE code against the dev-only mock of the old shape.
  const p3 = await browser.newPage();
  await p3.goto(base + '/tests/fixtures/before.html?mock');
  await p3.waitForFunction(() => window.ready === true);
  const m = await p3.evaluate(async () => {
    const mc = navigator.modelContext;
    const out = { names: mc._names() };
    out.search = JSON.parse(await mc._call('search_availability', { date: '2026-11-06', partySize: 2 }));
    out.book = JSON.parse(await mc._call('book_table', { date: '2026-11-06', time: '18:00', partySize: 2, name: 'Ola' }));
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    out.afterClear = mc._names();
    out.log = [...mc._log];
    return out;
  });
  await test('Listing D.1 against the old shape: provideContext() sets both tools', () => {
    assert.deepEqual(m.names, ['book_table', 'search_availability']);
    assert.deepEqual(m.search.slots, ['18:00', '19:30']);
  });
  await test('Listing D.1 against the old shape: book_table used client.requestUserInteraction()', () => {
    assert.equal(m.book.booked, true); assert.ok(m.log.includes('requestUserInteraction'));
  });
  await test('Listing D.1 against the old shape: clearContext() wiped every tool', () => {
    assert.deepEqual(m.afterClear, []); assert.ok(m.log.includes('clearContext'));
  });
  const m2 = await p3.evaluate((src) => { navigator.modelContext.clearContext(); (0, eval)(src); return navigator.modelContext._log.slice(-2); },
    require_('before/register-unregister.before.js').toString());
  await test('Listing D.2 against the old shape: registerTool() then unregisterTool(name)', () => {
    assert.deepEqual(m2, ['registerTool:search_availability', 'unregisterTool:search_availability']);
  });
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
