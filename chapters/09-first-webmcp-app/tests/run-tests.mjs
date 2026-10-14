// tests/run-tests.mjs: checks for the Chapter 9 examples (Fjord Table, end to end).
// Run from this folder:  npm install && npx playwright install chromium && npm test
//
// 1. Static: every .js file passes `node --check`; the relay config parses; the polyfill's
//    Subresource Integrity hash in webmcp/enable.js matches the pinned package; and, when
//    CHAPTER_MD points at the chapter's Markdown, every listing file matches the book.
// 2. Plain Chromium (no WebMCP): the page works for a person, with the tools switched off;
//    the same page with the polyfill (?webmcp-polyfill) and with the dev-only mock.
// 3. Chromium with --enable-features=WebMCPTesting (chrome://flags/#enable-webmcp-testing):
//    native tools, the Test Agent, a browser agent over the DevTools Protocol WebMCP domain,
//    an insecure origin, a blocking Permissions Policy, an Origin-Trial header and the
//    Prompt API planner (with a stub model; see the README).
import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createFjordServer } from '../server.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFile(join(ROOT, f), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Three servers: the default deployment, a blocking policy, and one with a trial token.
async function serve(env) {
  const server = createFjordServer(env);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port };
}
const main = await serve({});
const blocked = await serve({ TOOLS_POLICY: 'tools=()' });
const withToken = await serve({ WEBMCP_OT_TOKEN: 'AnExampleTokenThatIsNotValid==' });
const BASE = `http://localhost:${main.port}/`;   // localhost is a secure context
const POLYFILL_CDN = 'https://cdn.jsdelivr.net/npm/@mcp-b/webmcp-polyfill@6.0.3/dist/index.iife.js';
const POLYFILL_FILE = join(ROOT, 'node_modules/@mcp-b/webmcp-polyfill/dist/index.iife.js');

let failures = 0, passed = 0;
const observed = {};
async function test(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (err) { failures++; console.log(`FAIL ${name}\n     ${String(err.message).split('\n').slice(0, 12).join('\n     ')}`); }
}

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const day = new Date(Date.now() + 2 * 86400000); while (day.getDay() === 1) day.setDate(day.getDate() + 1);
const DATE = iso(day);

// ---------------------------------------------------------------- static checks
await test('every .js file passes node --check', async () => {
  const files = [];
  for (const dir of ['', 'webmcp', 'snippets', 'dev', 'tests']) {
    for (const f of await readdir(join(ROOT, dir))) if (f.endsWith('.js') || f.endsWith('.mjs')) files.push(join(dir, f));
  }
  for (const f of files) execFileSync(process.execPath, ['--check', join(ROOT, f)], { timeout: 20000 });
  assert.ok(files.length >= 9, files.join(', '));
});

await test('relay config parses and pins the relay version', async () => {
  const config = JSON.parse(await read('deploy/claude_desktop_config.json'));
  const args = config.mcpServers['webmcp-local-relay'].args;
  assert.ok(args.includes('@mcp-b/webmcp-local-relay@6.0.3'));
  assert.equal(args[args.indexOf('--widget-origin') + 1], 'http://localhost:3000');
});

await test('polyfill integrity hash in enable.js matches @mcp-b/webmcp-polyfill 6.0.3', async () => {
  const pkg = JSON.parse(await read('node_modules/@mcp-b/webmcp-polyfill/package.json'));
  assert.equal(pkg.version, '6.0.3');
  const hash = 'sha384-' + createHash('sha384').update(await readFile(POLYFILL_FILE)).digest('base64');
  assert.ok((await read('webmcp/enable.js')).includes(hash), `enable.js should carry ${hash}`);
});

if (process.env.CHAPTER_MD) {
  await test('every listing file matches the code in the chapter', async () => {
    const md = await readFile(process.env.CHAPTER_MD, 'utf8');
    const map = JSON.parse(await read('tests/listings.json'));
    for (const [listing, file] of Object.entries(map)) {
      const at = md.indexOf(`**Listing ${listing}`);
      assert.ok(at > 0, `Listing ${listing} caption not found`);
      const fence = md.slice(at).match(/```[a-z]*\n([\s\S]*?)```/);
      assert.equal(fence[1], await read(file), `Listing ${listing} differs from ${file}`);
    }
  });
}

