# Fjord Table: a WebMCP demo

Fjord Table is a fictional restaurant on the Oslo waterfront and the running example in *Tools, Not Clicks* (working title), chapters 4 and 5. This folder is a small booking site in plain HTML, CSS and JavaScript modules. It has no build step and no dependencies at run time.

- **In any browser** it works as an ordinary booking page: pick a date, time and party size, choose a time, confirm.
- **Where `document.modelContext` exists** (Chrome with the WebMCP flag or origin trial), it also registers two WebMCP tools: `search_availability` and `book_table`.

The tool code is copied from the chapter listings, so the repo and the book match. Where a listing calls something the book never shows (the booking backend, the booking panel, `localizeTool()`), the demo adds the minimum needed to make it run. Each addition is listed below.

## Run it

```sh
cd fjord-table
npx serve .
```

Open the address it prints (usually http://localhost:3000). Any static server works (`python3 -m http.server` does too). Serve it over `http://localhost` or HTTPS: WebMCP only exists in secure contexts, and `file://` URLs won't load ES modules.

## Try it with WebMCP in Chrome

Checked on 14 October 2026 against Chrome's [WebMCP overview](https://developer.chrome.com/docs/ai/webmcp) (page last updated 7 October 2026) and the [Chrome Status entry](https://chromestatus.com/feature/5117755740913664). This changes often, so re-check those two pages.

**Local development: the flag.**

1. Open `chrome://flags/#enable-webmcp-testing`, set it to **Enabled**, and relaunch Chrome.
2. Open the demo on localhost. The grey bar under the header turns green and lists the registered tools.

For scripted tests, the same switch is `--enable-features=WebMCPTesting` on the command line. That is what `npm run test:chrome` uses.

**On a real origin: the origin trial.** Chrome's WebMCP origin trial started in Chrome 149. Chrome Status lists it as originally running to Chrome 156, now extended to Chrome 162. Register your origin at the [WebMCP origin trial page](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241), then paste the token into the commented-out `<meta http-equiv="origin-trial">` tag in `index.html`. Microsoft Edge runs its own WebMCP origin trial (Edge 150, expiring 30 March 2027 at the time of writing). It isn't covered here.

**Calling the tools.** Registering a tool doesn't make anything call it. To call them:

- **DevTools.** Chapter 5 describes Chrome's WebMCP pane in the Application panel. It lists the page's tools, logs calls, and lets you run a tool by hand. Try `book_table` with `partySize: 40` and you should get a helpful `invalid_input` result back, not an error.
- **Chrome's Model Context Tool Inspector extension** ([Chrome Web Store](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd)). Chrome's docs recommend it for experimenting with an agent against your tools.
- **The console, as an in-page agent.** Paste Listing 4.2:

  ```js
  const tools  = await document.modelContext.getTools();
  const search = tools.find((t) => t.name === 'search_availability');
  const json = await document.modelContext.executeTool(search, {
    date: '2026-11-20', time: '19:00', partySize: 4
  });
  console.log(JSON.parse(json).slots);
  ```

  `book_table` is only registered while the **Book a table** view is open (Listing 5.5). Call it from there, and the site's own confirmation dialog opens pre-filled for you to confirm or cancel.

## Files, chapters and listings

| File | Book | Notes |
|---|---|---|
| `search-availability.js` | Listing 4.1 (ch. 4) = Listing 5.1 (ch. 5) | Verbatim, with two `import` lines added. The book names this file `agent-tools.js`. The demo gives that name to Listing 5.3, so this registration moved here. |
| `agent-tools.js` | Listing 5.3 (ch. 5) | Verbatim. `registerAgentTool()`: feature detection plus error handling. |
| `booking-tools.js` | Listing 5.4 (ch. 5) | Verbatim, with two `import` lines added. The `book_table` tool, `checkBookingInput()`, recoverable failures returned as values. |
| `booking-view.js` | Listing 5.5 (ch. 5) | Verbatim, plus a minimal `localizeTool()` (Norwegian title and description) that the listing calls but the book doesn't define. |
| `typed/agent-tools.ts` | Listing 5.6 (ch. 5) | Verbatim. Type-checked with `webmcp-types` 0.1.10 and TypeScript 5.9 (`npm run typecheck`). It isn't loaded by the page. |
| `typed/fjord-table.d.ts` | none | Demo-only types for `availability` and `bookingPanel`, so Listing 5.6 type-checks on its own. |
| `availability.js` | none | The fake backend: in memory, deterministic, resets on reload. Open Tuesday to Sunday, 17:00 to 21:30 every 30 minutes, closed Mondays. Window, indoor and heated-terrace seating. |
| `booking-panel.js` | none | The site's own UI that the listings call: `bookingPanel.showSlots()` and `bookingPanel.confirmWithUser()`. Humans use the same two methods. |
| `app.js`, `index.html`, `styles.css` | none | Page wiring: three views (Home, Menu, Book a table), the human search form, the WebMCP status bar, and the tool-language switch. |
| `dev/model-context-mock.js` | none | **Test-only.** A small stand-in for `document.modelContext`, following the 13 Oct 2026 draft. The app never loads it. |
| `tests/run-tests.mjs` | none | End-to-end tests (Playwright). |

Patterns from chapter 5 you can watch in action:

- **Feature detection.** All tool code sits behind `'modelContext' in document`. Without it, nothing registers and the page works normally.
- **Validation in code, recoverable failures as values.** `book_table` returns `{ status: 'invalid_input' | 'slot_unavailable' | 'not_confirmed_by_user' | 'booked', … }` instead of throwing.
- **A confirm step in the site's own UI.** `book_table` never books on its own. It opens the pre-filled booking dialog, and the person confirms or cancels. The guest's name and contact come from the (demo) signed-in account, never from the agent.
- **AbortController-based unregistration and view-scoped tools.** `book_table` exists only while the booking view is open. Switching **Tool descriptions for agents** in the footer to *Norsk* re-registers it with a Norwegian title and description (Listing 5.5's `relabelBookingTools()`).

### Choices the book doesn't specify

- `bookingPanel.showSlots()` switches to the booking view when it shows results. That way, "the user sees what the agent found" even if the agent searched from another view, and it means `book_table` becomes available right after a search.
- `availability.search()` returns an empty list for unusable input (bad date, past date, Monday, party size outside 1 to 12), not an exception. `search_availability` itself has no validation in Listing 4.1, so it returns `slots: []` in those cases.
- If the caller cancels while the confirmation dialog is open, the dialog closes and `confirmWithUser()` rejects with the abort reason.

## Tests

```sh
cd fjord-table
npm install
npx playwright install chromium
npm test              # WebMCP from dev/model-context-mock.js
npm run test:chrome   # WebMCP from Chromium itself (--enable-features=WebMCPTesting)
npm run typecheck     # Listing 5.6 against webmcp-types
```

Both test runs cover the same things:

- the page loads with no console errors and no WebMCP
- a person books a table through the UI
- `search_availability` is registered at startup, and `book_table` only while the booking view is open
- Listing 4.2 runs as printed
- `book_table` returns `invalid_input` and `slot_unavailable` as values
- an agent booking goes through the site's confirmation dialog and returns `booked` with a reference
- a cancel returns `not_confirmed_by_user`
- a caller's abort closes the dialog
- relabelling to Norwegian re-registers the tool and it still books

### What Chromium 156 did differently from the draft

On 14 October 2026 `npm run test:chrome` passed on Chromium 156.0.8078.4 (Playwright 1.64's build) with `--enable-features=WebMCPTesting`. In a separate probe, that build differed from the 13 October 2026 draft in these places:

| Case | Draft says | Chromium 156 did |
|---|---|---|
| `registerTool()` without `inputSchema` | allowed (`inputSchema` is optional in the IDL) | allowed |
| `execute` returns a plain string, e.g. `'Booked for 19:00'` | JSON string literal, `"Booked for 19:00"` with quotes | `Booked for 19:00`, no quotes |
| `execute` returns `undefined` | fails: *unserializable result* → `OperationError` | resolves to the string `undefined` |
| `execute` throws | `OperationError` | `UnknownError` ("Tool was executed but the invocation failed"); the thrown message is logged to the page's console, not returned |
| `executeTool()` for a tool that isn't registered | `NotFoundError` | `UnknownError` |
| `getTools()` entries | `name`, `title`, `description`, `inputSchema` (object), `window`, `origin`, `annotations` | the same; `annotations` also carries defaults such as `readOnlyHint: false` |

Fjord Table's tools always return objects and never rely on a thrown message, so they behave the same either way. That is chapter 5's advice in practice.

## License

MIT. See [LICENSE](../LICENSE).
