// Listing E.1 on Chromium 156 (RegisteredTool) and on a Chrome 160-shaped shim.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, ['--check', join(ROOT, 'read-tool.js')], { stdio: 'inherit' });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'tests/page.html';
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://localhost:${server.address().port}/tests/page.html`;

const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
console.log(`Chromium ${browser.version()}`);
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.goto(url);
await page.waitForFunction(() => typeof window.readTools === 'function');

const chromium156 = await page.evaluate(async () => {
  await document.modelContext.registerTool({
    name: 'search_products',
    description: 'Search the catalogue.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    execute: async () => ({ products: [] }),
  });
  const [row] = await window.readTools();
  const live = (await document.modelContext.getTools())[0];
  const { source, ...plain } = row;
  return {
    plain,
    originMatches: row.origin === location.origin,
    sourceIsWindow: source === window,
    liveHasSource: 'source' in live,
    liveHasWindow: 'window' in live,
    stringifyIsEmpty: (() => {
      try { return JSON.stringify(live) === '{}'; }
      catch { return false; }
    })(),
  };
});

assert.equal(chromium156.plain.name, 'search_products');
assert.equal(chromium156.plain.description, 'Search the catalogue.');
assert.equal(chromium156.originMatches, true);
assert.equal(chromium156.sourceIsWindow, true);
assert.equal(chromium156.liveHasWindow, true);
assert.equal(chromium156.liveHasSource, false);
assert.equal(chromium156.stringifyIsEmpty, false);
assert.deepEqual(chromium156.plain.inputSchema.required, ['query']);
assert.equal(chromium156.plain.outputSchema, null);
assert.equal(chromium156.plain.annotations, null);
assert.equal(chromium156.plain.title, '');

const chrome160 = await page.evaluate(async () => {
  const bag = new WeakMap();
  function Tool() {}
  for (const key of ['name', 'title', 'description', 'origin', 'inputSchema', 'outputSchema', 'annotations', 'source']) {
    Object.defineProperty(Tool.prototype, key, {
      enumerable: false,
      get() { return bag.get(this)[key]; },
    });
  }
  const data = {
    name: 'search_products',
    title: '',
    description: 'Search the catalogue.',
    origin: location.origin,
    inputSchema: null,
    outputSchema: null,
    annotations: null,
    source: window,
  };
  const gone = { ...data, name: 'gone', source: null };
  const make = (fields) => {
    const tool = Object.create(Tool.prototype);
    bag.set(tool, fields);
    return tool;
  };
  document.modelContext.getTools = async () => [make(data), make(gone)];
  const raw = (await document.modelContext.getTools())[0];
  let cloneError = null;
  try { structuredClone(raw); } catch (error) { cloneError = error.name; }
  const rows = await window.readTools();
  return {
    stringify: JSON.stringify(raw),
    spread: { ...raw },
    ownKeys: Object.keys(raw),
    cloneError,
    sourceIsWindow: rows[0].source === window,
    goneSource: rows[1].source === undefined ? 'undefined' : rows[1].source === null ? 'null' : 'set',
    rows: rows.map(({ source, ...plain }) => plain),
  };
});

assert.equal(chrome160.stringify, '{}');
assert.deepEqual(chrome160.spread, {});
assert.deepEqual(chrome160.ownKeys, []);
assert.equal(chrome160.cloneError, null);
assert.equal(chrome160.sourceIsWindow, true);
assert.equal(chrome160.rows[0].name, 'search_products');
assert.equal(chrome160.rows[0].inputSchema, null);
assert.equal(chrome160.rows[0].outputSchema, null);
assert.equal(chrome160.rows[0].annotations, null);
assert.equal(chrome160.rows[1].name, 'gone');
// Listing E.1 uses ??, so a null source falls through to the absent window member.
assert.equal(chrome160.goneSource, 'undefined');
assert.deepEqual(errors, []);

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('appendix E: Chromium 156 path and Chrome 160 shim passed');
