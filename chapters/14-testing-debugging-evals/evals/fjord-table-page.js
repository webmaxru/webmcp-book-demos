// Support code (not a listing): opens Fjord Table's booking view with WebMCP
// attached over CDP, and plays the human who confirms bookings in the dialog.
import { attachWebMCP } from '../webmcp-cdp.js';

export function fjordTablePage(browser, siteUrl, { human = 'confirms' } = {}) {
  return async function openPage() {
    const context = await browser.newContext();
    const page = await context.newPage();
    const webmcp = await attachWebMCP(await context.newCDPSession(page));
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
