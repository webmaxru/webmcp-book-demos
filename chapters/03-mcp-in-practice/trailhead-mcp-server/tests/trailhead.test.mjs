// Behavioural tests for the Trailhead MCP server (Chapter 3).
// Run: npm test   (Node 20+; no network needed after npm install)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import { promisify } from 'node:util';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { createTrailheadServer } from '../src/server.js';

const run = promisify(execFile);
const cleanups = [];
after(async () => { for (const fn of cleanups.reverse()) await fn(); });

async function inProcessClient(mode = 'auto') {
  const handler = createMcpHandler(createTrailheadServer);
  const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
    fetch: (url, init) => handler.fetch(new Request(url, init))
  });
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode } });
  await client.connect(transport);
  cleanups.push(async () => { await client.close(); await handler.close(); });
  return client;
}

test('modern era (2026-07-28) over the HTTP handler, in process', async () => {
  const client = await inProcessClient();
  assert.equal(client.getProtocolEra(), 'modern');

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name), ['search_products', 'get_order_status']);
  const search = tools.find((t) => t.name === 'search_products');
  assert.equal(search.annotations.readOnlyHint, true);
  assert.deepEqual(search.inputSchema.required, ['query']);
  assert.ok(search.outputSchema, 'outputSchema is advertised');
});

test('search_products filters by keywords, price, stock and category', async () => {
  const client = await inProcessClient();
  const r1 = await client.callTool({ name: 'search_products',
    arguments: { query: 'tent', maxPrice: 4000, inStockOnly: true } });
  assert.deepEqual(r1.structuredContent.products.map((p) => p.sku), ['TH-TENT-001']);
  assert.deepEqual(r1.structuredContent.products[0].price, { amount: 3499, currency: 'NOK' });
  assert.deepEqual(JSON.parse(r1.content[0].text), r1.structuredContent);

  const r2 = await client.callTool({ name: 'search_products',
    arguments: { query: 'waterproof', category: 'footwear' } });
  assert.deepEqual(r2.structuredContent.products.map((p) => p.sku), ['TH-BOOT-001']);

  const r3 = await client.callTool({ name: 'search_products', arguments: { query: 'kayak' } });
  assert.deepEqual(r3.structuredContent.products, []);
});

test('schema violations come back as tool results with isError', async () => {
  const client = await inProcessClient();
  const bad = await client.callTool({ name: 'search_products',
    arguments: { query: 'tent', category: 'kayaks' } });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /Input validation error/);

  const badId = await client.callTool({ name: 'get_order_status', arguments: { orderId: '12345' } });
  assert.equal(badId.isError, true);
  assert.match(badId.content[0].text, /Input validation error/);
});

test('get_order_status: found and not found', async () => {
  const client = await inProcessClient();
  const ok = await client.callTool({ name: 'get_order_status', arguments: { orderId: 'TH-100231' } });
  assert.equal(ok.isError, undefined);
  assert.equal(ok.structuredContent.orderState, 'shipped');
  assert.equal('status' in ok.structuredContent, false); // `status` is reserved for outcomes (Chapter 11)

  const missing = await client.callTool({ name: 'get_order_status', arguments: { orderId: 'TH-999999' } });
  assert.equal(missing.isError, true);
  assert.equal(missing.content[0].text, 'No order found with ID TH-999999.');
});

test('resource and prompt', async () => {
  const client = await inProcessClient();
  const { resources } = await client.listResources();
  assert.deepEqual(resources.map((r) => r.uri), ['trailhead://policies/returns']);
  const read = await client.readResource({ uri: 'trailhead://policies/returns' });
  assert.match(read.contents[0].text, /within 60 days/);

  const { prompts } = await client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name), ['packing_list']);
  const prompt = await client.getPrompt({ name: 'packing_list',
    arguments: { trip: 'Jotunheimen in October', nights: '3' } });
  assert.match(prompt.messages[0].content.text, /Jotunheimen in October for 3 nights/);
});

test('legacy era (initialize handshake) still works', async () => {
  const client = await inProcessClient('legacy');
  assert.equal(client.getProtocolEra(), 'legacy');
  const r = await client.callTool({ name: 'get_order_status', arguments: { orderId: 'TH-100232' } });
  assert.equal(r.structuredContent.orderState, 'processing');
});

