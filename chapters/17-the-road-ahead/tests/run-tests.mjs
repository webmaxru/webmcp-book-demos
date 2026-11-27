// tests/run-tests.mjs: checks for the chapter 17 listings.
// Run from this folder:  npm install && npx playwright install chromium && npm test
//
// 1. Node: syntax of every file, Listing 17.1's data and output, the input checker,
//    and (when CHAPTER_MD points at the chapter's Markdown) that the listings in
//    src/ are byte-identical to the book.
// 2. Browser (tests/index.html + src/), in Chromium:
//      npm test             WebMCP comes from dev/model-context-mock.js, injected before the page loads
//      npm run test:chrome  WebMCP comes from Chromium itself (--enable-features=WebMCP,WebMCPTesting); no mock
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REAL = process.env.WEBMCP === 'chrome';

function versionAtLeast(actual, minimum) {
  const a = String(actual).split('.').map((part) => Number(part) || 0);
  const b = minimum.split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}
let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (err) { failures++; console.log(`FAIL ${name}\n     ${String(err.message).split('\n').slice(0, 12).join('\n     ')}`); }
}

// ---------------------------------------------------------------------------
// 1. Node
await test('every file in src/ passes node --check', async () => {
  for (const f of await readdir(join(ROOT, 'src'))) {
    execFileSync(process.execPath, ['--check', join(ROOT, 'src', f)], { timeout: 20000 });
  }
});

const { catalog } = await import(pathToFileURL(join(ROOT, 'src/catalog.js')));
const { checkInput } = await import(pathToFileURL(join(ROOT, 'src/check-input.js')));
const { registerCatalog } = await import(pathToFileURL(join(ROOT, 'src/adapter.js')));

await test('Listing 17.1: the definition is plain data with an outputSchema', () => {
  assert.deepEqual(catalog.map((t) => t.name), ['search_products']);
  const [t] = catalog;
  assert.match(t.name, /^[A-Za-z0-9_.\-]{1,128}$/);
  assert.ok(t.description.length <= 500, 'within Chrome\'s provisional 500-character budget');
  assert.equal(t.outputSchema.type, 'object');
  assert.equal(t.annotations.readOnlyHint, true);
});

await test('Listing 17.1: run() returns what outputSchema promises, for several inputs', () => {
  const inputs = [
    { query: 'tent' }, { query: 'tent', maxPrice: 4000 }, { query: 'tent', inStockOnly: true },
    { query: 'sleeping bag', category: 'sleeping-bags' }, { query: 'kayak' },
  ];
  for (const input of inputs) {
    const out = catalog[0].run(input);
    assert.deepEqual(checkInput(catalog[0].outputSchema, out, 'output'), [], JSON.stringify(input));
  }
  assert.deepEqual(catalog[0].run({ query: 'tent', maxPrice: 4000 }).products.map((p) => p.sku), ['TH-TENT-2P']);
});

