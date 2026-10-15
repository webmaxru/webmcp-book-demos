# Chapter 16: Product and Business Implications

Runnable examples for chapter 16 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*. They belong to **Trailhead**, the book's fictional Norwegian outdoor-gear store, and show the non-UI side of shipping WebMCP: a tool catalog owned like product copy, a CI check for Chrome's character budgets, a measurement wrapper and order attribution.

Every file under `src/` that maps to a listing is byte-identical to the code printed in the chapter.

## Files and listings

| File | Book | Notes |
|---|---|---|
| `src/tool-catalog.ts` | Listing 16.1 | The five canonical Trailhead tools with title, description, journey, owner, eval suite and annotations. |
| `src/measure.ts` | Listing 16.2 | `withMeasurement()`: reports `ok`, one of Chapter 11's statuses (`error`, `needs_input`, `refused`, `cancelled_by_user`), `threw` or `aborted` for each call, plus the result's code and the duration. |
| `src/attribution.ts` | Listing 16.3 | `noteAgentAssist()` and `orderAttribution()`, using `sessionStorage` (per tab). |
| `src/register-tools.ts` | Listing 16.4 | Registers the catalog with measurement and attribution, behind feature detection, with one `AbortSignal`. |
| `src/check-budgets.ts` | Listing 16.5 | Fails when a name or description exceeds Chrome's provisional budgets, or a tool has no owner or eval suite. |
| `src/trailhead-tools.ts` | none (filler) | Input schemas and execute handlers over a four-product in-memory catalogue, so Listing 16.4's imports resolve. Calls that fall short return Chapter 11's `{ status, code, message }` (out of stock is `status: 'refused'`, code `OUT_OF_STOCK`). Chapter 10 builds the real React store. |
| `src/analytics.ts` | none (filler) | A stand-in analytics client that keeps events in memory. |
| `src/main.ts`, `tests/index.html` | none (filler) | A minimal test page: registers the tools, and sends `order_placed` with `orderAttribution()` when **Place order** is clicked. |
| `dev/model-context-mock.js` | none | **Test-only** stand-in for `document.modelContext` (the same mock as `fjord-table/dev/`). The page never loads it. |
| `tests/run-tests.mjs` | none | The tests below. |

## Run the tests

```sh
cd chapters/16-product-and-business-implications
npm install
npx playwright install chromium
npm test              # WebMCP from dev/model-context-mock.js
npm run test:chrome   # WebMCP from Chromium itself (--enable-features=WebMCPTesting)
npm run typecheck     # tsc --noEmit against webmcp-types
```

`npm test` compiles `src/` to `dist/` with TypeScript, runs the budget check in Node, then drives `tests/index.html` in Chromium with Playwright:

- Listing 16.5 passes for the catalog and catches a 501-character description, a duplicate name and a missing owner.
- Listing 16.1's names follow the spec's name rule and match the book's canonical Trailhead tool set.
- Without WebMCP the page loads cleanly and registers nothing.
- Listing 16.4 registers all five tools with the right `readOnlyHint` and `consequentialHint`.
- Listing 16.2 records `ok` for a search, `refused` with code `OUT_OF_STOCK` for an out-of-stock item (the value still reaches the agent), `error` with code `UNKNOWN_SKU` for an unknown SKU, `threw` for a thrown handler (and `executeTool()` still rejects), and `aborted` for an aborted call (a caller's abort, not Chapter 11's `cancelled_by_user`).
- Listing 16.3: an order placed after agent calls carries `agentAssisted: true` and the tools that helped; an order with no agent calls carries `agentAssisted: false`.
- Aborting the registration signal removes all five tools.

## Results (15 October 2026)

Both runs passed, 17 of 17 checks (after the 15 October tech review; 14 before it), on Chromium 156.0.8078.4 (Playwright 1.64.1), TypeScript 5.9 and webmcp-types 0.1.10.

Observed only in Chromium 156 with `WebMCPTesting` (not specified behaviour, so don't depend on it):

- `getTools()` returned tools sorted by name, not in registration order. The mock keeps registration order.
- A thrown error in `execute` made `executeTool()` reject with `UnknownError`. The draft (15 October 2026) says `OperationError` ("tool rejected"), which is what the mock does. The draft has used specific error names since 8 October 2026 (PR #339); Chromium 156's `UnknownError` is spec lag, not a bug.
- `toolactivated` fired on `document.modelContext` for every in-page `executeTool()` call, in call order.

## License

MIT. See [LICENSE](../../LICENSE).

## Tech review, 15 October 2026

- Applied Chapter 11's result convention (book-wide decision): `trailhead-tools.ts` returns `{ status, code, message }` with upper-case codes, and `measure.ts` (Listing 16.2) classifies by `status`. The thrown-exception outcome is now `threw`, so it can't be confused with `status: 'error'`, and the caller-abort outcome is `aborted`, so it can't be confused with `status: 'cancelled_by_user'`.
- Test names now use the chapter's listing numbers (they had been shifted), and a listings check compares each listing in the chapter with its file in `src/` when `CHAPTER_MD` is set.
- Re-run from a fresh clone: `npm test` and `npm run test:chrome` both pass (17 checks each; Node 22, Playwright 1.64.1, Chromium 156.0.8078.4).
