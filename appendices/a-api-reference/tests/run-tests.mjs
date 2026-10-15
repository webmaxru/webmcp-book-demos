// Appendix A checks: runs the error-name and API-shape probes behind Table A.6 in
// Chromium with --enable-features=WebMCPTesting and compares them with the values the
// book prints. Also unit-tests Listing A.2 (classify-tool-error.js).
// Run: npm install && npx playwright install chromium && npm test
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { classifyToolError } from '../classify-tool-error.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.message || e).split('\n').join('\n     ')); }
}

// --- static checks ---------------------------------------------------------
await test('node --check classify-tool-error.js', () => {
  execFileSync(process.execPath, ['--check', path.join(here, '..', 'classify-tool-error.js')]);
});
await test('Listing A.2: classifyToolError maps draft and Chromium names', () => {
  const e = (name) => new DOMException('x', name);
  assert.deepEqual(classifyToolError(e('UnknownError')), { kind: 'failed', retry: true });
  assert.deepEqual(classifyToolError(e('OperationError')), { kind: 'failed', retry: true });
  assert.deepEqual(classifyToolError(e('NotFoundError')), { kind: 'gone', retry: true });
  assert.deepEqual(classifyToolError(e('AbortError')), { kind: 'cancelled', retry: false });
  assert.deepEqual(classifyToolError(e('NotAllowedError')), { kind: 'blocked', retry: false });
  assert.deepEqual(classifyToolError(new TypeError('x')), { kind: 'error', retry: false });
});

// --- two local origins -------------------------------------------------------


const page = (body) => `<!doctype html><meta charset=utf-8><title>probe</title><body>${body}</body>`;
function handler(port) {
  return (req, res) => {
    const u = new URL(req.url, `http://localhost:${port}`);
    const h = { 'content-type': 'text/html' };
    if (u.searchParams.get('pp')) h['permissions-policy'] = u.searchParams.get('pp');
    if (u.pathname === '/frame-tool') {
      res.writeHead(200, h);
      return res.end(page(`<script>
        const exposedTo = new URL(location).searchParams.get('exp');
        document.modelContext.registerTool({name:'frame_tool', description:'tool in a frame',
          execute: () => new Promise(r => setTimeout(() => r('late'), 3000))},
          exposedTo ? {exposedTo:[exposedTo]} : {})
          .then(() => parent.postMessage('registered','*'), e => parent.postMessage('reg:'+e.name,'*'));
      </script>`));
    }
    if (u.pathname === '/form') {
      res.writeHead(200, h);
      return res.end(page(`<form toolname="search_availability" tooldescription="Find free tables" action="/form">
        <input name="date" type="date" toolparamdescription="Date, YYYY-MM-DD" required>
        <input name="partySize" type="number" min="1" max="12" required></form>`));
    }
    res.writeHead(200, h); res.end(page('<h1>probe</h1>'));
  };
}
const servers = [8611, 8612].map((port) => http.createServer(handler(port)).listen(port, '127.0.0.1'));
await new Promise((r) => setTimeout(r, 200));

