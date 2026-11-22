// Support code (not a listing): opens Fjord Table's booking view with WebMCP
// attached over CDP, and plays the human who confirms bookings in the dialog.
import { attachWebMCP } from '../webmcp-cdp.js';

export function fjordTablePage(browser, siteUrl, { human = 'confirms' } = {}) {
  return async function openPage() {
    const context = await browser.newContext();
    const page = await context.newPage();
    const webmcp = await attachWebMCP(await context.newCDPSession(page));
    // The suite's sample dates (20, 21 and 28 November 2026) have to be in the
    // future for the fake backend. The listing keeps those dates.
    await page.clock.install({ time: new Date('2026-11-18T12:00:00') });
    await page.goto(`${siteUrl}#/book`);
    await webmcp.waitForTool('search_availability');
    await webmcp.waitForTool('book_table');
    let open = true;
    (async () => {                       // the person at the screen
      while (open) {
        try {
          await page.waitForSelector('#confirm-dialog[open]', { timeout: 1000 });
          await page.click(human === 'confirms' ? '#confirm-submit' : '#confirm-cancel');
        } catch { /* no dialog yet, or the page closed */ }
      }
    })();
    return { page, webmcp, close: async () => { open = false; await context.close(); } };
  };
}
