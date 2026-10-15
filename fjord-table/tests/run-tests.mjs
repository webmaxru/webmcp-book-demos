// tests/run-tests.mjs: end-to-end checks for the Fjord Table demo.
// Run from fjord-table/:  npm install && npx playwright install chromium && npm test
//
// 1. Plain browser (no WebMCP): the page loads with no errors and a person can book a table.
// 2. With WebMCP: the tools register, book_table follows the booking view, and
//    executeTool() returns what Chapters 4 and 5 say it should.
//      npm test             WebMCP comes from dev/model-context-mock.js, injected before the page loads
//      npm run test:chrome  WebMCP comes from Chromium itself (--enable-features=WebMCPTesting,
//                           the switch behind chrome://flags/#enable-webmcp-testing); no mock
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path || 'index.html'));
    res.writeHead(200, { 'content-type': TYPES[extname(path || 'index.html')] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
// localhost is a secure context, which WebMCP requires.
const URL_ = `http://localhost:${server.address().port}/`;

const REAL = process.env.WEBMCP === 'chrome';
const plainBrowser = await chromium.launch();
const webmcpBrowser = REAL ? await chromium.launch({ args: ['--enable-features=WebMCPTesting'] }) : plainBrowser;
console.log(`Chromium ${plainBrowser.version()} · WebMCP from ${REAL ? 'the browser (flag)' : 'dev/model-context-mock.js'}\n`);
const LABEL = REAL ? 'chrome WebMCP' : 'mock WebMCP';
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (err) { failures++; console.log(`FAIL ${name}\n     ${err.message.replace(/\x1b\[\d+m/g, '').split('\n').slice(0, 12).join('\n     ')}`); }
}

async function openPage({ mock }) {
  const context = await (mock ? webmcpBrowser : plainBrowser).newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (mock && !REAL) await page.addInitScript({ path: join(ROOT, 'dev/model-context-mock.js') });
  await page.goto(URL_);
  await page.waitForFunction(() => !document.querySelector('#webmcp-status').textContent.startsWith('Checking'));
  return { page, errors, context };
}

// A date with open tables: the first non-Monday at least two days ahead.
function nextOpenDate() {
  const d = new Date(Date.now() + 2 * 86400000);
  while (d.getDay() === 1) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const DATE = nextOpenDate();

// ---------------------------------------------------------------------------
await test('no WebMCP: page loads cleanly and says it works as a normal page', async () => {
  const { page, errors, context } = await openPage({ mock: false });
  assert.equal(await page.evaluate(() => 'modelContext' in document), false);
  assert.match(await page.textContent('#webmcp-status'), /not available/);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('no WebMCP: a person books a table through the UI', async () => {
  const { page, errors, context } = await openPage({ mock: false });
  await page.click('nav a[href="#/book"]');
  await page.fill('input[name=date]', DATE);
  await page.fill('input[name=time]', '19:00');
  await page.selectOption('select[name=partySize]', '4');
  await page.click('#search-form button[type=submit]');
  await page.waitForSelector('#slots .slot');
  const times = await page.$$eval('#slots .slot', (b) => b.map((x) => x.dataset.time));
  assert.ok(times.length >= 1 && times.length <= 5, `expected 1-5 slots, got ${times}`);
  await page.click('#slots .slot');
  await page.waitForSelector('#confirm-dialog[open]');
  assert.match(await page.textContent('#confirm-intro'), /Check the details/);
  await page.fill('textarea[name=notes]', 'Birthday');
  await page.click('#confirm-submit');
  await page.waitForSelector('#confirmation:not([hidden])');
  const text = await page.textContent('#confirmation');
  assert.match(text, /Booked: FT-\d+ .* 4 guests/);
  assert.equal(await page.$eval('#confirm-dialog', (d) => d.open), false);
  assert.deepEqual(errors, []);
  console.log(`     ${text}`);
  await context.close();
});

// ---------------------------------------------------------------------------
// Wait until the page's tool list satisfies a condition (polls getTools(), works with mock or real).
const waitForTools = (page, check, arg) => page.evaluate(async ({ check, arg }) => {
  const ok = new Function('tools', 'arg', `return (${check})(tools, arg)`);
  for (let i = 0; i < 100; i++) {
    if (ok(await document.modelContext.getTools(), arg)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('timed out waiting for tools: ' + check);
}, { check: check.toString(), arg });
const waitForCount = (page, n) => waitForTools(page, (tools, n) => tools.length === n, n);
const waitForTitle = (page, title) =>
  waitForTools(page, (tools, title) => tools.find((t) => t.name === 'book_table')?.title === title, title);

const toolNames = (page) => page.evaluate(async () =>
  (await document.modelContext.getTools()).map((t) => t.name).sort());

await test(`${LABEL}: search_availability at startup; book_table only on the booking view`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  await waitForTools(page, (tools) => tools.length >= 1);
  assert.deepEqual(await toolNames(page), ['search_availability']);
  // the status chip follows toolchange events
  await page.waitForFunction(() => /WebMCP on · tools: search_availability$/.test(
    document.querySelector('#webmcp-status').textContent));
  await page.click('nav a[href="#/book"]');
  await waitForCount(page, 2);
  assert.deepEqual(await toolNames(page), ['book_table', 'search_availability']);
  await page.waitForFunction(() => /book_table/.test(document.querySelector('#webmcp-status').textContent));
  await page.click('nav a[href="#/menu"]');
  await waitForCount(page, 1);
  assert.deepEqual(await toolNames(page), ['search_availability']);
  // The draft types RegisteredTool.inputSchema as an object (Chromium 156 agrees).
  const schema = await page.evaluate(async () => {
    const s = (await document.modelContext.getTools())[0].inputSchema;
    return typeof s === 'string' ? JSON.parse(s) : s;
  });
  assert.deepEqual(schema.required, ['date', 'partySize']);
  assert.deepEqual(errors, []);
  await context.close();
});

await test(`${LABEL}: Listing 4.2 verbatim, an in-page agent calling search_availability`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  const logged = [];
  page.on('console', (m) => { if (m.type() === 'log') logged.push(m.text()); });
  const slots = await page.evaluate(async () => {
    // ---- Listing 4.2, unchanged ----
    const tools  = await document.modelContext.getTools();
    const search = tools.find((t) => t.name === 'search_availability');

    const json = await document.modelContext.executeTool(search, {
      date: '2026-11-20', time: '19:00', partySize: 4
    });
    console.log(JSON.parse(json).slots);   // e.g. ["18:30", "19:00", "20:15"]
    // ---------------------------------
    return JSON.parse(json);
  });
  assert.equal(slots.date, '2026-11-20');
  assert.equal(slots.partySize, 4);
  assert.ok(Array.isArray(slots.slots) && slots.slots.length > 0 && slots.slots.length <= 5);
  for (const t of slots.slots) assert.match(t, /^\d{2}:\d{2}$/);
  // "the user sees what the agent found": the page switched to the booking view with the slots
  await page.waitForSelector('#slots .slot');
  assert.equal(await page.evaluate(() => location.hash), '#/book');
  assert.deepEqual(await page.$$eval('#slots .slot', (b) => b.map((x) => x.dataset.time)), slots.slots);
  console.log(`     2026-11-20, 4 guests → ${slots.slots.join(', ')}`);
  assert.deepEqual(errors, []);
  await context.close();
});

// What an in-page agent does: find the tool with getTools(), call it with executeTool().
const execute = (page, name, input) => page.evaluate(async ({ name, input }) => {
  const tools = await document.modelContext.getTools();
  const tool = tools.find((t) => t.name === name) ??
    { name, description: 'not registered', window, origin: location.origin };
  try { return JSON.parse(await document.modelContext.executeTool(tool, input)); }
  catch (e) { return { thrown: e.name }; }
}, { name, input });

await test(`${LABEL}: book_table returns recoverable failures as values`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  await page.goto(URL_ + '#/book');
  await waitForCount(page, 2);

  const tooMany = await execute(page, 'book_table', { date: DATE, time: '19:00', partySize: 40 });
  assert.equal(tooMany.status, 'error');
  assert.equal(tooMany.code, 'INVALID_INPUT');
  assert.match(tooMany.message, /1 to 12/);

  const badDate = await execute(page, 'book_table', { date: '20/11/2026', time: '19:00', partySize: 2 });
  assert.equal(badDate.status, 'error');
  assert.equal(badDate.code, 'INVALID_INPUT');
  assert.match(badDate.message, /YYYY-MM-DD/);

  const closed = await execute(page, 'book_table', { date: DATE, time: '23:00', partySize: 2 });
  assert.equal(closed.status, 'refused');
  assert.equal(closed.code, 'SLOT_UNAVAILABLE');
  assert.match(closed.message, /search_availability/);

  const missing = await execute(page, 'book_table', {});
  assert.equal(missing.status, 'error');
  assert.equal(missing.code, 'INVALID_INPUT');

  // The draft says "tool not found" surfaces as NotFoundError. Chromium 156 throws UnknownError.
  const unknown = await execute(page, 'no_such_tool', {});
  if (REAL) {
    assert.ok(unknown.thrown, 'calling an unregistered tool must throw');
    console.log(`     unregistered tool → ${unknown.thrown} (the draft says NotFoundError)`);
  } else {
    assert.equal(unknown.thrown, 'NotFoundError');
  }
  assert.equal(await page.$eval('#confirm-dialog', (d) => d.open), false, 'no dialog for failed calls');
  assert.deepEqual(errors, []);
  await context.close();
});

async function firstOpenSlot(page, partySize) {
  const r = await execute(page, 'search_availability', { date: DATE, time: '19:00', partySize });
  assert.ok(r.slots.length > 0, 'no slots on ' + DATE);
  return r.slots[0];
}

await test(`${LABEL}: book_table → confirm in the site UI → booked with a reference`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  await page.goto(URL_ + '#/book');
  await waitForCount(page, 2);
  const time = await firstOpenSlot(page, 2);
  const pending = execute(page, 'book_table',
    { date: DATE, time, partySize: 2, seating: 'no preference', notes: 'Anniversary' });
  await page.waitForSelector('#confirm-dialog[open]');
  assert.match(await page.textContent('#confirm-intro'), /assistant filled this in/);
  assert.equal(await page.inputValue('textarea[name=notes]'), 'Anniversary');
  await page.click('#confirm-submit');
  const result = await pending;
  assert.equal(result.status, 'booked');
  assert.match(result.reference, /^FT-\d+$/);
  assert.deepEqual({ date: result.date, time: result.time, partySize: result.partySize }, { date: DATE, time, partySize: 2 });
  assert.match(await page.textContent('#confirmation'), new RegExp(result.reference));
  console.log(`     ${JSON.stringify(result)}`);
  assert.deepEqual(errors, []);
  await context.close();
});

await test(`${LABEL}: the user cancels → cancelled_by_user, nothing booked`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  await page.goto(URL_ + '#/book');
  await waitForCount(page, 2);
  const time = await firstOpenSlot(page, 3);
  const pending = execute(page, 'book_table', { date: DATE, time, partySize: 3 });
  await page.waitForSelector('#confirm-dialog[open]');
  await page.click('#confirm-cancel');
  assert.deepEqual(await pending, { status: 'cancelled_by_user',
    message: 'The guest closed the booking form without confirming. Nothing was booked.' });
  assert.equal(await page.isHidden('#confirmation'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

await test(`${LABEL}: the caller aborts mid-confirmation → AbortError, dialog closes, nothing booked`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  await page.goto(URL_ + '#/book');
  await waitForCount(page, 2);
  const time = await firstOpenSlot(page, 2);
  const outcome = page.evaluate(async ({ DATE, time }) => {
    const ctl = new AbortController();
    const tool = (await document.modelContext.getTools()).find((t) => t.name === 'book_table');
    const p = document.modelContext.executeTool(tool, { date: DATE, time, partySize: 2 },
                                                { signal: ctl.signal });
    await new Promise((r) => setTimeout(r, 800));        // the dialog is open by now
    ctl.abort();
    try { await p; return 'resolved'; } catch (e) { return e.name; }
  }, { DATE, time });
  await page.waitForSelector('#confirm-dialog[open]');
  assert.equal(await outcome, 'AbortError');
  // the tool's own signal aborted too, so confirmWithUser() closed the form
  await page.waitForFunction(() => !document.querySelector('#confirm-dialog').open);
  assert.equal(await page.isHidden('#confirmation'), true);
  // Chromium logs the tool's rejection (the abort reason) to the console; that is expected here.
  const unexpected = errors.filter((e) => !/^WebMCP tool execution failed/.test(e));
  if (errors.length > unexpected.length) console.log(`     browser console: ${errors.join(' | ')}`);
  assert.deepEqual(unexpected, []);
  await context.close();
});

await test(`${LABEL}: relabelling re-registers book_table with Norwegian text (Listing 5.5)`, async () => {
  const { page, errors, context } = await openPage({ mock: true });
  await page.goto(URL_ + '#/book');
  await waitForCount(page, 2);
  await page.selectOption('#tool-locale', 'nb');
  await waitForTitle(page, 'Bestill bord');
  const listed = await page.evaluate(async () =>
    (await document.modelContext.getTools()).find((t) => t.name === 'book_table'));
  assert.equal(listed.title, 'Bestill bord');
  assert.match(listed.description, /^Bestill bord på Fjord Table/);
  const time = await firstOpenSlot(page, 2);
  const pending = execute(page, 'book_table', { date: DATE, time, partySize: 2 });
  await page.waitForSelector('#confirm-dialog[open]');
  await page.click('#confirm-submit');
  assert.equal((await pending).status, 'booked', 'the relabelled tool still books');
  // leaving and re-entering the view keeps the chosen language
  await page.click('nav a[href="#/menu"]');
  await page.click('nav a[href="#/book"]');
  await waitForTitle(page, 'Bestill bord');
  assert.deepEqual(errors, []);
  await context.close();
});

await plainBrowser.close();
if (REAL) await webmcpBrowser.close();
server.close();
console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