// --- Chromium probes ---------------------------------------------------------
const out = {};
const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
try {


const ctx = await browser.newContext();
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
out.version = browser.version();
await page.goto('http://localhost:8611/');
out.basic = await page.evaluate(async () => {
  const r = {};
  const mc = document.modelContext;
  r.hasDoc = 'modelContext' in document; r.hasNav = 'modelContext' in navigator;
  r.proto = Object.getOwnPropertyNames(Object.getPrototypeOf(mc)).sort();
  r.hasProvide = typeof mc.provideContext; r.hasClear = typeof mc.clearContext; r.hasUnreg = typeof mc.unregisterTool;
  r.events = [];
  mc.addEventListener('toolchange', (e) => r.events.push('toolchange:' + e.constructor.name));
  mc.addEventListener('toolactivated', (e) => r.events.push('toolactivated:' + e.toolName));
  mc.addEventListener('toolcancel', (e) => r.events.push('toolcancel:' + e.toolName));
  const err = async (p) => { try { const v = await p; return 'resolved:' + JSON.stringify(v); } catch (e) { return e.name + ': ' + e.message; } };
  const ok = (name, execute, extra = {}) => ({ name, description: 'd', execute, ...extra });
  r.regValue = await err(mc.registerTool(ok('echo', (i) => ({ got: i }))));
  r.badName = await err(mc.registerTool(ok('bad name', () => 1)));
  r.longName = await err(mc.registerTool(ok('x'.repeat(129), () => 1)));
  r.emptyDesc = await err(mc.registerTool({ name: 'nodesc', description: '', execute: () => 1 }));
  r.dup = await err(mc.registerTool(ok('echo', () => 1)));
  r.noExecute = await err(mc.registerTool({ name: 'noexec', description: 'd' }));
  r.circular = await err((() => { const s = {}; s.self = s; return mc.registerTool(ok('circ', () => 1, { inputSchema: s })); })());
  const pre = new AbortController(); pre.abort();
  r.preAborted = await err(mc.registerTool(ok('pre', () => 1), { signal: pre.signal }));
  r.insecureExposed = await err(mc.registerTool(ok('ins', () => 1), { exposedTo: ['http://example.com'] }));
  r.insecureFrom = await err(mc.getTools({ fromOrigins: ['http://example.com'] }));
  r.badFrom = await err(mc.getTools({ fromOrigins: ['not a url'] }));
  await mc.registerTool(ok('thrower', () => { throw new Error('boom'); }));
  await mc.registerTool(ok('rejecter', () => Promise.reject(new TypeError('nope'))));
  await mc.registerTool(ok('undef', () => undefined));
  await mc.registerTool(ok('bigint', () => 10n));
  await mc.registerTool(ok('str', () => 'plain'));
  await mc.registerTool(ok('slow', (i, { signal }) => new Promise((res, rej) => { const t = setTimeout(() => res('done'), 5000); signal.addEventListener('abort', () => { clearTimeout(t); r.events.push('execSignalAborted'); }); })));
  const ac = new AbortController();
  await mc.registerTool(ok('temp', () => 't'), { signal: ac.signal });
  const tools = await mc.getTools();
  r.tools = tools.map((t) => t.name);
  r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();
  r.toolOrigin = tools[0].origin; r.windowIsSelf = tools[0].window === window; r.title = JSON.stringify(tools[0].title);
  const T = (n) => tools.find((t) => t.name === n);
  r.execEcho = await err(mc.executeTool(T('echo'), { a: 1 }));
  r.execNoInput = await err(mc.executeTool(T('echo')));
  r.execThrow = await err(mc.executeTool(T('thrower'), {}));
  r.execReject = await err(mc.executeTool(T('rejecter'), {}));
  r.execUndef = await err(mc.executeTool(T('undef'), {}));
  r.execBigint = await err(mc.executeTool(T('bigint'), {}));
  r.execStr = await err(mc.executeTool(T('str'), {}));
  r.execCircularInput = await err((() => { const s = {}; s.self = s; return mc.executeTool(T('echo'), s); })());
  r.toJsonUndef = await err(mc.registerTool(ok('tju', () => 1, { inputSchema: { toJSON() { return undefined; } } })));
  ac.abort();
  await new Promise((s) => setTimeout(s, 100));
  r.afterUnregister = (await mc.getTools()).map((t) => t.name).includes('temp');
  r.execUnregistered = await err(mc.executeTool(T('temp'), {}));
  r.execForgedName = await err(mc.executeTool({ ...T('echo'), name: 'ghost' }, {}));
  r.execForgedOrigin = await err(mc.executeTool({ ...T('echo'), origin: 'https://evil.example' }, {}));
  r.execOpaqueOrigin = await err(mc.executeTool({ ...T('echo'), origin: 'null' }, {}));
  const c2 = new AbortController();
  const p = err(mc.executeTool(T('slow'), {}, { signal: c2.signal }));
  setTimeout(() => c2.abort(), 200);
  r.execAborted = await p;
  const c3 = new AbortController(); c3.abort(new Error('custom reason'));
  r.execPreAborted = await err(mc.executeTool(T('echo'), {}, { signal: c3.signal }));
  await new Promise((s) => setTimeout(s, 300));
  return r;
});
// Permissions-Policy header blocks the top-level document
await page.goto('http://localhost:8611/?pp=' + encodeURIComponent('tools=()'));
out.blocked = await page.evaluate(async () => {
  const err = async (p) => { try { await p; return 'resolved'; } catch (e) { return e.name; } };
  const mc = document.modelContext;
  return {
    present: !!mc,
    allowsFeature: document.featurePolicy ? document.featurePolicy.allowsFeature('tools') : 'n/a',
    features: document.featurePolicy ? document.featurePolicy.features().filter((f) => /tool|mcp|model/i.test(f)) : 'n/a',
    register: await err(mc.registerTool({ name: 'x', description: 'd', execute: () => 1 })),
    getTools: await err(mc.getTools()),
    execute: await err(mc.executeTool({ name: 'x', description: 'd', origin: location.origin, window }, {})),
  };
});
// cross-origin iframe: without allow, with allow, exposedTo and fromOrigins
await page.goto('http://localhost:8611/');
out.frames = await page.evaluate(async () => {
  const r = {};
  const load = (src, allow) => new Promise((res) => {
    const f = document.createElement('iframe'); if (allow) f.allow = allow; f.src = src;
    const on = (e) => { if (e.source === f.contentWindow) { removeEventListener('message', on); res([f, e.data]); } };
    addEventListener('message', on); document.body.append(f);
  });
  const [f1, m1] = await load('http://127.0.0.1:8612/frame-tool');
  r.noAllow = m1; f1.remove();
  const [f2, m2] = await load('http://127.0.0.1:8612/frame-tool?exp=' + encodeURIComponent(location.origin), 'tools');
  r.withAllow = m2;
  r.defaultGet = (await document.modelContext.getTools()).map((t) => t.name);
  const got = await document.modelContext.getTools({ fromOrigins: ['http://127.0.0.1:8612'] });
  r.fromOrigins = got.map((t) => t.name + '@' + t.origin);
  const ft = got.find((t) => t.name === 'frame_tool');
  const err = async (p) => { try { return 'resolved:' + await p; } catch (e) { return e.name + ': ' + e.message; } };
  const p = err(document.modelContext.executeTool(ft, {}));
  setTimeout(() => f2.remove(), 300);
  r.frameRemovedMidCall = await p;
  const [f3, m3] = await load('http://127.0.0.1:8612/frame-tool', 'tools');
  const got3 = await document.modelContext.getTools({ fromOrigins: ['http://127.0.0.1:8612'] });
  r.notExposed = got3.map((t) => t.name);
  return r;
});
// declarative form attributes
await page.goto('http://localhost:8611/form');
out.declarative = await page.evaluate(async () => {
  await new Promise((s) => setTimeout(s, 300));
  const t = (await document.modelContext.getTools()).map((x) => ({ name: x.name, description: x.description, schema: x.inputSchema }));
  return t;
});

} finally {
  await browser.close();
  servers.forEach((s) => s.close());
}

