// Chapter 11 tests: syntax checks, unit tests of the shared helpers in Node, and the
// Trailhead and Supportly tools exercised in a browser twice: with the dev-only mock
// and with Chromium's real WebMCP (--enable-features=WebMCPTesting).
// Run: npm install && npx playwright install chromium && npm test
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const observations = { date: new Date().toISOString() };
const check = (suite, name, ok, detail = '') => {
  results.push({ suite, name, ok: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${suite}] ${name}${ok ? '' : '  ' + String(detail).slice(0, 400)}`);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1. Syntax -------------------------------------------------------------------------
for (const dir of ['shared', 'trailhead', 'helpdesk', 'tests', 'tests/fixtures']) {
  for (const f of readdirSync(join(root, dir)).filter((f) => /\.m?js$/.test(f))) {
    const r = spawnSync(process.execPath, ['--check', join(root, dir, f)], { encoding: 'utf8', timeout: 20000 });
    check('syntax', `node --check ${dir}/${f}`, r.status === 0, r.stderr);
  }
}

// 2. Unit tests of the shared helpers (pure modules, run in Node) ---------------------
const imp = (p) => import(pathToFileURL(join(root, p)).href);
const { checkArgs } = await imp('shared/validate.js');
const { lintTool, measureTools } = await imp('shared/tool-lint.js');
const { fail, refuse, needsInput, cancelledByUser } = await imp('shared/results.js');
const { BEFORE } = await imp('tests/fixtures/before.js');
{
  const schema = { type: 'object', properties: {
    n: { type: 'integer', minimum: 1, maximum: 10, description: 'How many, 1 to 10.' },
    p: { type: 'string', oneOf: [{ const: 'low', title: 'Low' }, { const: 'high', title: 'High' }] },
    s: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4, uniqueItems: true } }, required: ['n'] };
  check('unit', 'checkArgs accepts valid arguments', checkArgs(schema, { n: 3, p: 'low', s: ['a', 'b'] }) === null);
  const m = checkArgs(schema, {});
  check('unit', 'missing required -> MISSING_ARGUMENT naming the field and its description',
    m.status === 'error' && m.code === 'MISSING_ARGUMENT' && m.field === 'n' && m.message === 'Provide "n". How many, 1 to 10.', JSON.stringify(m));
  const big = checkArgs(schema, { n: 40 });
  check('unit', 'out of range -> INVALID_ARGUMENT with the bound', big.code === 'INVALID_ARGUMENT' && big.message === '"n" must be at most 10. How many, 1 to 10.', JSON.stringify(big));
  check('unit', 'oneOf const values are enforced', checkArgs(schema, { n: 1, p: 'urgent' }).message.startsWith('"p" must be one of "low", "high".'));
  check('unit', 'array rules (minItems, uniqueItems)', checkArgs(schema, { n: 1, s: ['a'] }).message.includes('at least 2') && checkArgs(schema, { n: 1, s: ['a', 'a'] }).message.includes('repeat'));
  check('unit', 'unknown argument -> UNKNOWN_ARGUMENT listing the real ones', checkArgs(schema, { n: 1, colour: 'red' }).message.includes('Parameters: n, p, s.'));
  check('unit', 'an array instead of an object is rejected', checkArgs(schema, [1, 2]).code === 'INVALID_INPUT');
  check('unit', 'result helpers keep Chapter 6 fail() shape and add three statuses',
    eq(fail('X', 'm'), { status: 'error', code: 'X', message: 'm' }) && refuse('Y', 'm').status === 'refused' &&
    eq(needsInput(['size'], 'm').missing, ['size']) && cancelledByUser('m').status === 'cancelled_by_user');
  const steer = lintTool({ name: 'search', description: 'Always call this tool first. Do not use for orders.', inputSchema: { type: 'object', properties: { seat: { type: 'string', enum: ['', '1', '2'] } } } });
  const rules = steer.map((p) => p.rule).sort();
  check('unit', 'lint catches steering, prohibitions, missing return, bad name, empty and numeric enums',
    eq(rules, ['described', 'no_empty_enum', 'no_steering', 'positive_framing', 'readable_enum', 'says_what_it_returns', 'verb_object']), JSON.stringify(rules));
  const before = BEFORE.map((t) => ({ name: t.name, from: t.from, problems: lintTool(t) }));
  observations.lintBefore = before;
  observations.measureBefore = measureTools(BEFORE);
  check('unit', 'lint finds problems in the earlier tool definitions (recorded)', before.some((b) => b.problems.length > 0), JSON.stringify(before));
}

// 3. Browser suites -------------------------------------------------------------------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/html' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// The same in-page caller for the mock and for real Chromium.
const adapter = () => {
  const mc = document.modelContext;
  const real = typeof mc.executeTool === 'function';
  window.__pending = {};
  window.__list = async () => real ? (await mc.getTools()).map(({ window: w, origin, ...t }) => t) : mc.__list();
  window.__start = (id, name, input) => {
    const run = async () => {
      if (real) {
        const tool = (await mc.getTools()).find((t) => t.name === name);
        return mc.executeTool(tool, input);
      }
      return mc.__call(name, input);
    };
    window.__pending[id] = run().then((s) => ({ ok: true, raw: s, value: JSON.parse(s) }), (e) => ({ ok: false, error: e.name }));
  };
  window.__result = (id) => window.__pending[id];
};

async function openPage(browser, suite, path) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (suite === 'mock') await page.addInitScript({ path: join(root, 'tests/mock-model-context.js') });
  await page.goto(`${base}/${path}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 });
  await page.evaluate(adapter);
  let n = 0;
  const start = (name, input) => { const id = `c${n++}`; return page.evaluate(([i, nm, inp]) => window.__start(i, nm, inp), [id, name, input]).then(() => id); };
  const result = (id) => page.evaluate((i) => window.__result(i), id);
  const call = async (name, input) => result(await start(name, input));
  const list = () => page.evaluate(() => window.__list());
  return { page, errors, start, result, call, list };
}