// ---------------------------------------------------------------- browsers
const plain = await chromium.launch();
const webmcp = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
const insecure = await chromium.launch({
  args: ['--enable-features=WebMCPTesting', '--host-resolver-rules=MAP fjord.test 127.0.0.1']
});
console.log(`\nChromium ${webmcp.version()}\n`);

async function openPage(browser, { url = BASE, mock = false, polyfill = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (mock) await page.addInitScript({ path: join(ROOT, 'dev/model-context-mock.js') });
  if (polyfill) {
    // Serve the CDN URL from the installed package: same bytes, so the SRI check still runs.
    await page.route(POLYFILL_CDN, async (route) => route.fulfill({
      body: await readFile(POLYFILL_FILE), contentType: 'application/javascript',
      headers: { 'access-control-allow-origin': '*' } }));
  }
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#webmcp-status').textContent.startsWith('Checking'));
  return { page, errors, context, chip: () => page.textContent('#webmcp-status') };
}

// The Test Agent books a table: search, pick the first slot, book it, and the guest clicks.
async function agentBooks(page, { confirm = true } = {}) {
  await page.waitForFunction(() => window.testAgent);
  const search = await page.evaluate((date) =>
    window.testAgent.call('search_availability', { date, partySize: 2, time: '19:00' }), DATE);
  assert.equal(search.date, DATE);
  assert.ok(search.slots.length > 0 && /^\d\d:\d\d$/.test(search.slots[0].time), JSON.stringify(search));
  await page.waitForSelector('#slots .slot');
  await page.evaluate(([date, time]) => {
    window.pending = window.testAgent.call('book_table', { date, time, partySize: 2, seating: 'no preference' });
  }, [DATE, search.slots[0].time]);
  await page.waitForSelector('#confirm-dialog[open]');
  await wait(300);
  assert.equal(await page.evaluate(() => window.testAgent.transcript.at(-1).raw), undefined,
    'book_table must not resolve before the guest decides');
  await page.click(confirm ? '#confirm-submit' : '#confirm-cancel');
  return page.evaluate(() => window.pending);
}

// ---- plain Chromium
await test('no WebMCP: tools switched off, a person can still search and book', async () => {
  const { page, errors, context, chip } = await openPage(plain);
  assert.equal(await page.evaluate(() => 'modelContext' in document), false);
  assert.match(await chip(), /Agent tools off \(not-supported\)/);
  await page.fill('[name=date]', DATE);
  await page.click('#search-form button[type=submit]');
  await page.click('#slots .slot >> nth=0');
  await page.click('#confirm-submit');
  await page.waitForSelector('#confirmation:not([hidden])');
  assert.match(await page.textContent('#confirmation'), /Booked: FT-\d+/);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('Listing 9.1 console check in plain Chromium', async () => {
  const { page, context } = await openPage(plain);
  const r = await page.evaluate(await read('snippets/check-webmcp.js'));
  observed.consolePlain = r;
  assert.equal(r.secureContext, true);
  assert.equal(r.webmcp, false);
  assert.equal(r.registerTool, 'undefined');
  await context.close();
});

await test('polyfill: ?webmcp-polyfill installs document.modelContext; the Test Agent books', async () => {
  const { page, errors, context, chip } = await openPage(plain, { polyfill: true, url: BASE + '?webmcp-polyfill&test-agent' });
  assert.match(await chip(), /Agent tools on \(polyfill\): search_availability, book_table/);
  const tools = await page.evaluate(() => window.testAgent.tools().then((t) => t.map((x) => x.name)));
  assert.deepEqual(tools.sort(), ['book_table', 'search_availability']);
  const booked = await agentBooks(page);
  assert.equal(booked.status, 'booked', JSON.stringify(booked));
  assert.match(booked.reference, /^FT-\d+$/);
  observed.polyfillRaw = await page.evaluate(() => window.testAgent.transcript[0].raw.slice(0, 60));
  assert.deepEqual(errors, []);
  await context.close();
});

await test('polyfill: a failed download leaves the page working (tools off)', async () => {
  const context = await plain.newContext();
  const page = await context.newPage();
  await page.route(POLYFILL_CDN, (route) => route.abort());
  await page.goto(BASE + '?webmcp-polyfill');
  await page.waitForFunction(() => !document.querySelector('#webmcp-status').textContent.startsWith('Checking'));
  assert.match(await page.textContent('#webmcp-status'), /Agent tools off \(polyfill-failed\)/);
  await context.close();
});

await test('mock (dev only): the Test Agent books against the mock', async () => {
  const { page, errors, context, chip } = await openPage(plain, { mock: true, url: BASE + '?test-agent' });
  assert.match(await chip(), /Agent tools on \(native\)/);   // the mock looks native to the page
  const booked = await agentBooks(page);
  assert.equal(booked.status, 'booked');
  const calls = await page.evaluate(() => window.__webmcpMock.calls.map((c) => c.name));
  assert.deepEqual(calls, ['search_availability', 'book_table']);
  assert.deepEqual(errors, []);
  await context.close();
});

// ---- Chromium with WebMCPTesting
await test('native: both tools registered with their annotations', async () => {
  const { page, errors, context, chip } = await openPage(webmcp, { url: BASE + '?test-agent' });
  assert.match(await chip(), /Agent tools on \(native\): search_availability, book_table/);
  const tools = await page.evaluate(() => window.testAgent.tools().then((ts) =>
    ts.map((t) => ({ name: t.name, annotations: t.annotations, required: t.inputSchema?.required }))));
  observed.nativeTools = tools;
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.equal(byName.search_availability.annotations?.readOnlyHint, true);
  assert.equal(byName.book_table.annotations?.consequentialHint, true);
  assert.deepEqual(byName.book_table.required, ['date', 'time', 'partySize']);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('native: the Test Agent searches and books; nothing is booked until the guest confirms', async () => {
  const { page, errors, context } = await openPage(webmcp, { url: BASE + '?test-agent' });
  const booked = await agentBooks(page);
  assert.equal(booked.status, 'booked', JSON.stringify(booked));
  await page.waitForSelector('#confirmation:not([hidden])');
  assert.deepEqual(errors, []);
  await context.close();
});

await test('native: the guest cancels and the agent hears not_confirmed_by_user', async () => {
  const { page, context } = await openPage(webmcp, { url: BASE + '?test-agent' });
  const r = await agentBooks(page, { confirm: false });
  assert.equal(r.status, 'not_confirmed_by_user');
  await context.close();
});

await test('native: scripted run() uses one result to plan the next call', async () => {
  const { page, context } = await openPage(webmcp, { url: BASE + '?test-agent' });
  const r = await page.evaluate(async (date) => {
    const { createTestAgent, scripted } = await import('./test-agent.js');
    const agent = createTestAgent({ log: () => {}, planner: scripted(
      { tool: 'search_availability', args: { date, partySize: 2, seating: 'terrace' } },
      (t) => ({ done: true, answer: `First terrace slot: ${t[0].result.slots[0]?.time ?? 'none'}` })
    ) });
    return agent.run('Find a terrace table for two');
  }, DATE);
  assert.equal(r.done, true);
  assert.match(r.answer, /First terrace slot: (\d\d:\d\d|none)/);
  assert.ok(r.transcript[0].result.slots.every((s) => s.seating.includes('terrace')));
  await context.close();
});

await test('native: invalid input comes back as a value the planner can read', async () => {
  const { page, context } = await openPage(webmcp, { url: BASE + '?test-agent' });
  const r = await page.evaluate((date) => window.testAgent.call('book_table', { date, time: '7pm', partySize: 2 }), DATE);
  assert.equal(r.status, 'invalid_input');
  const err = await page.evaluate(() => window.testAgent.call('no_such_tool').then(() => null, (e) => e.message));
  assert.match(err, /No tool named "no_such_tool"/);
  await context.close();
});

await test('Listing 9.1 console check with WebMCPTesting', async () => {
  const { page, context } = await openPage(webmcp);
  const r = await page.evaluate(await read('snippets/check-webmcp.js'));
  observed.consoleNative = r;
  assert.equal(r.webmcp, true);
  assert.equal(r.registerTool, 'function');
  assert.equal(r.getTools, 'function');
  await context.close();
});

await test('browser agent over the DevTools Protocol WebMCP domain sees and calls the tools', async () => {
  const { page, context } = await openPage(webmcp);
  const cdp = await context.newCDPSession(page);
  const tools = new Map(), responses = new Map();
  cdp.on('WebMCP.toolsAdded', ({ tools: t }) => t.forEach((x) => tools.set(x.name, x)));
  cdp.on('WebMCP.toolResponded', (r) => responses.set(r.invocationId, r));
  await cdp.send('WebMCP.enable');
  for (let i = 0; i < 40 && tools.size < 2; i++) await wait(50);
  assert.deepEqual([...tools.keys()].sort(), ['book_table', 'search_availability']);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { invocationId } = await cdp.send('WebMCP.invokeTool',
    { frameId: frameTree.frame.id, toolName: 'search_availability', input: { date: DATE, partySize: 4 } });
  for (let i = 0; i < 100 && !responses.has(invocationId); i++) await wait(50);
  const r = responses.get(invocationId);
  assert.equal(r?.status, 'Completed', JSON.stringify(r));
  observed.cdpOutputType = typeof r.output;
  await context.close();
});

await test('insecure origin (http://fjord.test): no document.modelContext, page still works', async () => {
  const { page, errors, context, chip } = await openPage(insecure, { url: `http://fjord.test:${main.port}/` });
  assert.equal(await page.evaluate(() => window.isSecureContext), false);
  assert.equal(await page.evaluate(() => 'modelContext' in document), false);
  assert.match(await chip(), /Agent tools off \(insecure-context\)/);
  await page.click('#search-form button[type=submit]');
  await page.waitForSelector('#slots-heading:not(:empty)');
  assert.deepEqual(errors, []);
  await context.close();
});

await test('Permissions-Policy: tools=() blocks registration; the page still works', async () => {
  const { page, context, chip } = await openPage(webmcp, { url: `http://localhost:${blocked.port}/` });
  const text = await chip();
  observed.blockedChip = text;
  observed.blockedPolicy = await page.evaluate(await read('snippets/check-webmcp.js'));
  assert.match(text, /Agent tools unavailable \(NotAllowedError\)/);
  assert.equal(observed.blockedPolicy.toolsPolicy, false);
  await page.click('#search-form button[type=submit]');
  await page.waitForSelector('#slots-heading:not(:empty)');
  await context.close();
});

await test('server.js sends Permissions-Policy, and Origin-Trial when a token is set', async () => {
  const a = await fetch(BASE);
  assert.equal(a.headers.get('permissions-policy'), 'tools=(self)');
  assert.equal(a.headers.get('origin-trial'), null);
  const b = await fetch(`http://localhost:${withToken.port}/`);
  assert.equal(b.headers.get('origin-trial'), 'AnExampleTokenThatIsNotValid==');
  assert.equal((await fetch(`http://localhost:${withToken.port}/app.js`)).headers.get('origin-trial'), null);
});

await test('an invalid trial token is ignored: no errors, no WebMCP in plain Chromium', async () => {
  const { page, errors, context, chip } = await openPage(plain, { url: `http://localhost:${withToken.port}/` });
  assert.equal(await page.evaluate(() => 'modelContext' in document), false);
  assert.match(await chip(), /Agent tools off/);
  assert.deepEqual(errors, []);
  await context.close();
});

await test('Prompt API planner drives the Test Agent (stub model; real model not available here)', async () => {
  const { page, context } = await openPage(webmcp, { url: BASE + '?test-agent' });
  observed.promptApi = await page.evaluate(async () => {
    if (!('LanguageModel' in self)) return 'LanguageModel not defined';
    try { return `availability(): ${await LanguageModel.availability()}`; } catch (e) { return `${e.name}: ${e.message}`; }
  });
  const r = await page.evaluate(async (date) => {
    // A stand-in for the on-device model: replays two answers and records each prompt.
    const seen = [];
    const answers = [
      { done: false, tool: 'search_availability', args: { date, partySize: 2 } },
      { done: true, answer: 'There are free tables.' }
    ];
    self.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({ prompt: async (text, opts) => { seen.push({ text, opts }); return JSON.stringify(answers[seen.length - 1]); } })
    };
    const { createPromptPlanner } = await import('./prompt-planner.js');
    const { createTestAgent } = await import('./test-agent.js');
    const agent = createTestAgent({ planner: await createPromptPlanner(), log: () => {} });
    const out = await agent.run('Is there a table for two?');
    return { out, enums: seen[0].opts.responseConstraint.properties.tool.enum, second: seen[1].text };
  }, DATE);
  assert.equal(r.out.done, true);
  assert.equal(r.out.answer, 'There are free tables.');
  assert.deepEqual([...r.enums].sort(), ['book_table', 'search_availability']);
  assert.match(r.second, /search_availability\(.*\) -> \{"date"/);
  await context.close();
});

console.log('\nObserved:', JSON.stringify(observed, null, 2));
await Promise.all([plain.close(), webmcp.close(), insecure.close()]);
for (const s of [main, blocked, withToken]) s.server.close();
console.log(`\n${passed} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
