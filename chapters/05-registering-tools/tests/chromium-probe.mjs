// tests/chromium-probe.mjs: what Chromium's own WebMCP does where Chapter 5 says "in Chromium 156".
// Run from chapters/05-registering-tools/:  npm install && npx playwright install chromium && npm run probe:chrome
// (Chapter 5's listings themselves live in ../../fjord-table/ and are tested there; no mock is used here.)
// Each line prints the observation; the script exits non-zero if Chromium stops matching
// what the chapter reports, so a newer Chromium that changes behaviour is noticed.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>WebMCP probe</title><p>probe</p>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
const page = await (await browser.newContext()).newPage();
await page.goto(`http://localhost:${server.address().port}/`);   // localhost is a secure context

const R = await page.evaluate(async () => {
  const mc = document.modelContext;
  const out = { navigatorModelContext: 'modelContext' in navigator };
  const seen = {};
  const name = (e) => `${e.name}`;
  const reg = (tool, opts) => mc.registerTool({ description: 'probe', ...tool }, opts);

  // outputSchema and input validation
  await reg({
    name: 'with_output_schema',
    inputSchema: { type: 'object', properties: { partySize: { type: 'integer', minimum: 1 } }, required: ['partySize'] },
    outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } } },
    execute: async (input, options) => { seen.input = input; seen.optionKeys = Object.keys(options); return { ok: true }; },
  });
  // no inputSchema at all
  out.noSchemaRegisters = await reg({ name: 'no_schema', execute: async () => 'x' }).then(() => true, name);

  // return values (Table 5.5)
  const returns = {
    object: () => ({ status: 'booked', reference: 'FT-1042' }),
    string: () => 'Booked for 19:00',
    number: () => 42,
    nan: () => NaN,
    date: () => ({ d: new Date(Date.UTC(2026, 9, 15)) }),
    map: () => ({ m: new Map([[1, 2]]) }),
    undefined: () => undefined,
    bigint: () => ({ n: 1n }),
    circular: () => { const o = {}; o.self = o; return o; },
    thrown: () => { throw new Error('a message the agent never sees'); },
  };
  for (const [k, f] of Object.entries(returns)) await reg({ name: `return_${k}`, execute: async () => f() });

  const tools = await mc.getTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  out.registeredKeys = Object.keys(byName.with_output_schema).sort();
  out.noSchemaHasInputSchema = 'inputSchema' in byName.no_schema;
  out.absentTitle = byName.no_schema.title;

  await mc.executeTool(byName.with_output_schema, { partySize: 'forty', extra: true });
  out.invalidInputReachedExecute = seen.input;
  out.executeOptionKeys = seen.optionKeys;

  out.returns = {};
  for (const k of Object.keys(returns)) {
    out.returns[k] = await mc.executeTool(byName[`return_${k}`], {})
      .then((v) => ({ resolved: v }), (e) => ({ rejected: name(e) }));
  }

  // a call to a tool that was unregistered (draft: NotFoundError)
  const ac = new AbortController();
  await reg({ name: 'gone', execute: async () => 'x' }, { signal: ac.signal });
  const gone = (await mc.getTools()).find((t) => t.name === 'gone');
  ac.abort();
  out.unregistered = await mc.executeTool(gone, {}).then((v) => ({ resolved: v }), (e) => ({ rejected: name(e) }));

  // the caller aborts (draft and Chromium: AbortError)
  await reg({ name: 'slow', execute: (i, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))) });
  const slow = (await mc.getTools()).find((t) => t.name === 'slow');
  const caller = new AbortController();
  const pending = mc.executeTool(slow, {}, { signal: caller.signal });
  setTimeout(() => caller.abort(), 20);
  out.callerAbort = await pending.then((v) => ({ resolved: v }), (e) => ({ rejected: name(e) }));
  return out;
});

// Registering the same name again while the schema is being serialized: the 15 October 2026
// draft rejects it with InvalidStateError (PR #347). Run on its own page, because in
// Chromium 156 it crashed the renderer.
const racePage = await (await browser.newContext()).newPage();
await racePage.goto(`http://localhost:${server.address().port}/`);
R.reRegisterDuringSerialization = await racePage.evaluate(async () => {
  const mc = document.modelContext;
  const inputSchema = { toJSON() {
    mc.registerTool({ name: 'race', description: 'inner', execute: async () => 1 }).catch(() => {});
    return { type: 'object', properties: {} };
  } };
  return mc.registerTool({ name: 'race', description: 'outer', inputSchema, execute: async () => 1 })
    .then(() => 'resolved', (e) => e.name);
}).catch((e) => (/crash/i.test(e.message) ? 'renderer crashed' : `error: ${e.message}`));

console.log(`Chromium ${browser.version()} with --enable-features=WebMCPTesting\n`);
console.log(JSON.stringify(R, null, 2));
await browser.close();
server.close();

// What Chapter 5 reports (15 October 2026). A failure here means Chromium changed.
assert.equal(R.navigatorModelContext, false);
assert.equal(R.noSchemaRegisters, true);
assert.equal(R.noSchemaHasInputSchema, false);
assert.equal(R.absentTitle, '');
assert.ok(!R.registeredKeys.includes('outputSchema'), 'outputSchema is dropped');
assert.deepEqual(R.invalidInputReachedExecute, { partySize: 'forty', extra: true }, 'no inputSchema validation');
assert.deepEqual(R.executeOptionKeys, ['signal'], 'no continuation/invocation object');
assert.deepEqual(R.returns.object, { resolved: '{"status":"booked","reference":"FT-1042"}' });
assert.deepEqual(R.returns.string, { resolved: 'Booked for 19:00' });
assert.deepEqual(R.returns.number, { resolved: '42' });
assert.deepEqual(R.returns.nan, { resolved: 'NaN' });
assert.deepEqual(R.returns.date, { resolved: '{"d":"2026-10-15T00:00:00.000Z"}' });
assert.deepEqual(R.returns.map, { resolved: '{"m":{}}' });
assert.deepEqual(R.returns.undefined, { resolved: 'undefined' });
for (const k of ['bigint', 'circular', 'thrown']) assert.deepEqual(R.returns[k], { rejected: 'UnknownError' }, k);
assert.deepEqual(R.unregistered, { rejected: 'UnknownError' });
assert.deepEqual(R.callerAbort, { rejected: 'AbortError' });
assert.equal(R.reRegisterDuringSerialization, 'renderer crashed');
console.log('\nall observations match Chapter 5');