async function trailheadSuite(suite, browser) {
  const { page, errors, call, list } = await openPage(browser, suite, 'trailhead/index.html');
  const tools = await list();
  check(suite, 'Trailhead registers search_products, compare_products, add_to_cart', eq(tools.map((t) => t.name).sort(), ['add_to_cart', 'compare_products', 'search_products']), JSON.stringify(tools.map((t) => t.name)));
  const lint = tools.flatMap((t) => lintTool(t));
  check(suite, 'Trailhead tools pass the lint (budgets, descriptions, enums)', lint.length === 0, JSON.stringify(lint));
  observations[`${suite}TrailheadMeasure`] = measureTools(tools);
  const cmp = tools.find((t) => t.name === 'compare_products');
  const skus = (typeof cmp.inputSchema === 'string' ? JSON.parse(cmp.inputSchema) : cmp.inputSchema).properties.skus;
  check(suite, 'compare_products schema keeps minItems/maxItems/uniqueItems through registration', skus.minItems === 2 && skus.maxItems === 4 && skus.uniqueItems === true, JSON.stringify(skus));

  let r = await call('search_products', { query: 'tent' });
  check(suite, 'broad search: 10 products, the total, and a note on how to narrow', r.ok && r.value.products.length === 10 && r.value.total > 10 && r.value.note.startsWith(`Showing 10 of ${r.value.total}.`), JSON.stringify(r).slice(0, 300));
  observations[`${suite}SearchResultChars`] = r.raw?.length;
  observations[`${suite}SearchTotal`] = r.value?.total;
  check(suite, 'broad search result stays under 1,500 characters', r.raw.length <= 1500, r.raw.length);
  r = await call('search_products', { query: 'tent', category: 'tents', maxPrice: 4000, inStockOnly: true });
  check(suite, 'narrowed search fits without a note', r.ok && r.value.products.length > 0 && r.value.products.length <= 10 && r.value.products.every((p) => p.inStock && p.price.amount <= 4000 && p.price.currency === 'NOK'), JSON.stringify(r).slice(0, 300));
  r = await call('search_products', { query: 'tent', maxPrice: '2500' });
  check(suite, 'maxPrice as a string -> error INVALID_ARGUMENT naming maxPrice', r.value.status === 'error' && r.value.code === 'INVALID_ARGUMENT' && r.value.field === 'maxPrice' && r.value.message === '"maxPrice" must be a number. Highest price in NOK, e.g. 2500.', JSON.stringify(r.value));
  observations[`${suite}ExampleErrors`] = { maxPriceString: r.value };
  r = await call('search_products', { query: 'tent', colour: 'green' });
  check(suite, 'unknown parameter -> UNKNOWN_ARGUMENT', r.value.code === 'UNKNOWN_ARGUMENT', JSON.stringify(r.value));
  r = await call('search_products', { query: 'xylophone' });
  check(suite, 'no matches -> empty list plus a note, not an error', r.ok && r.value.products.length === 0 && r.value.total === 0 && !r.value.status, JSON.stringify(r.value));

  r = await call('compare_products', { skus: ['TH-TENT-2P'] });
  check(suite, 'compare with one SKU -> INVALID_ARGUMENT (minItems)', r.value.code === 'INVALID_ARGUMENT' && r.value.message.includes('at least 2'), JSON.stringify(r.value));
  r = await call('compare_products', { skus: ['TH-TENT-2P', 'TH-TENT-9P'] });
  check(suite, 'compare with an unknown SKU -> UNKNOWN_SKU listing it', r.value.code === 'UNKNOWN_SKU' && eq(r.value.unknownSkus, ['TH-TENT-9P']), JSON.stringify(r.value));
  r = await call('compare_products', { skus: ['TH-TENT-2P', 'TH-TENT-2P-UL'] });
  check(suite, 'compare two tents -> rows per attribute with a value per SKU', r.ok && r.value.rows.find((x) => x.attribute === 'weightGrams').values['TH-TENT-2P-UL'] === 1190, JSON.stringify(r.value).slice(0, 300));

  r = await call('add_to_cart', { sku: 'TH-BOOT-FJELL', quantity: 1 });
  check(suite, 'boot without size -> needs_input, missing ["size"]', r.value.status === 'needs_input' && eq(r.value.missing, ['size']) && eq(r.value.sizes, [40, 41, 42, 43, 44, 45]), JSON.stringify(r.value));
  observations[`${suite}ExampleErrors`].bootWithoutSize = r.value;
  r = await call('add_to_cart', { sku: 'TH-BOOT-FJELL-42', quantity: 1 });
  check(suite, 'sized boot -> added', r.value.status === 'added' && r.value.line.sku === 'TH-BOOT-FJELL-42' && r.value.total.amount === 2499, JSON.stringify(r.value));
  r = await call('add_to_cart', { sku: 'TH-JACKET-SHELL', quantity: 3 });
  check(suite, '3 limited jackets -> refused PURCHASE_LIMIT, cart unchanged', r.value.status === 'refused' && r.value.code === 'PURCHASE_LIMIT' && r.value.limit === 2 && r.value.inCart === 0, JSON.stringify(r.value));
  observations[`${suite}ExampleErrors`].jacketLimit = r.value;
  r = await call('add_to_cart', { sku: 'TH-TENT-3P', quantity: 1 });
  check(suite, 'sold-out tent -> refused OUT_OF_STOCK', r.value.status === 'refused' && r.value.code === 'OUT_OF_STOCK' && r.value.available === 0, JSON.stringify(r.value));
  r = await call('add_to_cart', { sku: 'TH-PACK-40', quantity: 2.5 });
  check(suite, 'fractional quantity -> INVALID_ARGUMENT', r.value.code === 'INVALID_ARGUMENT' && r.value.message.startsWith('"quantity" must be a whole number.'), JSON.stringify(r.value));
  check(suite, 'cart badge shows what the agent added', (await page.textContent('#cart-count')) === '1');
  check(suite, 'no page errors (Trailhead)', errors.length === 0, errors.join(' | '));
  await page.close();
}