test('stdio entry point: auto negotiates modern, legacy pins the handshake', async () => {
  for (const [mode, era] of [['auto', 'modern'], ['legacy', 'legacy']]) {
    const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode } });
    await client.connect(new StdioClientTransport({ command: 'node', args: ['src/stdio.js'], stderr: 'ignore' }));
    assert.equal(client.getProtocolEra(), era);
    const r = await client.callTool({ name: 'search_products', arguments: { query: 'backpack', category: 'backpacks' } });
    assert.equal(r.structuredContent.products[0].sku, 'TH-PACK-001');
    await client.close();
  }
});

test('Listing 3.8 (src/client.js) runs end to end', async () => {
  const { stdout } = await run('node', ['src/client.js'], { timeout: 60_000 });
  assert.match(stdout, /Protocol era: modern/);
  assert.match(stdout, /Tools: search_products, get_order_status/);
  assert.match(stdout, /"sku": "TH-TENT-001"/);
});

test('Listings 3.1 and 3.9 match the real wire exchange', async () => {
  const log = 'tests/wire-check.log';
  rmSync(log, { force: true });
  await run('node', ['tests/capture-wire.mjs'], { timeout: 60_000, env: { ...process.env, WIRE_LOG: log } });
  const wire = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l.slice(3)));
  rmSync(log, { force: true });
  const parse = (f) => readFileSync(f, 'utf8').trim().split('\n\n').map((b) => JSON.parse(b));
  assert.deepEqual(parse('wire/listing-3-1.txt'), wire.slice(0, 2));
  assert.deepEqual(parse('wire/listing-3-9.txt'), wire.slice(2, 4));
});

function startHttp(port) {
  const child = spawn('node', ['src/http.js'], { env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'] });
  cleanups.push(async () => { child.kill(); });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('http server did not start')), 15_000);
    child.stderr.on('data', (d) => { if (String(d).includes('/mcp')) { clearTimeout(t); resolve(child); } });
  });
}

function post(port, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/mcp', method: 'POST', headers, timeout: 10_000 },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    req.on('error', reject);
    req.end(body);
  });
}

test('Listing 3.7 (src/http.js): real HTTP endpoint, header routing and Host check', async () => {
  const port = 3000 + Math.floor(Math.random() * 1000) + 3000;
  await startHttp(port);
  const client = new Client({ name: 'test', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`)));
  cleanups.push(() => client.close());
  assert.equal(client.getProtocolEra(), 'modern');
  const r = await client.callTool({ name: 'search_products', arguments: { query: 'sleeping bag' } });
  assert.equal(r.structuredContent.products[0].sku, 'TH-BAG-001');

  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'raw', version: '1' },
    'io.modelcontextprotocol/clientCapabilities': {} } } });
  const base = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
    'MCP-Protocol-Version': '2026-07-28' };

  const noMethodHeader = await post(port, base, body);
  assert.equal(noMethodHeader.status, 400);
  assert.match(noMethodHeader.body, /Mcp-Method header is absent/);

  const ok = await post(port, { ...base, 'Mcp-Method': 'server/discover' }, body);
  assert.equal(ok.status, 200);
  assert.match(ok.body, /"supportedVersions":\["2026-07-28"\]/);

  const rebinding = await post(port, { ...base, 'Mcp-Method': 'server/discover', Host: `evil.example:${port}` }, body);
  assert.equal(rebinding.status, 403);
});

test('Listing 3.10: the MCP Inspector CLI lists and calls the tools', async () => {
  const insp = 'node_modules/.bin/mcp-inspector';
  const list = await run(insp, ['--cli', 'node', 'src/stdio.js', '--method', 'tools/list'], { timeout: 90_000 });
  assert.deepEqual(JSON.parse(list.stdout).tools.map((t) => t.name), ['search_products', 'get_order_status']);
  const call = await run(insp, ['--cli', 'node', 'src/stdio.js', '--method', 'tools/call',
    '--tool-name', 'search_products', '--tool-arg', 'query=tent', 'maxPrice=4000', 'inStockOnly=true'], { timeout: 90_000 });
  assert.equal(JSON.parse(call.stdout).structuredContent.products[0].sku, 'TH-TENT-001');
});
