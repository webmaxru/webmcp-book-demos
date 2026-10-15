# Chapter 12 · Threat Models for Tool-Exposing Pages

Runnable examples for Chapter 12 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (working title).
Every listing file below is byte-identical to the code printed in the chapter.

| File | Listing | What it is |
|---|---|---|
| `supportly/result-shaping.js` | 12.1 | Shapes `search_articles` results: source labels, clipped text, 1,500-character budget |
| `supportly/guards.js` | 12.2 | Validates tool input in code (undeclared fields, lengths, enums) |
| `trailhead/search-products-schemas.js` | 12.3 | Over-parameterised schema vs the schema Trailhead ships |
| `ledgerly/index.html` | 12.4 | Ledgerly embeds the Supportly widget with `allow="tools"` (header in the comment) |
| `supportly/widget-tools.js` | 12.5 | Supportly's three tools, split by risk and exposure |
| `attack/wrap-register.js` | 12.6 | The same-origin `registerTool()` wrapper attack (demonstration only) |
| `audit/audit-tools.js` | 12.7 | Pre-release audit of the registered tool surface |

Fill-in files (not printed in the book):

- `supportly/widget-app.js`: fake help centre (including one community answer with an injection string), fake ticket store, and the widget's review dialog, which resolves only on a trusted click.
- `supportly/embed.html`: the widget page that loads Listing 12.5.
- `dev/model-context-mock.js`: a single-document stand-in for `document.modelContext` used by one test in a browser without WebMCP. Dev and test only.

## Run the tests

```sh
npm install
npx playwright install chromium
npm test
```

The runner serves every page under its book origin (`https://app.ledgerly.example`, `https://widget.supportly.example`, `https://partner.example`) through Playwright request routing, so the listings run unchanged with real cross-origin frames and real Permissions-Policy headers. Browser tests use Chromium with `--enable-features=WebMCPTesting` (the switch behind `chrome://flags/#enable-webmcp-testing`).

## What passed (15 October 2026, Chromium 156.0.8078.4, Playwright 1.64)

26 of 26 (re-run in the tech review, 15 October 2026):

- `node --check` on all 8 JavaScript files.
- Unit tests in Node for the guard, the result shaper and the audit.
- Mock test (plain Chromium, no WebMCP): the widget registers three tools with the right annotations and `exposedTo`.
- Real Chromium (WebMCPTesting):
  - Ledgerly's plain `getTools()` is empty; with `fromOrigins` it sees exactly `search_articles` and `get_ticket_status`, with `origin` and annotations (including `untrustedContentHint`) intact. `create_ticket` is never visible.
  - `partner.example`, embedding the same widget with `allow="tools"`, sees nothing.
  - Without `allow="tools"`, or with a `tools=(self)` header, the widget's `registerTool()` rejects with `NotAllowedError`.
  - `search_articles` output stays under 1,500 characters, labels the community answer and clips it to 300 characters.
  - The browser passes a 50,000-character string and an undeclared field straight to `execute`; Listing 12.2 rejects both as returned `{ status: 'error', code: 'INVALID_ARGUMENT', message }` results (Chapter 11's convention).
  - `get_ticket_status` returns `ticketState` (not `status`) and `TICKET_NOT_FOUND` for an unknown ID.
  - `create_ticket` ignores a scripted `click()` and completes only on a trusted click (`status: 'created'`); pressing Cancel returns `status: 'cancelled_by_user'`; aborting the caller's signal closes the dialog and rejects with `AbortError` (the tool's own signal aborts just after the caller's promise rejects).
  - A script loaded before the page's tools wraps `registerTool()` and exfiltrates a call's input (Listing 12.6).
  - The audit (Listing 12.7) reports no findings for the widget's registered tools.
