# Chapter 7 — Frames, Origins and Page-Embedded Agents (Helpdesk Widget)

Runnable code for chapter 7 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*.

Two fictional companies, two origins:

- **Ledgerly**, an invoicing dashboard, `https://app.ledgerly.example` → served locally on `http://localhost:47101`
- **Supportly**, a help-widget vendor, `https://widget.supportly.example` → served locally on `http://127.0.0.1:47102`

Ledgerly embeds Supportly's widget, delegates the `tools` Permissions Policy to it, and runs an in-page agent that
discovers and calls the widget's tools with `getTools({ fromOrigins })` and `executeTool()`. An unpacked
Chrome extension shows the same tools from content scripts.

## Files and listings

Every file marked with a listing number is byte-for-byte identical to the listing in the chapter Markdown
(`chapters/07-frames-origins-agents/WebMCP_Ch07_Frames_Origins_Agents.md` in the book repo).

| File | Listing | What it is |
|---|---|---|
| `ledgerly/index.html` | 7.1 | Ledgerly's page; embeds the widget with `allow="tools"` |
| `ledgerly/permissions-policy.txt` | 7.2 | The `Permissions-Policy` header Ledgerly sends (the dev server reads and sends it) |
| `supportly/widget-tools.js` | 7.3 | The widget registers `search_articles`, `create_ticket`, `get_ticket_status` with `exposedTo` |
| — | 7.4 | IDL excerpt from the specification (not code to run) |
| `ledgerly/agent/discover.js` | 7.5 | `getTools({ fromOrigins })`, catalog keyed by vendor + name, debounced `toolchange` |
| `ledgerly/agent/run-tool.js` | 7.6 | `executeTool()` with a deadline, a stop signal and error mapping |
| `ledgerly/agent/agent-loop.js` | 7.7 | The minimal in-page agent loop |
| `extension/manifest.json` | 7.8 | MV3 manifest, content script in all frames |
| `extension/content-script.js` | 7.9 | Per-frame tool reporting and execution from the isolated world |
| `extension/background.js` | 7.10 | Service worker: catalog per tab/frame, runs a tool in a given frame |

Not printed in the book (minimal fill so the demo runs):

| File | What it is |
|---|---|
| `supportly/embed.html` | The widget page; calls `registerWidgetTools()` and shows the result |
| `supportly/helpdesk-api.js` | Fake in-memory helpdesk backend (articles, tickets; `SUP-1042` exists) |
| `supportly/widget-ui.js` | `confirmTicket()`: the widget's own confirmation card, cancelled by the call's signal |
| `supportly/widget.css`, `ledgerly/ledgerly.css` | Styles |
| `ledgerly/agent/assistant.js` | Wires the assistant panel; registers Ledgerly's own `find_invoice` tool |
| `ledgerly/agent/rule-planner.js` | A rule-based stand-in for a model, so tests are deterministic |
| `tests/serve.mjs` | Dev server for both origins (see below) |
| `tests/mock-model-context.js` | **Dev/test only** `document.modelContext` mock (single document; no frames/origins). Never ship it. |
| `tests/run-tests.mjs` | The test suite |

### How the dev server keeps files byte-identical

`tests/serve.mjs` serves `ledgerly/` on port 47101 and `supportly/` on port 47102 and rewrites the two production
origins in every text response to the local ones. It sends `ledgerly/permissions-policy.txt` as Ledgerly's header.
Test-only query switches on `index.html`: `?pp=none` (`tools=()`), `?pp=self` (`tools=(self)`), `?pp=off`
(no header), `?noallow` (drop `allow="tools"`), `?customer=<id>` (change the widget's customer). The extension test
copies `extension/` to a temp dir and points its match patterns at the local hosts.

## Run it

```sh
npm install
npx playwright install chromium   # Playwright 1.64 ships Chromium 156
npm start                          # http://localhost:47101/
```

To see the tools in a real browser, use Chrome with `chrome://flags/#enable-webmcp-testing` enabled (or launch
Chromium with `--enable-features=WebMCPTesting`). Without WebMCP the page still works for humans; the assistant says it is off.

## Tests

```sh
npm test
```

Last run on 15 October 2026 (UTC, tech review), Playwright 1.64 with Chromium 156.0.8078.4: **30/30 passed**.

- 11 syntax checks (`node --check` on every script, JSON parse of the manifest)
- 1 unit test of the agent loop and `runTool()` against the dev-only mock (plain Chromium, no WebMCP)
- 17 behavioural tests in Chromium 156 with `--enable-features=WebMCPTesting`, across the two origins:
  registration inside the iframe; same-origin-only default for `getTools()`; `discoverTools()` merging both origins;
  `toolchange`; `search_articles`; the full agent loop with the user clicking *Send ticket* inside the widget;
  `untrustedContentHint`; user stop → `AbortError` + `toolcancel` in the widget; deadline → "timed out";
  recoverable errors as values (`{ status: 'error', code, message }`); the user's Cancel → `cancelled_by_user`; no `allow` → `NotAllowedError`; `tools=()`; `tools=(self)` overriding `allow`;
  unknown customer → empty `exposedTo`; `SecurityError` for insecure origins; a thrown error crossing as a bare `UnknownError`
- 1 extension test: Listings 7.8–7.10 loaded unpacked into full Chromium 156; both frames report their own tools and the
  service worker runs `search_articles` in Supportly's frame

### Chromium 156 vs the 15 October 2026 draft (observed)

| Situation | Draft | Chromium 156 |
|---|---|---|
| Tool's `execute` throws | `OperationError` | `UnknownError` |
| Forged `name` / forged `origin` in `executeTool()` | `NotFoundError` | `UnknownError` |
| Target iframe navigates away or is removed mid-call | `AbortError` | `UnknownError` |
| Caller aborts | rejects with reason, `toolcancel` in target | same (`AbortError`, `toolcancel`) |
| `'modelContext' in document` when the policy blocks | attribute still exists | `true` |

## Result convention (tech review, 15 October 2026)

The widget's tools use Chapter 11's result statuses: `{ status: 'error', code, message }` for input the agent can fix (`INVALID_INPUT`, `TICKET_NOT_FOUND`), `{ status: 'cancelled_by_user', message }` when the person cancels in the widget, and `{ status: 'created', ticketId }` on success. `get_ticket_status` returns the ticket's own lifecycle as `ticketState` (for example `waiting_on_customer`), so `status` stays free for outcomes. Ledgerly's demo tool `find_invoice` does the same with `invoiceState`.

Every `UnknownError` in the table above is spec lag: the draft used `UnknownError` for those cases until 8 October 2026 (commit b206dae, PR #339), and Chromium 156 still implements that text.
