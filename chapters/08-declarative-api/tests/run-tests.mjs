// tests/run-tests.mjs: checks for the Chapter 8 (declarative API) examples.
// Run from this folder:  npm install && npx playwright install chromium && npm test
//
// 1. Static checks: every listing file is byte-identical to the code in index.html,
//    and every .js file passes `node --check`.
// 2. Plain Chromium (no WebMCP): the forms work for a person, and the tool attributes,
//    the WebMCP CSS and the submit handlers cause no errors.
// 3. Chromium with --enable-features=WebMCPTesting (the switch behind
//    chrome://flags/#enable-webmcp-testing): the forms become tools, and an agent drives
//    them through the DevTools Protocol's experimental WebMCP domain (WebMCP.invokeTool),
//    which is how a browser agent reaches them. There is no mock here on purpose: what
//    this chapter documents is the browser's own form-to-tool behaviour.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path || 'index.html'));
    res.writeHead(200, { 'content-type': TYPES[extname(path || 'index.html')] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}/`;   // localhost is a secure context

let failures = 0, passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (err) { failures++; console.log(`FAIL ${name}\n     ${String(err.message).replace(/\x1b\[\d+m/g, '').split('\n').slice(0, 14).join('\n     ')}`); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => readFile(join(ROOT, f), 'utf8');

// A date with open tables (not a Monday, two days ahead) and the next Monday.
function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const open = new Date(Date.now() + 2 * 86400000); while (open.getDay() === 1) open.setDate(open.getDate() + 1);
const monday = new Date(Date.now() + 2 * 86400000); while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1);
const DATE = iso(open), MONDAY = iso(monday);

// ---------------------------------------------------------------- static checks
await test('listings 8.2 and 8.4 appear byte-for-byte in index.html', async () => {
  const index = await read('index.html');
  for (const f of ['listings/listing-8-2-search-form-tool.html', 'listings/listing-8-4-book-form-tool.html']) {
    assert.ok(index.includes(await read(f)), `${f} is not in index.html verbatim`);
  }
});
await test('every .js file passes node --check', async () => {
  const js = (await readdir(ROOT)).filter((f) => f.endsWith('.js'));
  for (const f of js) execFileSync(process.execPath, ['--check', join(ROOT, f)], { timeout: 20000 });
  assert.ok(js.length >= 5);
});

const plain = await chromium.launch();
const webmcp = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
console.log(`\nChromium ${webmcp.version()}\n`);

async function openPage(browser, { block = [], url = BASE } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const f of block) await page.route(`**/${f}`, (route) => route.abort());
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#webmcp-status')?.textContent.startsWith('Checking'));
  return { page, errors, context };
}

// An agent's-eye view of the page: the DevTools Protocol's WebMCP domain.
async function agentFor(page) {
  const cdp = await page.context().newCDPSession(page);
  const tools = new Map(), responses = new Map();
  cdp.on('WebMCP.toolsAdded', ({ tools: t }) => t.forEach((x) => tools.set(x.name, x)));
  cdp.on('WebMCP.toolResponded', (r) => responses.set(r.invocationId, r));
  await cdp.send('WebMCP.enable');
  const { frameTree } = await cdp.send('Page.getFrameTree');
  return {
    tools,
    async invoke(toolName, input) {
      const { invocationId } = await cdp.send('WebMCP.invokeTool', { frameId: frameTree.frame.id, toolName, input });
      return invocationId;
    },
    async response(id, ms = 5000) {
      for (let t = 0; t < ms; t += 50) { if (responses.has(id)) return responses.get(id); await wait(50); }
      return null;
    },
    cancel: (invocationId) => cdp.send('WebMCP.cancelInvocation', { invocationId })
  };
}

// ---------------------------------------------------------------- plain browser
await test('no WebMCP: page loads cleanly; attributes and WebMCP CSS are inert', async () => {
  const { page, errors, context } = await openPage(plain);
  assert.equal(await page.evaluate(() => 'modelContext' in document), false);
  assert.equal(await page.evaluate(() => 'agentInvoked' in SubmitEvent.prototype), false);
  assert.match(await page.textContent('#webmcp-status'), /not available/);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('no WebMCP: a person searches, picks a slot and books', async () => {
  const { page, errors, context } = await openPage(plain);
  await page.fill('#search-date', DATE);
  await page.fill('#search-time', '19:00');
  await page.fill('#search-party', '4');
  await page.click('#search-form button[type=submit]');
  await page.waitForSelector('#slots .slot');
  assert.equal(new URL(page.url()).pathname, '/', 'search should stay on the page');
  await page.click('#slots .slot >> nth=0');
  await page.click('#book-form button[type=submit]');
  await page.waitForSelector('#confirmation:not([hidden])');
  assert.match(await page.textContent('#confirmation'), /Reference FT-\d+/);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('no WebMCP: closed-on-Monday check blocks a person too', async () => {
  const { page, context } = await openPage(plain);
  await page.fill('#search-date', MONDAY);
  const msg = await page.$eval('#search-date', (el) => el.validationMessage);
  assert.equal(msg, 'Fjord Table is closed on Mondays.');
  await context.close();
});

// ---------------------------------------------------------------- real WebMCP
await test('WebMCP: both forms are tools; the schema matches Listing 8.3', async () => {
  const { page, errors, context } = await openPage(webmcp);
  const listed = await page.evaluate(async () =>
    (await document.modelContext.getTools()).map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema })));
  const byName = Object.fromEntries(listed.map((t) => [t.name, t]));
  assert.deepEqual(Object.keys(byName).sort(), ['book_table', 'search_availability']);
  const expected = JSON.parse(await read('listings/listing-8-3-synthesized-schema.json'));
  assert.deepEqual(byName.search_availability.inputSchema, expected);
  assert.equal(byName.search_availability.title, '');
  const agent = await agentFor(page);
  await wait(200);
  assert.deepEqual(agent.tools.get('search_availability').annotations, { autosubmit: true });
  assert.equal(agent.tools.get('book_table').annotations, undefined);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('WebMCP: agent search is answered by respondWith() and shown to the person', async () => {
  const { page, errors, context } = await openPage(webmcp);
  const agent = await agentFor(page);
  const id = await agent.invoke('search_availability', { date: DATE, partySize: 4, time: '19:00' });
  const r = await agent.response(id);
  assert.equal(r?.status, 'Completed', JSON.stringify(r));
  assert.equal(r.output.date, DATE);
  assert.equal(r.output.partySize, 4);
  assert.ok(r.output.slots.length > 0 && r.output.slots.every((s) => /^\d\d:\d\d$/.test(s.time)));
  await page.waitForSelector('#slots .slot');
  assert.equal(await page.$$eval('#slots .slot', (b) => b.length), r.output.slots.length);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.deepEqual(errors, []);
  await context.close();
});

await test('WebMCP: in-page executeTool() gets the same result as a JSON string', async () => {
  const { page, context } = await openPage(webmcp);
  const raw = await page.evaluate(async (date) => {
    const tool = (await document.modelContext.getTools()).find((t) => t.name === 'search_availability');
    return document.modelContext.executeTool(tool, { date, partySize: 2 });
  }, DATE);
  assert.equal(typeof raw, 'string');
  assert.equal(JSON.parse(raw).partySize, 2);
  await context.close();
});

await test('WebMCP: validation feedback reaches the agent (custom validity, min/max, enum)', async () => {
  const { page, context } = await openPage(webmcp);
  const agent = await agentFor(page);
  let r = await agent.response(await agent.invoke('search_availability', { date: MONDAY, partySize: 2 }));
  assert.equal(r.status, 'Error');
  assert.match(r.errorText, /date: Fjord Table is closed on Mondays\./);
  r = await agent.response(await agent.invoke('search_availability', { date: DATE, partySize: 20 }));
  assert.equal(r.status, 'Error');
  assert.match(r.errorText, /partySize: Value must be less than or equal to 12/);
  r = await agent.response(await agent.invoke('search_availability', { date: DATE, partySize: 2, seating: 'rooftop' }));
  assert.equal(r.status, 'Error');
  assert.match(r.errorText, /Invalid value "rooftop" for parameter seating/);
  r = await agent.response(await agent.invoke('search_availability', { date: DATE, partySize: 2, guests: 2 }));
  assert.equal(r.status, 'Error');
  assert.match(r.errorText, /no such parameter/);
  await context.close();
});

await test('WebMCP: book_table waits for the person; their click books and answers the agent', async () => {
  const { page, errors, context } = await openPage(webmcp);
  const agent = await agentFor(page);
  const slots = (await agent.response(await agent.invoke('search_availability', { date: DATE, partySize: 2, time: '19:00' }))).output.slots;
  const id = await agent.invoke('book_table', { date: DATE, time: slots[0].time, partySize: 2, notes: 'Anniversary' });
  await page.waitForSelector('#agent-banner:not([hidden])');
  assert.match(await page.textContent('#agent-banner'), /Check the details/);
  assert.equal(await page.$eval('#book-form', (f) => f.matches(':tool-form-active')), true);
  assert.equal(await page.$eval('#book-form button[type=submit]', (b) => b.matches(':tool-submit-active')), true);
  assert.equal(await page.inputValue('#book-notes'), 'Anniversary');
  await wait(500);
  assert.equal(await agent.response(id, 100), null, 'nothing may be booked before the person confirms');
  assert.equal(await page.evaluate(async () => (await import('./availability.js')).availability.bookings.length), 0);
  await page.click('#book-form button[type=submit]');                    // the person confirms
  const r = await agent.response(id);
  assert.equal(r?.status, 'Completed', JSON.stringify(r));
  assert.equal(r.output.status, 'booked');
  assert.match(r.output.reference, /^FT-\d+$/);
  assert.match(await page.textContent('#confirmation'), new RegExp(r.output.reference));
  assert.equal(await page.$eval('#book-form', (f) => f.matches(':tool-form-active')), false);
  await page.waitForFunction(() => document.querySelector('#book-time').value === '');   // reset after the answer
  assert.deepEqual(errors, []);
  await context.close();
});

await test('WebMCP: without toolautosubmit, the person’s click on an invalid fill ends the call with the validation error', async () => {
  const { page, context } = await openPage(webmcp);
  await page.evaluate(() => { window.submits = []; document.querySelector('#book-form').addEventListener('submit', (e) => window.submits.push(e.agentInvoked)); });
  const agent = await agentFor(page);
  const id = await agent.invoke('book_table', { date: DATE, time: '19:00', partySize: 20 });
  await page.waitForSelector('#agent-banner:not([hidden])');
  await wait(300);
  assert.equal(await agent.response(id, 100), null, 'still waiting for the person');
  await page.click('#book-form button[type=submit]');                    // blocked by max="12"
  const r = await agent.response(id);
  assert.equal(r?.status, 'Error', JSON.stringify(r));
  assert.match(r.errorText, /partySize: Value must be less than or equal to 12/);
  await page.fill('#book-party', '2');                                     // the person fixes it
  await page.click('#book-form button[type=submit]');
  await page.waitForSelector('#confirmation:not([hidden])');
  assert.deepEqual(await page.evaluate(() => window.submits), [false]);   // now an ordinary submission
  await context.close();
});

await test('WebMCP: a full sitting comes back as a refused result value', async () => {
  const { page, context } = await openPage(webmcp);
  const agent = await agentFor(page);
  const id = await agent.invoke('book_table', { date: DATE, time: '23:30', partySize: 2 });
  await page.waitForSelector('#agent-banner:not([hidden])');
  await page.click('#book-form button[type=submit]');
  const r = await agent.response(id);
  assert.equal(r.status, 'Completed');
  assert.equal(r.output.status, 'refused');
  assert.equal(r.output.code, 'SLOT_UNAVAILABLE');
  assert.match(r.output.message, /search_availability/);
  await context.close();
});

await test('WebMCP: agent cancels book_table: toolcancel fires, highlight clears, nothing booked', async () => {
  const { page, context } = await openPage(webmcp);
  const agent = await agentFor(page);
  const id = await agent.invoke('book_table', { date: DATE, time: '19:00', partySize: 2 });
  await page.waitForSelector('#agent-banner:not([hidden])');
  await agent.cancel(id);
  const r = await agent.response(id);
  assert.equal(r.status, 'Canceled');
  await page.waitForFunction(() => /stopped/.test(document.querySelector('#agent-banner').textContent));
  assert.equal(await page.$eval('#book-form', (f) => f.matches(':tool-form-active')), false);
  assert.equal(await page.evaluate(async () => (await import('./availability.js')).availability.bookings.length), 0);
  await context.close();
});

await test('WebMCP: resetting the form cancels the call (no toolcancel event in Chromium 156)', async () => {
  const { page, context } = await openPage(webmcp);
  await page.evaluate(() => { window.cancels = 0; document.modelContext.addEventListener('toolcancel', () => window.cancels++); });
  const agent = await agentFor(page);
  const id = await agent.invoke('book_table', { date: DATE, time: '19:00', partySize: 2 });
  await page.waitForSelector('#agent-banner:not([hidden])');
  await page.evaluate(() => document.querySelector('#book-form').reset());
  const r = await agent.response(id);
  assert.equal(r.status, 'Canceled');
  assert.match(r.errorText, /form reset/);
  await wait(300);
  assert.equal(await page.evaluate(() => window.cancels), 0);
  await context.close();
});

await test('WebMCP: without search-form.js the form navigates and the agent gets results.html JSON-LD', async () => {
  const { page, context } = await openPage(webmcp, { block: ['search-form.js'] });
  const agent = await agentFor(page);
  const r = await agent.response(await agent.invoke('search_availability', { date: DATE, partySize: 4 }), 8000);
  assert.equal(r?.status, 'Completed', JSON.stringify(r));
  assert.match(new URL(page.url()).pathname, /results\.html$/);
  assert.ok(Array.isArray(r.output) && r.output.length === 1);
  assert.equal(r.output[0]['@type'], 'ItemList');
  assert.ok(r.output[0].itemListElement.length > 0);
  await context.close();
});

await test('WebMCP: Listing 8.1 (no tool attributes) registers nothing', async () => {
  const { page, context } = await openPage(webmcp);
  const count = await page.evaluate(async (html) => {
    document.body.innerHTML = html;
    await new Promise((r) => setTimeout(r, 100));
    return (await document.modelContext.getTools()).length;
  }, await read('listings/listing-8-1-search-form-before.html'));
  assert.equal(count, 0);
  await context.close();
});

await test('WebMCP: Listing 8.10 (JS-driven form, no submit button) fails at call time', async () => {
  const { page, context } = await openPage(webmcp);
  await page.evaluate((html) => { document.body.innerHTML = html; }, await read('listings/listing-8-10-js-driven-form.html'));
  await wait(150);
  const agent = await agentFor(page);
  const r = await agent.response(await agent.invoke('join_waitlist', { date: DATE }));
  assert.equal(r.status, 'Error');
  assert.match(r.errorText, /No submit button was found/);
  await context.close();
});

await plain.close();
await webmcp.close();
server.close();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
