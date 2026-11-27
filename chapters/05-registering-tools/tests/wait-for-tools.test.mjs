// Listing 5.7 on Chromium 156 (no waitForToolsUntil) and on a Chrome 160-shaped shim.
// Run from this folder: npm install && npx playwright install chromium && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const source = await readFile(path.join(ROOT, 'wait-for-tools.js'));
execFileSync(process.execPath, ['--check', path.join(ROOT, 'wait-for-tools.js')]);

let server, base, chrome, plain;
before(async () => {
  server = createServer((req, res) => {
    if (new URL(req.url, 'http://x').pathname === '/wait-for-tools.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      return res.end(source);
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>waitForToolsUntil</title>');
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

test('Listing 5.7 matches the chapter when CHAPTER_MD is set', { skip: !process.env.CHAPTER_MD }, async () => {
  const md = await readFile(process.env.CHAPTER_MD, 'utf8');
  const block = md.match(/\*\*Listing 5\.7\*\*[\s\S]*?\n```js\n([\s\S]*?)\n```/);
  assert.ok(block, 'Listing 5.7 block');
  assert.equal(source.toString('utf8').replace(/\n$/, ''), block[1]);
});

test('Chromium 156: waitForToolsUntil is absent and registration still settles', async () => {
  const { page, errors } = await open(chrome);
  try {
    const report = await page.evaluate(async () => {
      const mc = document.modelContext;
      const tool = (name) => ({
        name,
        description: `Probe tool ${name}.`,
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ ok: true }),
      });
      let threw = false;
      let optional = 'unset';
      try { optional = mc.waitForToolsUntil?.(); }
      catch (err) { threw = true; optional = err.name; }
      const { registerToolsWhenReady } = await import('/wait-for-tools.js');
      const original = mc.registerTool.bind(mc);
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      mc.registerTool = (entry, options) => gate.then(() => original(entry, options));
      const stop = new AbortController();
      let settled = false;
      const pending = registerToolsWhenReady([tool('ready_a'), tool('ready_b')], stop.signal);
      pending.then(() => { settled = true; }, () => { settled = true; });
      await new Promise((resolve) => setTimeout(resolve, 0));
      const wasPending = settled === false;
      release();
      const results = await pending;
      const names = (await mc.getTools()).map((entry) => entry.name).sort();
      stop.abort();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const after = (await mc.getTools()).map((entry) => entry.name);
      return {
        version: navigator.userAgent,
        type: typeof mc.waitForToolsUntil,
        threw,
        optional,
        wasPending,
        statuses: results.map((result) => result.status),
        names,
        after,
      };
    });
    console.log(`  Chromium reports waitForToolsUntil as ${report.type} (${report.version})`);
    assert.equal(report.type, 'undefined');
    assert.equal(report.threw, false);
    assert.equal(report.optional, undefined);
    assert.equal(report.wasPending, true);
    assert.deepEqual(report.statuses, ['fulfilled', 'fulfilled']);
    assert.deepEqual(report.names, ['ready_a', 'ready_b']);
    assert.deepEqual(report.after, []);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});

test('Chrome 160 shim: the batch promise stays pending through registration and rollback', async () => {
  const { page, errors } = await open(plain);
  try {
    const report = await page.evaluate(async () => {
      const registered = new Map();
      const waits = [];
      let release;
      let gate = new Promise((resolve) => { release = resolve; });
      const mc = {
        async registerTool(entry, { signal } = {}) {
          signal?.addEventListener('abort', () => registered.delete(entry.name));
          await gate;
          if (signal?.aborted) throw signal.reason ?? new DOMException('The signal was aborted.', 'AbortError');
          if (entry.name === 'bad') throw new DOMException('Duplicate tool name "bad".', 'InvalidStateError');
          registered.set(entry.name, entry.name);
        },
        waitForToolsUntil(promise) { waits.push(promise); },
      };
      Object.defineProperty(document, 'modelContext', { configurable: true, value: mc });
      const { registerToolsWhenReady } = await import('/wait-for-tools.js');
      const make = (name) => ({ name, description: `Shim tool ${name}.`, execute: async () => ({ ok: true }) });
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

      let successSettled = false;
      const success = registerToolsWhenReady([make('alpha'), make('beta')]);
      success.then(() => { successSettled = true; }, () => { successSettled = true; });
      await flush();
      const successPending = successSettled === false && waits[0] === success;
      const releaseSuccess = release;
      releaseSuccess();
      const successResults = await success;
      const successNames = [...registered.keys()].sort();

      let releaseFail;
      gate = new Promise((resolve) => { releaseFail = resolve; });
      let failSettled = false;
      const failing = registerToolsWhenReady([make('gamma'), make('bad')]);
      failing.then(() => { failSettled = true; }, () => { failSettled = true; });
      await flush();
      const rollbackPending = failSettled === false && waits[1] === failing && !registered.has('gamma');
      releaseFail();
      const failResults = await failing;
      return {
        successPending,
        successStatuses: successResults.map((result) => result.status),
        successNames,
        rollbackPending,
        failStatuses: failResults.map((result) => result.status),
        failReason: failResults[1].reason?.name,
        namesAfterRollback: [...registered.keys()].sort(),
      };
    });
    assert.equal(report.successPending, true);
    assert.deepEqual(report.successStatuses, ['fulfilled', 'fulfilled']);
    assert.deepEqual(report.successNames, ['alpha', 'beta']);
    assert.equal(report.rollbackPending, true);
    assert.deepEqual(report.failStatuses, ['fulfilled', 'rejected']);
    assert.equal(report.failReason, 'InvalidStateError');
    assert.deepEqual(report.namesAfterRollback, ['alpha', 'beta']);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
});
