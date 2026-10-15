// Chapter 9's Test Agent, unchanged, driving Fjord Table from inside the page with a
// scripted planner: the in-page counterpart of the CDP eval harness. Chromium + WebMCPTesting.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve, nextOpenDate } from './fixtures/serve.js';

const TEST_AGENT = fileURLToPath(new URL('../../09-first-webmcp-app/test-agent.js', import.meta.url));
let browser, site;
before(async () => {
  site = await serve(new URL('../../../fjord-table/', import.meta.url));
  browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
});
after(async () => { await browser?.close(); await site?.close(); });

async function openWithTestAgent(human) {
  const page = await browser.newPage();
  // Serve Chapter 9's test-agent.js next to the app, as ?test-agent would load it.
  await page.route('**/test-agent.js', (route) =>
    route.fulfill({ path: TEST_AGENT, contentType: 'text/javascript' }));
  await page.goto(`${site.url}#/book`);
  await page.waitForFunction(async () => (await document.modelContext.getTools()).length === 2);
  (async () => {                                      // the person at the screen
    try {
      await page.waitForSelector('#confirm-dialog[open]', { timeout: 10_000 });
      await page.click(human === 'confirms' ? '#confirm-submit' : '#confirm-cancel');
    } catch { /* no dialog, or the page closed */ }
  })();
  return page;
}

const runScripted = (page, date) => page.evaluate(async (date) => {
  const { createTestAgent, scripted } = await import('/test-agent.js');
  const agent = createTestAgent({ log: () => {}, planner: scripted(
    { tool: 'search_availability', args: { date, partySize: 2 } },
    ([found]) => ({ tool: 'book_table',
                    args: { date, time: found.result.slots[0], partySize: 2 } })) });
  const { done, transcript } = await agent.run('Book a table for two');
  return { done, results: transcript.map((e) => e.result ?? e.error) };
}, date);

test('Test Agent (Chapter 9), scripted: search, book, the guest confirms', async () => {
  const page = await openWithTestAgent('confirms');
  const { done, results } = await runScripted(page, nextOpenDate());
  assert.equal(done, true);
  assert.equal(results.length, 2);
  assert.equal(results[1].status, 'booked');
  assert.match(results[1].reference, /^FT-\d+$/);
  await page.close();
});

test('Test Agent (Chapter 9), scripted: the guest cancels, nothing is booked', async () => {
  const page = await openWithTestAgent('cancels');
  const { results } = await runScripted(page, nextOpenDate());
  assert.equal(results[1].status, 'cancelled_by_user');
  assert.equal(await page.isHidden('#confirmation'), true);
  await page.close();
});