const b = out.basic;
console.log('     Chromium ' + out.version);
await test('document.modelContext exists; navigator.modelContext does not', () => {
  assert.equal(b.hasDoc, true); assert.equal(b.hasNav, false);
});
await test('provideContext(), clearContext() and unregisterTool() are gone', () => {
  assert.deepEqual([b.hasProvide, b.hasClear, b.hasUnreg], ['undefined', 'undefined', 'undefined']);
  assert.deepEqual(b.proto, ['constructor', 'executeTool', 'getTools', 'ontoolactivated', 'ontoolcancel', 'ontoolchange', 'registerTool']);
});
await test('registerTool() resolves with undefined', () => assert.equal(b.regValue, 'resolved:undefined'));
await test('InvalidStateError: bad name, 129-char name, empty description, duplicate', () => {
  for (const k of ['badName', 'longName', 'emptyDesc', 'dup']) assert.match(b[k], /^InvalidStateError/, k);
});
await test('TypeError: missing execute, circular inputSchema', () => {
  assert.match(b.noExecute, /^TypeError/); assert.match(b.circular, /^TypeError/);
});
await test('already-aborted signal rejects with its reason (AbortError)', () => assert.match(b.preAborted, /^AbortError/));
await test('SecurityError: insecure exposedTo, insecure or unparsable fromOrigins', () => {
  for (const k of ['insecureExposed', 'insecureFrom', 'badFrom']) assert.match(b[k], /^SecurityError/, k);
});
await test('getTools(): sorted by name, title "", window and origin present', () => {
  assert.deepEqual(b.tools, [...b.tools].sort());
  assert.equal(b.title, '""'); assert.equal(b.windowIsSelf, true);
  assert.deepEqual(b.toolShape, ['description', 'name', 'origin', 'title', 'window']);
});
await test('executeTool(): object result is JSON, plain string is not quoted, no input -> {}', () => {
  assert.equal(b.execEcho, 'resolved:' + JSON.stringify(JSON.stringify({ got: { a: 1 } })));
  assert.equal(b.execNoInput, 'resolved:' + JSON.stringify(JSON.stringify({ got: {} })));
  assert.equal(b.execStr, 'resolved:"plain"');
});
await test('Chromium differs: undefined -> "undefined", 10n -> "10" (draft: OperationError)', () => {
  assert.equal(b.execUndef, 'resolved:"undefined"'); assert.equal(b.execBigint, 'resolved:"10"');
});
await test('Chromium differs: thrown/rejected execute -> UnknownError (draft: OperationError)', () => {
  assert.match(b.execThrow, /^UnknownError/); assert.match(b.execReject, /^UnknownError/);
});
await test('Chromium differs: unregistered, forged name, forged origin -> UnknownError (draft: NotFoundError)', () => {
  for (const k of ['execUnregistered', 'execForgedName', 'execForgedOrigin']) assert.match(b[k], /^UnknownError/, k);
  assert.equal(b.afterUnregister, false);
});
await test('TypeError: toJSON() -> undefined inputSchema; circular executeTool() input (agrees)', () => {
  assert.match(b.toJsonUndef, /^TypeError/); assert.match(b.execCircularInput, /^TypeError/);
});
await test('opaque origin "null" -> NotSupportedError (agrees)', () => assert.match(b.execOpaqueOrigin, /^NotSupportedError/));
await test('caller abort -> AbortError, execute signal aborts, toolcancel fires', () => {
  assert.match(b.execAborted, /^AbortError/);
  assert.ok(b.events.includes('execSignalAborted')); assert.ok(b.events.includes('toolcancel:slow'));
});
await test('pre-aborted executeTool() signal rejects with the custom reason', () => assert.equal(b.execPreAborted, 'Error: custom reason'));
await test('events: toolchange on register/unregister, toolactivated per execution', () => {
  assert.equal(b.events.filter((e) => e.startsWith('toolchange')).length, 9);
  assert.ok(b.events.includes('toolactivated:echo'));
});
await test('Permissions-Policy: tools=() -> NotAllowedError from all three methods', () => {
  assert.equal(out.blocked.allowsFeature, false);
  assert.deepEqual([out.blocked.register, out.blocked.getTools, out.blocked.execute], ['NotAllowedError', 'NotAllowedError', 'NotAllowedError']);
});
await test('cross-origin iframe without allow="tools" -> NotAllowedError', () => assert.equal(out.frames.noAllow, 'reg:NotAllowedError'));
await test('exposedTo + fromOrigins: the frame tool is visible only when both say yes', () => {
  assert.equal(out.frames.withAllow, 'registered');
  assert.deepEqual(out.frames.defaultGet, []);
  assert.deepEqual(out.frames.fromOrigins, ['frame_tool@http://127.0.0.1:8612']);
  assert.deepEqual(out.frames.notExposed, []);
});
await test('Chromium differs: target frame removed mid-call -> UnknownError (draft: AbortError)', () => {
  assert.match(out.frames.frameRemovedMidCall, /^UnknownError/);
});
await test('declarative <form toolname> still registers a tool in Chromium 156', () => {
  assert.equal(out.declarative.length, 1);
  assert.equal(out.declarative[0].name, 'search_availability');
  assert.deepEqual(out.declarative[0].schema.required, ['date', 'partySize']);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
