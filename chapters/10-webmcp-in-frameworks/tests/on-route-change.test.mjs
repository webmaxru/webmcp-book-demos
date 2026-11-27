// Listing 10.12 on Chromium 156 (no waitForToolsUntil) and on a Chrome 160-shaped shim.
// The listing does not roll back a partial route. Listing 5.7 does.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const source = await readFile(path.join(ROOT, 'on-route-change.js'));
execFileSync(process.execPath, ['--check', path.join(ROOT, 'on-route-change.js')]);

let server, base, chrome, plain;
before(async () => {
  server = createServer((req, res) => {
    if (new URL(req.url, 'http://x').pathname === '/on-route-change.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end(source);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>onRouteChange</title>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://localhost:${server.address().port}/`;
  chrome = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
  plain = await chromium.launch();
});
after(async () => {
  await chrome?.close();
  await plain?.close();
  server?.close();
});

async function open(browser) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(base);
  return { page, errors };
}

test('Listing 10.12 matches the chapter when CHAPTER_MD is set', { skip: !process.env.CHAPTER_MD }, async () => {
  const md = await readFile(process.env.CHAPTER_MD, 'utf8');
  const block = md.match(/\*\*Listing 10\.12\*\*[\s\S]*?\n```js\n([\s\S]*?)\n```/);
  assert.ok(block, 'Listing 10.12 block');
  assert.equal(source.toString('utf8').replace(/\n$/, ''), block[1]);
});

test('Chromium 156: waitForToolsUntil is absent and a route change still registers', async () => {
  const { page, errors } = await open(chrome);
  try {
    const report = await page.evaluate(async () => {
      const mc = document.modelContext;
      let threw = false;
      let optional = 'unset';
      try { optional = mc.waitForToolsUntil?.(); }
      catch (err) { threw = true; optional = err.name; }
      const { onRouteChange } = await import('/on-route-change.js');
      const tool = (name) => ({
        name,
        description: `Route tool ${name}.`,
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ ok: true }),
      });
      const firstBatch = onRouteChange({ tools: [tool('route_old')] });
      const names = async () => (await mc.getTools()).map((entry) => entry.name).sort();
      const deadline = Date.now() + 3000;
      let first = [];
      while (Date.now() < deadline) {
        first = await names();
        if (first.includes('route_old')) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const secondBatch = onRouteChange({ tools: [tool('route_next')] });
      let second = [];
      const switched = Date.now() + 3000;
      while (Date.now() < switched) {
        second = await names();
        if (second.includes('route_next') && !second.includes('route_old')) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const cleared = onRouteChange({ tools: [] });
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        type: typeof mc.waitForToolsUntil,
        threw,
        optional,
        first,
        second,
        after: await names(),
        firstIsPromise: typeof firstBatch?.then === 'function',
        secondIsPromise: typeof secondBatch?.then === 'function',
        clearedIsPromise: typeof cleared?.then === 'function',
        firstStatus: (await firstBatch)[0]?.status,
        secondStatus: (await secondBatch)[0]?.status,
        clearedLength: (await cleared).length,
      };
    });
    assert.equal(report.type, 'undefined');
    assert.equal(report.threw, false);
    assert.equal(report.optional, undefined);
    assert.deepEqual(report.first, ['route_old']);
    assert.deepEqual(report.second, ['route_next']);
    assert.deepEqual(report.after, []);
    assert.equal(report.firstIsPromise, true);
    assert.equal(report.secondIsPromise, true);
    assert.equal(report.clearedIsPromise, true);
    assert.equal(report.firstStatus, 'fulfilled');
    assert.equal(report.secondStatus, 'fulfilled');
    assert.equal(report.clearedLength, 0);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('Chrome 160 shim: the route promise stays pending until every registration settles', async () => {
  const { page, errors } = await open(plain);
  try {
    const report = await page.evaluate(async () => {
      const registered = new Map();
      const waits = [];
      const events = [];
      let release;
      let gate = new Promise((resolve) => { release = resolve; });
      const mc = {
        async registerTool(entry, { signal } = {}) {
          events.push(`register:${entry.name}`);
          signal?.addEventListener('abort', () => {
            events.push(`abort:${entry.name}`);
            registered.delete(entry.name);
          });
          await gate;
          if (signal?.aborted) throw signal.reason ?? new DOMException('The signal was aborted.', 'AbortError');
          if (entry.name === 'bad') throw new DOMException('Duplicate tool name "bad".', 'InvalidStateError');
          registered.set(entry.name, entry.name);
        },
        waitForToolsUntil(promise) {
          events.push('wait');
          waits.push(promise);
        },
      };
      Object.defineProperty(document, 'modelContext', { configurable: true, value: mc });
      const { onRouteChange } = await import('/on-route-change.js');
      const make = (name) => ({ name, description: `Route tool ${name}.`, execute: async () => ({ ok: true }) });
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

      onRouteChange({ tools: [make('old')] });
      let firstSettled = false;
      waits[0].then(() => { firstSettled = true; }, () => { firstSettled = true; });
      await flush();
      const firstPending = firstSettled === false;

      onRouteChange({ tools: [make('next'), make('bad')] });
      let secondSettled = false;
      waits[1].then(() => { secondSettled = true; }, () => { secondSettled = true; });
      await flush();
      const secondPending = secondSettled === false && !registered.has('next');
      const abortBeforeSecondWait = events.indexOf('abort:old') !== -1
        && events.indexOf('abort:old') < events.lastIndexOf('wait');
      release();
      const [firstResults, secondResults] = await Promise.all(waits);
      return {
        firstPending,
        secondPending,
        abortBeforeSecondWait,
        events,
        firstStatus: firstResults[0].status,
        secondStatuses: secondResults.map((result) => result.status),
        secondReason: secondResults[1].reason?.name,
        names: [...registered.keys()].sort(),
      };
    });
    assert.deepEqual(report.events, [
      'register:old', 'wait', 'abort:old', 'register:next', 'register:bad', 'wait',
    ]);
    assert.equal(report.firstPending, true);
    assert.equal(report.secondPending, true);
    assert.equal(report.abortBeforeSecondWait, true);
    assert.equal(report.firstStatus, 'rejected');
    assert.deepEqual(report.secondStatuses, ['fulfilled', 'rejected']);
    assert.equal(report.secondReason, 'InvalidStateError');
    assert.deepEqual(report.names, ['next'], JSON.stringify(report));
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('Chrome 160 shim: InvalidStateError and NotAllowedError still return the route promise', async () => {
  const { page, errors } = await open(plain);
  try {
    const report = await page.evaluate(async () => {
      const registered = new Map();
      const seen = [];
      let release;
      let gate = new Promise((resolve) => { release = resolve; });
      let throwName = null;
      const mc = {
        async registerTool(entry, { signal } = {}) {
          signal?.addEventListener('abort', () => registered.delete(entry.name));
          await gate;
          if (signal?.aborted) throw signal.reason ?? new DOMException('The signal was aborted.', 'AbortError');
          if (entry.name.startsWith('bad')) throw new DOMException('Duplicate tool name.', 'InvalidStateError');
          registered.set(entry.name, entry.name);
        },
        waitForToolsUntil(promise) {
          seen.push(promise);
          if (throwName) throw new DOMException(throwName, throwName);
        },
      };
      Object.defineProperty(document, 'modelContext', { configurable: true, value: mc });
      const { onRouteChange } = await import('/on-route-change.js');
      const make = (name) => ({ name, description: `Route tool ${name}.`, execute: async () => ({ ok: true }) });
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
      const arm = () => { gate = new Promise((resolve) => { release = resolve; }); };
      const cases = [];
      for (const name of ['InvalidStateError', 'NotAllowedError']) {
        arm();
        throwName = name;
        let thrown = null;
        let batch;
        try { batch = onRouteChange({ tools: [make(`keep_${name}`), make(`bad_${name}`)] }); }
        catch (err) { thrown = err?.name ?? String(err); }
        let settled = false;
        batch?.then(() => { settled = true; }, () => { settled = true; });
        await flush();
        const pending = thrown == null && settled === false && batch === seen.at(-1);
        release();
        const results = batch ? await batch : null;
        cases.push({
          name,
          thrown,
          pending,
          samePromise: batch === seen.at(-1),
          statuses: results?.map((result) => result.status) ?? null,
          reason: results?.[1]?.reason?.name ?? null,
          names: [...registered.keys()].sort(),
        });
      }
      return { cases };
    });
    assert.equal(report.cases.length, 2);
    for (const item of report.cases) {
      assert.equal(item.thrown, null, item.name);
      assert.equal(item.pending, true, JSON.stringify(item));
      assert.equal(item.samePromise, true, item.name);
      assert.deepEqual(item.statuses, ['fulfilled', 'rejected'], item.name);
      assert.equal(item.reason, 'InvalidStateError', item.name);
      assert.deepEqual(item.names, [`keep_${item.name}`], JSON.stringify(item));
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('Chrome 160 shim: any other synchronous error from waitForToolsUntil propagates', async () => {
  const { page, errors } = await open(plain);
  try {
    const report = await page.evaluate(async () => {
      const registered = new Map();
      const seen = [];
      let release;
      let gate = new Promise((resolve) => { release = resolve; });
      let throwName = null;
      const mc = {
        async registerTool(entry, { signal } = {}) {
          signal?.addEventListener('abort', () => registered.delete(entry.name));
          await gate;
          if (signal?.aborted) throw signal.reason ?? new DOMException('The signal was aborted.', 'AbortError');
          if (entry.name.startsWith('bad')) throw new DOMException('Duplicate tool name.', 'InvalidStateError');
          registered.set(entry.name, entry.name);
        },
        waitForToolsUntil(promise) {
          seen.push(promise);
          if (throwName === 'TypeError') throw new TypeError('shim refused the promise');
          if (throwName) throw new DOMException(throwName, throwName);
        },
      };
      Object.defineProperty(document, 'modelContext', { configurable: true, value: mc });
      const { onRouteChange } = await import('/on-route-change.js');
      const make = (name) => ({ name, description: `Route tool ${name}.`, execute: async () => ({ ok: true }) });
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
      const arm = () => { gate = new Promise((resolve) => { release = resolve; }); };
      const cases = [];
      for (const name of ['TypeError', 'OperationError']) {
        arm();
        throwName = name;
        let thrown = null;
        let returned = 'unset';
        try { returned = onRouteChange({ tools: [make(`keep_${name}`), make(`bad_${name}`)] }); }
        catch (err) { thrown = err?.name ?? String(err); }
        const batch = seen.at(-1);
        let settled = false;
        batch?.then(() => { settled = true; }, () => { settled = true; });
        await flush();
        const pending = settled === false;
        release();
        const results = batch ? await batch : null;
        cases.push({
          name,
          thrown,
          returnedUnset: returned === 'unset',
          pending,
          statuses: results?.map((result) => result.status) ?? null,
          names: [...registered.keys()].sort(),
        });
      }
      return { cases };
    });
    assert.deepEqual(report.cases.map((item) => item.name), ['TypeError', 'OperationError']);
    for (const item of report.cases) {
      assert.equal(item.thrown, item.name, JSON.stringify(item));
      assert.equal(item.returnedUnset, true, JSON.stringify(item));
      assert.equal(item.pending, true, JSON.stringify(item));
      assert.deepEqual(item.statuses, ['fulfilled', 'rejected'], JSON.stringify(item));
      assert.deepEqual(item.names, [`keep_${item.name}`], JSON.stringify(item));
    }
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