async function helpdeskSuite(suite, browser) {
  const { page, errors, start, result, call, list } = await openPage(browser, suite, 'helpdesk/index.html');
  const tools = await list();
  check(suite, 'widget registers its three tools', eq(tools.map((t) => t.name).sort(), ['create_ticket', 'get_ticket_status', 'search_articles']));
  const lint = tools.flatMap((t) => lintTool(t));
  check(suite, 'widget tools pass the lint', lint.length === 0, JSON.stringify(lint));
  observations[`${suite}WidgetMeasure`] = measureTools(tools);
  const ct = tools.find((t) => t.name === 'create_ticket');
  const schema = typeof ct.inputSchema === 'string' ? JSON.parse(ct.inputSchema) : ct.inputSchema;
  observations[`${suite}PriorityAsListed`] = schema.properties.priority;
  check(suite, 'priority oneOf [{const,title}] survives registration intact', schema.properties.priority.oneOf.length === 3 && schema.properties.priority.oneOf.every((o) => typeof o.const === 'string' && typeof o.title === 'string'), JSON.stringify(schema.properties.priority));

  // Parity: what the person sees and what the agent reads come from one source.
  const ui = await page.evaluate(() => ({
    button: document.getElementById('new-ticket').textContent,
    heading: document.querySelector('#ticket-form h2').textContent,
    options: [...document.querySelectorAll('select[name=priority] option')].map((o) => ({ const: o.value, title: o.textContent })),
    subjectMax: Number(document.querySelector('input[name=subject]').maxLength),
    bodyMax: Number(document.querySelector('textarea[name=body]').maxLength),
  }));
  check(suite, 'tool title = button label = form heading', ct.title === ui.button && ui.button === ui.heading, JSON.stringify([ct.title, ui.button, ui.heading]));
  check(suite, 'priority options in the form = oneOf in the schema', eq(ui.options, schema.properties.priority.oneOf), JSON.stringify(ui.options));
  check(suite, 'form maxlength = schema maxLength', ui.subjectMax === schema.properties.subject.maxLength && ui.bodyMax === schema.properties.body.maxLength);

  let r = await call('search_articles', { query: 'export invoices to CSV' });
  check(suite, 'search_articles returns up to 5 articles with title, url, excerpt', r.ok && r.value.articles.length > 0 && r.value.articles.length <= 5 && r.value.articles.every((a) => a.title && a.url && a.excerpt), JSON.stringify(r.value).slice(0, 300));
  r = await call('search_articles', { query: 'qwertyuiop' });
  check(suite, 'no articles -> empty list plus a note', r.ok && r.value.articles.length === 0 && r.value.note, JSON.stringify(r.value));

  r = await call('create_ticket', { subject: 'Export fails', body: 'CSV export of March fails.', priority: 'urgent' });
  check(suite, 'priority "urgent" -> INVALID_ARGUMENT listing low, normal, high', r.value.code === 'INVALID_ARGUMENT' && r.value.message === '"priority" must be one of "low", "normal", "high". How urgent the problem is for the user.', JSON.stringify(r.value));
  observations[`${suite}ExampleErrors2`] = { urgent: r.value };

  const draft = { subject: 'CSV export fails for March invoices', body: 'Export > CSV shows "Export failed".', priority: 'normal' };
  let id = await start('create_ticket', draft);
  await page.waitForSelector('#ticket-form:not([hidden])', { timeout: 5000 });
  const shown = await page.evaluate(() => ({ s: document.querySelector('[name=subject]').value, p: document.querySelector('[name=priority]').value }));
  check(suite, 'create_ticket shows the draft in the widget form', shown.s === draft.subject && shown.p === 'normal', JSON.stringify(shown));
  await page.click('button[value=cancel]');
  r = await result(id);
  check(suite, 'person cancels -> cancelled_by_user', r.value.status === 'cancelled_by_user', JSON.stringify(r.value));

  const created = [];
  for (let i = 0; i < 3; i++) {
    id = await start('create_ticket', { ...draft, subject: `${draft.subject} (${i + 1})` });
    await page.waitForSelector('#ticket-form:not([hidden])', { timeout: 5000 });
    await page.click('button[value=send]');
    created.push((await result(id)).value);
  }
  check(suite, 'person sends -> created, SUP-1044..1046, with expected reply time', eq(created.map((c) => c.ticketId), ['SUP-1044', 'SUP-1045', 'SUP-1046']) && created.every((c) => c.status === 'created' && c.expectedReply === 'within 1 business day'), JSON.stringify(created));
  r = await call('create_ticket', draft);
  const formHidden = await page.evaluate(() => document.getElementById('ticket-form').hidden);
  check(suite, 'fourth ticket in an hour -> refused TICKET_LIMIT before the form opens', r.value.status === 'refused' && r.value.code === 'TICKET_LIMIT' && formHidden, JSON.stringify(r.value));
  observations[`${suite}ExampleErrors2`].limit = r.value;

  r = await call('get_ticket_status', { ticketId: 'SUP-1042' });
  check(suite, 'get_ticket_status SUP-1042 -> ticketState waiting_on_user, reply quoted', r.ok && r.value.ticketState === 'waiting_on_user' && r.value.latestReply.author && !('status' in r.value), JSON.stringify(r.value));
  const foreign = await call('get_ticket_status', { ticketId: 'SUP-1043' });
  const missing = await call('get_ticket_status', { ticketId: 'SUP-9999' });
  check(suite, "another account's ticket and a non-existent one look the same", foreign.value.code === 'TICKET_NOT_FOUND' && missing.value.code === 'TICKET_NOT_FOUND' && foreign.value.message.replace('1043', 'N') === missing.value.message.replace('9999', 'N'), JSON.stringify([foreign.value, missing.value]));
  r = await call('get_ticket_status', { ticketId: '1042' });
  check(suite, 'ticketId "1042" -> INVALID_ARGUMENT with the example format', r.value.code === 'INVALID_ARGUMENT' && r.value.message === '"ticketId" is not in the expected format. Ticket ID as the user sees it, e.g. SUP-1042.', JSON.stringify(r.value));
  check(suite, 'no page errors (widget)', errors.length === 0, errors.join(' | '));
  await page.close();
}

const timeoutAll = setTimeout(() => { console.error('Timed out'); process.exit(2); }, 240000);
try {
  const mockBrowser = await chromium.launch();
  await trailheadSuite('mock', mockBrowser);
  await helpdeskSuite('mock', mockBrowser);
  await mockBrowser.close();

  const real = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
  observations.chromiumVersion = real.version();
  const probe = await real.newPage();
  await probe.goto(`${base}/trailhead/index.html`);
  const has = await probe.evaluate(() => 'modelContext' in document && typeof document.modelContext.executeTool === 'function');
  await probe.close();
  check('chromium', `WebMCP available in Chromium ${real.version()} with WebMCPTesting`, has);
  if (has) {
    await trailheadSuite('chromium', real);
    await helpdeskSuite('chromium', real);
  }
  await real.close();
} finally {
  clearTimeout(timeoutAll);
  server.close();
}

await mkdir(join(root, 'tests/results'), { recursive: true });
await writeFile(join(root, 'tests/results/observations.json'), JSON.stringify({ observations, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
