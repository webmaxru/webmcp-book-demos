# Chapter 9: Your First WebMCP App, End to End

Fjord Table, the small Oslo restaurant-booking site from the book *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (working title), put together end to end. The page works for everyone. Agent tools are added as a progressive enhancement: native WebMCP where the browser has it, an opt-in pinned polyfill otherwise, and nothing at all on insecure origins or under a blocking Permissions Policy. The folder also has the chapter's **Test Agent** (an in-page agent harness) and a small server that sends the deployment headers.

## Files and listings

| File | Listing | Notes |
|---|---|---|
| `snippets/check-webmcp.js` | 9.1 | Paste into the DevTools console. The tests evaluate it in the page. |
| `webmcp/enable.js` | 9.2 | Chooses `native`, `polyfill` or `off`, with a reason. |
| `webmcp/tools.js` | 9.3 | `search_availability` and `book_table` as thin wrappers over the page's own code. |
| `app.js` | 9.4 | Start-up: the page first, then the tools, then the Test Agent with `?test-agent`. |
| `test-agent.js` | 9.5 | The Test Agent: `getTools()` + `executeTool()` with a pluggable planner; `scripted()` planner. |
| `prompt-planner.js` | 9.6 | A planner using Chrome's Prompt API (`LanguageModel`, `responseConstraint`). |
| `deploy/claude_desktop_config.json` | 9.7 | MCP client entry for `@mcp-b/webmcp-local-relay@6.0.3`, restricted with `--widget-origin`. |
| `deploy/origin-trial-meta.html` | 9.8 | The origin-trial meta tag (placeholder token). |
| `server.js` | 9.9 | Serves the app; `Permissions-Policy: tools=(self)` (or `TOOLS_POLICY`), `Origin-Trial` from `WEBMCP_OT_TOKEN`. |
| `index.html`, `styles.css` | (none) | The page. Demo code. |
| `availability.js`, `booking-panel.js` | (none) | Copied **unchanged** from the Chapter 4–5 demo (`fjord-table/`): the fake booking back end and the booking UI. |
| `dev/model-context-mock.js` | (none) | Dev-only `document.modelContext` mock (unchanged from `fjord-table/dev/`). Never loaded by the page; the tests inject it. |
| `tests/run-tests.mjs` | (none) | The test suite (below). `tests/listings.json` maps listings to files. |

Every listing file is byte-identical to the code in the chapter. The test `every listing file matches the code in the chapter` checks this when `CHAPTER_MD` points at the chapter's Markdown (it lives in the `webmcp-book` repository, `chapters/09-first-webmcp-app/`). No listing needed filling in.

The two short inline snippets in the chapter's prose (a `scripted()` run and a console call) are not numbered listings. The first is the planner from the test `native: scripted run() uses one result to plan the next call`, minus its `log` option; the second is what `agentBooks()` in the tests does through Playwright.

## Run it

```bash
npm install
npx playwright install chromium
npm start                      # http://localhost:3000/
npm test                       # 20 checks (21 with CHAPTER_MD=…/WebMCP_Ch09_First_WebMCP_App.md)
```

Open `http://localhost:3000/?test-agent` in Chrome with `chrome://flags/#enable-webmcp-testing` enabled, then in the console:

```js
await testAgent.call('search_availability', { date: '2026-11-20', partySize: 4 });
```

Add `&webmcp-polyfill` (or use `?webmcp-polyfill` alone) to try the polyfill path in a browser without WebMCP.

## Test results (14 October 2026)

Run with Playwright 1.64 and its Chromium **156.0.8078.4**: plain, with `--enable-features=WebMCPTesting`, and with `--host-resolver-rules=MAP fjord.test 127.0.0.1` for an insecure origin. **21 passed, 0 failed** (with `CHAPTER_MD` set).

- Static: `node --check` on every `.js`/`.mjs` file; the relay config parses and pins 6.0.3 with `--widget-origin`; the SRI hash in `webmcp/enable.js` matches `@mcp-b/webmcp-polyfill@6.0.3/dist/index.iife.js` (the same bytes jsDelivr served on 14 October 2026); listings match the chapter.
- Plain Chromium: tools off (`not-supported`) and a person can search and book; Listing 9.1 output; the polyfill path (`?webmcp-polyfill`, CDN URL served from the installed package so SRI still applies) registers both tools and the Test Agent books with the guest's confirmation; a blocked polyfill request leaves tools off (`polyfill-failed`); the Test Agent books against the mock.
- WebMCPTesting: both tools registered with their annotations; the Test Agent searches and books, and `book_table` stays pending until the guest clicks; Cancel gives `{ status: 'cancelled_by_user', message }`; a scripted `run()` plans its second step from the first result; invalid input comes back as `{ status: 'error', code: 'INVALID_INPUT', message }` (Chapter 11's result convention, adopted in the 15 October 2026 technical review); Listing 9.1 output; the DevTools Protocol `WebMCP` domain sees both tools and `invokeTool` returns `Completed`; `http://fjord.test` (insecure) has no `document.modelContext`; `Permissions-Policy: tools=()` makes `registerTool()` throw `NotAllowedError`, and the page still works; `server.js` headers; an invalid `Origin-Trial` token is ignored without errors; the Prompt API planner drives the Test Agent against a **stub** `LanguageModel`.

### Observed in Chromium 156 (the facts the chapter quotes)

| Check | Result |
|---|---|
| Listing 9.1, no flag | `secureContext: true, webmcp: false, registerTool: "undefined", toolsPolicy: false` |
| Listing 9.1, WebMCPTesting | `webmcp: true, registerTool: "function", getTools: "function", toolsPolicy: true` |
| Listing 9.1, WebMCPTesting + `tools=()` | `webmcp: true, registerTool: "function", toolsPolicy: false`; `registerTool()` throws `NotAllowedError` |
| Insecure origin with WebMCPTesting | `isSecureContext: false`, `'modelContext' in document: false`, no error |
| `getTools()` annotations | all four keys present: e.g. `book_table` → `{consequentialHint: true, debugging: false, readOnlyHint: false, untrustedContentHint: false}` |
| CDP `WebMCP.toolResponded.output` | an object (parsed), status `Completed` |
| Prompt API in this Chromium build | `LanguageModel` defined; `LanguageModel.availability()` → `"downloadable"` (no model on the machine) |

### Not tested here

- The on-device model itself: the model was not downloaded; the planner was tested against a stub that replays answers and records the `responseConstraint`.
- The Model Context Tool Inspector, the Example Agentic Chrome Extension and the DevTools WebMCP pane: described in the chapter from their documentation; not run.
- The local relay with a real desktop MCP client (only the config file is checked).
- A real origin-trial token: tokens are issued per registered origin, so only an invalid token's behaviour (ignored) was tested.
