// Fjord Table, driven the way a browser agent drives it: over the WebMCP
// DevTools Protocol domain, with a human click in the site's own dialog.
// Needs Chromium with WebMCP on:  node --test tests/fjord-table.cdp.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { attachWebMCP } from '../webmcp-cdp.js';
import { serve, nextOpenDate } from './fixtures/serve.js';

let browser, site;
before(async () => {
  site = await serve(new URL('../../../fjord-table/', import.meta.url));
  browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
});
after(async () => { await browser?.close(); await site?.close(); });

async function openBookingView() {
  const page = await browser.newPage();
  const webmcp = await attachWebMCP(await page.context().newCDPSession(page));
  await page.goto(`${site.url}#/book`);
  await webmcp.waitForTool('search_availability');
  await webmcp.waitForTool('book_table');      // registered only on this view
  return { page, webmcp };
}
const DATE = nextOpenDate();

test('agent books, person confirms in the site dialog', async () => {
  const { page, webmcp } = await openBookingView();
  const found = await webmcp.invoke('search_availability', { date: DATE, partySize: 2 });
  assert.equal(found.status, 'Completed');
  const time = found.output.slots[0];

  const call = await webmcp.start('book_table', { date: DATE, time, partySize: 2 });
  await page.waitForSelector('#confirm-dialog[open]');    // Fjord Table's own UI
  await page.click('#confirm-submit');                     // the human's decision
  const { status, output } = await call.response;

  assert.equal(status, 'Completed');
  assert.equal(output.status, 'booked');
  assert.match(output.reference, /^FT-\d+$/);
  assert.equal(webmcp.calls.at(-1).input.partySize, 2);    // what the agent sent
});

test('bad input is answered with a value the agent can fix', async () => {
  const { webmcp } = await openBookingView();
  const { status, output } =
    await webmcp.invoke('book_table', { date: '20/11/2026', time: '19:00', partySize: 2 });
  assert.equal(status, 'Completed');                       // not an Error
  assert.equal(output.status, 'error');
  assert.equal(output.code, 'INVALID_INPUT');
  assert.match(output.message, /YYYY-MM-DD/);
});

test('cancelling a call aborts the tool and closes the dialog', async () => {
  const { page, webmcp } = await openBookingView();
  const { output } = await webmcp.invoke('search_availability', { date: DATE, partySize: 4 });
  const call = await webmcp.start('book_table',
    { date: DATE, time: output.slots[0], partySize: 4 });
  await page.waitForSelector('#confirm-dialog[open]');
  await webmcp.cancel(call.invocationId);                  // the agent gives up

  assert.equal((await call.response).status, 'Canceled');
  await page.waitForFunction(() => !document.querySelector('#confirm-dialog').open);
  assert.equal(await page.isHidden('#confirmation'), true); // nothing was booked
});