await test('Listing 17.2: passes Listing 17.1 outputSchema through and still returns an input error', async () => {
  const previousDocument = globalThis.document;
  const registered = [];
  globalThis.document = { modelContext: {
    registerTool: async (tool) => { registered.push(tool); }
  } };
  try {
    await registerCatalog(catalog);
    assert.deepEqual(registered.map((tool) => tool.name), ['search_products']);
    const [tool] = registered;
    assert.equal(tool.outputSchema, catalog[0].outputSchema);

    const invalidResult = await tool.execute({ maxPrice: -5 });
    assert.equal(invalidResult.status, 'error');
    assert.equal(invalidResult.code, 'INVALID_ARGUMENT');
    assert.match(invalidResult.message, /input\.query is required/);
    // Listing 17.1's schema describes the success result only.
    assert.ok(checkInput(tool.outputSchema, invalidResult, 'output').some((problem) => problem.includes('products')));

    const successResult = await tool.execute({ query: 'tent' });
    assert.deepEqual(checkInput(tool.outputSchema, successResult, 'output'), []);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

await test('check-input.js (filler): rejects what the browser would let through', () => {
  const s = catalog[0].inputSchema;
  assert.deepEqual(checkInput(s, { query: 'tent' }), []);
  assert.deepEqual(checkInput(s, { maxPrice: 3000 }), ['input.query is required']);
  assert.deepEqual(checkInput(s, { query: 'tent', category: 'kayaks' }),
    ['input.category must be one of tents, sleeping-bags, backpacks, footwear, clothing']);
  assert.deepEqual(checkInput(s, { query: 'tent', maxPrice: -1 }), ['input.maxPrice must be at least 0']);
  assert.deepEqual(checkInput(s, 'tent'), ['input must be an object']);
});

if (process.env.CHAPTER_MD) {
  await test('listings in src/ are byte-identical to the chapter (apart from the final newline)', async () => {
    const md = await readFile(process.env.CHAPTER_MD, 'utf8');
    const blocks = [...md.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
    for (const [n, file] of [[1, 'catalog.js'], [2, 'adapter.js'], [3, 'probe.js']]) {
      const src = await readFile(join(ROOT, 'src', file), 'utf8');
      assert.ok(blocks.some((b) => b === src || b.trimEnd() === src.trimEnd()), `Listing 17.${n} (${file}) differs from the chapter`);
    }
  });
}

// ---------------------------------------------------------------------------
// 2. Browser
const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE = `http://localhost:${server.address().port}/tests/index.html`;   // localhost is a secure context

const plain = await chromium.launch();
const webmcp = REAL ? await chromium.launch({ args: ['--enable-features=WebMCP,WebMCPTesting'] }) : plain;
console.log(`\nChromium ${plain.version()} · WebMCP from ${REAL ? 'the browser (flag)' : 'dev/model-context-mock.js'}`);

async function open({ withWebMCP }) {
  const context = await (withWebMCP ? webmcp : plain).newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (withWebMCP && !REAL) await page.addInitScript({ path: join(ROOT, 'dev/model-context-mock.js') });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__trailhead?.ready === true);
  return { page, errors, context };
}
const call = (page, name, input) => page.evaluate(async ([name, input]) => {
  const tool = (await document.modelContext.getTools()).find((t) => t.name === name);
  try {
    const raw = await document.modelContext.executeTool(tool, input);
    return { value: typeof raw === 'string' ? JSON.parse(raw) : raw };
  } catch (e) { return { rejected: e.name }; }
}, [name, input]);
const probe = (page) => page.evaluate(async () => (await import('/src/probe.js')).probeWebMCP());

await test('no WebMCP: Listing 17.2 registers nothing and Listing 17.3 says so', async () => {
  const { page, errors, context } = await open({ withWebMCP: false });
  assert.deepEqual(await page.evaluate(() => window.__trailhead.registered), []);
  const report = await probe(page);
  assert.equal(report.documentModelContext, false);
  assert.equal(report.waitForToolsUntil, false);
  assert.equal(report.executeOptions, null);
  assert.deepEqual(errors, []);
  await context.close();
});

const { page, errors, context } = await open({ withWebMCP: true });

await test('Listing 17.2: registers the catalog behind feature detection', async () => {
  assert.equal(await page.evaluate(() => window.__trailhead.error ?? null), null);
  assert.deepEqual(await page.evaluate(() => window.__trailhead.registered), ['search_products']);
  const tools = await page.evaluate(async () => (await document.modelContext.getTools())
    .map((t) => ({ name: t.name, title: t.title, ro: t.annotations?.readOnlyHint === true, hasOut: 'outputSchema' in t })));
  assert.deepEqual(tools.map((t) => [t.name, t.title, t.ro]), [['search_products', 'Search products', true]]);
  console.log(`     (outputSchema reflected by getTools(): ${tools[0].hasOut})`);
});

await test('Listing 17.2: a valid call returns structured data that matches outputSchema', async () => {
  const r = await call(page, 'search_products', { query: 'tent', maxPrice: 4000 });
  assert.deepEqual(r.value.products.map((p) => p.sku), ['TH-TENT-2P']);
  assert.deepEqual(checkInput(catalog[0].outputSchema, r.value, 'output'), []);
});

await test('Listing 17.2: input the browser lets through is answered with Chapter 11\'s error shape', async () => {
  const r = await call(page, 'search_products', { maxPrice: -5 });
  assert.equal(r.rejected, undefined, 'the call resolves; the agent can correct itself');
  assert.equal(r.value.status, 'error');
  assert.equal(r.value.code, 'INVALID_ARGUMENT');
  assert.equal(r.value.error, undefined, 'no legacy { error: { code } } wrapper');
  assert.match(r.value.message, /input\.query is required/);
  assert.match(r.value.message, /input\.maxPrice must be at least 0/);
  assert.ok(checkInput(catalog[0].outputSchema, r.value, 'output').some((problem) => problem.includes('products')));
});

await test('Listing 17.2: exposedTo is passed through only when given', async () => {
  const seen = await page.evaluate(async () => {
    const { registerCatalog } = await import('/src/adapter.js');
    const mc = document.modelContext;
    const original = mc.registerTool;
    const options = [];
    mc.registerTool = async (_tool, opts) => { options.push(Object.keys(opts).sort()); };
    try {
      const def = { name: 'x', description: 'x', run: () => ({}) };
      await registerCatalog([def], { signal: AbortSignal.abort() });
      await registerCatalog([def], { signal: AbortSignal.abort(), exposedTo: ['https://app.ledgerly.example'] });
    } finally { mc.registerTool = original; delete mc.registerTool; }
    return options;
  });
  assert.deepEqual(seen, [['signal'], ['exposedTo', 'signal']]);
});

await test('Listing 17.3: null outputSchema is not reflected, even when the attribute exists', async () => {
  const { probeWebMCP } = await import(pathToFileURL(join(ROOT, 'src/probe.js')));
  const previous = globalThis.document;
  const install = (outputSchema) => {
    globalThis.document = {
      modelContext: {
        registerTool: async (tool) => { install.tool = { name: tool.name, outputSchema, annotations: { readOnlyHint: true } }; },
        getTools: async () => [install.tool],
        executeTool: async () => JSON.stringify({ options: ['signal'] }),
      },
    };
  };
  try {
    install(null);
    const absent = await probeWebMCP();
    assert.equal(absent.outputSchemaReflected, false);
    assert.equal('outputSchema' in install.tool, true);
    install({ type: 'object', properties: { options: { type: 'array' } } });
    const present = await probeWebMCP();
    assert.equal(present.outputSchemaReflected, true);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

await test('Listing 17.3: the probe reports this browser and cleans up after itself', async () => {
  const report = await probe(page);
  console.log(`     ${JSON.stringify(report)}`);
  assert.equal(report.documentModelContext, true);
  assert.equal(report.getTools, true);
  assert.equal(report.executeTool, true);
  assert.equal(report.waitForToolsUntil, Boolean(REAL) && versionAtLeast(plain.version(), '160.0.8185.0'));
  assert.ok(report.executeOptions.includes('signal'));
  assert.equal(report.outputSchemaReflected, !REAL || versionAtLeast(plain.version(), '159.0.8140.0'));
  if (REAL) {
    // What Chromium 156 with WebMCPTesting reports. A later release may differ; that is the point.
    assert.equal(report.legacyNavigatorModelContext, false);
    assert.equal(report.resumeTool, false);
    assert.deepEqual(report.executeOptions, ['signal']);
    assert.ok(!report.annotationsKept.includes('sensitiveHint'), 'unknown annotation dropped');
  }
  const left = await page.evaluate(async () => (await document.modelContext.getTools()).map((t) => t.name));
  assert.deepEqual(left, ['search_products']);
});

await test('Listing 17.2: a missing waitForToolsUntil does not throw', async () => {
  const info = await page.evaluate(() => {
    const mc = document.modelContext;
    const type = typeof mc.waitForToolsUntil;
    if (type === 'function') return { type, threw: false, value: 'present' };
    let threw = false;
    let value = 'unset';
    try { value = mc.waitForToolsUntil?.(); }
    catch (err) { threw = true; value = err.name; }
    return { type, threw, value };
  });
  if (!REAL || !versionAtLeast(plain.version(), '160.0.8185.0')) {
    assert.equal(info.type, 'undefined');
    assert.equal(info.threw, false);
    assert.equal(info.value, undefined);
  }
});

await test('Listing 17.2: waitForToolsUntil receives the pending batch, including rollback', async () => {
  const result = await page.evaluate(async () => {
    const { registerCatalog } = await import('/src/adapter.js');
    const mc = document.modelContext;
    const hadOwn = Object.prototype.hasOwnProperty.call(mc, 'waitForToolsUntil');
    const previousWait = mc.waitForToolsUntil;
    const originalRegister = mc.registerTool.bind(mc);
    const waits = [];
    let release;
    let gate = new Promise((resolve) => { release = resolve; });
    let rollbackAborted = false;
    mc.waitForToolsUntil = (promise) => {
      waits.push(promise);
      if (typeof previousWait === 'function') previousWait.call(mc, promise);
    };
    mc.registerTool = async (tool, options = {}) => {
      if (tool.name === 'wait_dup') {
        options.signal?.addEventListener('abort', () => { rollbackAborted = true; });
      }
      if (tool.name === 'wait_ok' || tool.name === 'wait_dup') await gate;
      return originalRegister(tool, options);
    };
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    try {
      const stop = new AbortController();
      const ok = { name: 'wait_ok', description: 'Readiness probe.', run: () => ({ ok: true }) };
      let successSettled = false;
      const done = registerCatalog([ok], { signal: stop.signal });
      done.then(() => { successSettled = true; }, () => { successSettled = true; });
      await flush();
      const successPending = !successSettled && waits[0] === done;
      release();
      const names = await done;
      stop.abort();
      await new Promise((resolve) => setTimeout(resolve, 200));

      let releaseFail;
      gate = new Promise((resolve) => { releaseFail = resolve; });
      const dup = { name: 'wait_dup', description: 'Duplicate-name probe.', run: () => ({}) };
      let failSettled = false;
      const failing = registerCatalog([dup, { ...dup }]);
      failing.then(() => { failSettled = true; }, () => { failSettled = true; });
      await flush();
      const rollbackPending = !failSettled && waits[1] === failing && rollbackAborted === false;
      releaseFail();
      let rejected = null;
      try { await failing; }
      catch (err) { rejected = err.name; }
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        successPending,
        names,
        rollbackPending,
        rejected,
        rollbackAborted,
        left: (await mc.getTools()).map((tool) => tool.name),
      };
    } finally {
      mc.registerTool = originalRegister;
      if (hadOwn) mc.waitForToolsUntil = previousWait;
      else delete mc.waitForToolsUntil;
    }
  });
  assert.equal(result.successPending, true);
  assert.deepEqual(result.names, ['wait_ok']);
  assert.equal(result.rollbackPending, true);
  assert.equal(result.rejected, 'InvalidStateError');
  assert.equal(result.rollbackAborted, true);
  assert.deepEqual(result.left, ['search_products']);
});

await test('Listing 17.3: a Chrome 160-shaped waitForToolsUntil is reported', async () => {
  const reported = await page.evaluate(async () => {
    const mc = document.modelContext;
    const hadOwn = Object.prototype.hasOwnProperty.call(mc, 'waitForToolsUntil');
    const previous = mc.waitForToolsUntil;
    let sawPromise = false;
    mc.waitForToolsUntil = (promise) => {
      sawPromise = promise != null && typeof promise.then === 'function';
    };
    try {
      const { probeWebMCP } = await import('/src/probe.js');
      const report = await probeWebMCP();
      return { field: report.waitForToolsUntil, sawPromise };
    } finally {
      if (hadOwn) mc.waitForToolsUntil = previous;
      else delete mc.waitForToolsUntil;
    }
  });
  assert.equal(reported.field, true);
  assert.equal(reported.sawPromise, false, 'the probe reports the method; it does not call it');
});

await test('Listing 17.2: one failed registration rolls back the whole batch', async () => {
  const result = await page.evaluate(async () => {
    const { registerCatalog } = await import('/src/adapter.js');
    const def = { name: 'rollback_probe', description: 'Rollback test.', run: () => ({}) };
    let rejected = null;
    try { await registerCatalog([def, def], { signal: new AbortController().signal }); }
    catch (e) { rejected = e.name; }
    await new Promise((r) => setTimeout(r, 200));   // let the rollback settle
    return { rejected, names: (await document.modelContext.getTools()).map((t) => t.name) };
  });
  assert.ok(result.rejected, 'the duplicate name is rejected');
  assert.deepEqual(result.names, ['search_products'], 'the first rollback_probe was rolled back');
});

await test('Listing 17.2: aborting the signal unregisters the catalog', async () => {
  await page.evaluate(() => window.__trailhead.unregister());
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 0);
});

await test('no page errors', async () => { assert.deepEqual(errors, []); });

await context.close();
await plain.close();
if (webmcp !== plain) await webmcp.close();
server.close();
console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
