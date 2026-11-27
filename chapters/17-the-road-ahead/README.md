# Chapter 17: The Road Ahead

Runnable examples for chapter 17 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*. They belong to **Trailhead**, the book's fictional Norwegian outdoor-gear store, and show how to build so that today's tools survive tomorrow's API: tools as plain data, one adapter that knows the WebMCP API shape, and a probe that reports what a browser actually supports.

Every file under `src/` that maps to a listing is byte-identical to the code printed in the chapter (the tests check this when `CHAPTER_MD` points at the chapter's Markdown).

## Files and listings

| File | Book | Notes |
|---|---|---|
| `src/catalog.js` | Listing 17.1 | `search_products` as plain data plus a `run()` function, with an optional `outputSchema` added by WebMCP PR #254 (merged 2 November 2026). |
| `src/adapter.js` | Listing 17.2 | `registerCatalog()` returns the batch promise and passes that same promise to `waitForToolsUntil?.()`. A synchronous `InvalidStateError` or `NotAllowedError` is caught so the return still happens. Any other exception is rethrown. Feature detection, input validation, `outputSchema` and `exposedTo` are unchanged, and one `AbortSignal` still covers the whole catalog. |
| `src/probe.js` | Listing 17.3 | `probeWebMCP()` reports `document.modelContext`, the legacy `navigator.modelContext`, whether `waitForToolsUntil` is a function, `resumeTool()`, whether `outputSchema` survives `getTools()`, which annotations are kept and which options `execute` receives. Test pages only. |
| `src/products.js` | none (filler) | A four-product in-memory catalogue so Listing 17.1 runs. Chapter 10 builds the real React store. |
| `src/check-input.js` | none (filler) | A small JSON Schema subset checker used by Listing 17.2 for inputs and by tests to check catalog results against `outputSchema`. It does not add native output validation to WebMCP. Use a full validator such as Ajv in production. |
| `src/main.js`, `tests/index.html` | none (filler) | A minimal test page that registers the catalog. |
| `dev/model-context-mock.js` | none | **Test-only** stand-in for `document.modelContext` (the same mock as chapter 16). The page never loads it. |
| `tests/run-tests.mjs` | none | The tests below. |

## Run the tests

```sh
cd chapters/17-the-road-ahead
npm install
npx playwright install chromium
npm run check         # node --check on every file in src/
npm test              # WebMCP from dev/model-context-mock.js
npm run test:chrome   # WebMCP from Chromium itself (--enable-features=WebMCPTesting)
# optional: CHAPTER_MD=/path/to/WebMCP_Ch17_The_Road_Ahead.md npm test   (adds the listing byte-check)
```

What the tests check:

- Every file in `src/` passes `node --check`.
- Listing 17.1 is plain data with a valid name, a description within Chrome's provisional 500-character budget and an `outputSchema`; `run()` returns results that validate against that schema for five inputs.
- The input checker rejects a missing `query`, an unknown category, a negative `maxPrice` and a non-object.
- Listings 17.1–17.3 are byte-identical to the chapter (when `CHAPTER_MD` is set).
- Without WebMCP, Listing 17.2 registers nothing and Listing 17.3 reports `documentModelContext: false` and `waitForToolsUntil: false`, with no page errors.
- On Chromium 156, `waitForToolsUntil` is absent and `waitForToolsUntil?.()` does not throw. A shim of the Chrome 160.0.8185.0 method receives the same promise `registerCatalog()` returns, still pending while `registerTool()` is in flight, and that promise rejects only after a failed batch has aborted. `InvalidStateError` and `NotAllowedError` thrown by that shim are caught, and the returned promise is still that batch. A `TypeError`, or a `DOMException` with any other name, propagates; the batch that already started still rolls back. The probe reports the shimmed method as present. The printed 2 November JSON predates the `waitForToolsUntil` field.
- With WebMCP, Listing 17.2 registers `search_products` with `readOnlyHint`; a valid call returns data matching `outputSchema`; an invalid call (no `query`, negative `maxPrice`) that the browser lets through is answered with Chapter 11's error shape, `{ status: 'error', code: 'INVALID_ARGUMENT', message }`, listing both problems in the message. Listing 17.1's schema requires `products`, so that error does not validate against the printed schema. `exposedTo` is passed only when given, and aborting the signal unregisters the catalog.
- Listing 17.2 rolls back the whole batch when one registration fails (a duplicate name).
- Listing 17.3 reports browser support and leaves no probe tool behind.

## Results (2 November 2026, Playwright 1.64.1, Chromium 156.0.8078.4)

14 of 14 checks passed with the mock and 14 of 14 with Chromium's own WebMCP (`--enable-features=WebMCPTesting`). The book's printed probe JSON is that run and does not include `waitForToolsUntil`. Re-run on 27 November 2026, same Playwright and Chromium, after Listing 17.2 and Listing 17.3 gained the method: 18 of 18 checks passed in both modes. The probe reported:

```json
{"documentModelContext":true,"legacyNavigatorModelContext":false,"getTools":true,"executeTool":true,"waitForToolsUntil":false,"resumeTool":false,"outputSchemaReflected":false,"annotationsKept":["consequentialHint","debugging","readOnlyHint","untrustedContentHint"],"executeOptions":["signal"]}
```

Observed in Chromium 156 at that time (not guaranteed by the draft of 15 October 2026):

- `outputSchema` is accepted by `registerTool()` and dropped from `getTools()`.
- An annotation the browser doesn't know (`sensitiveHint`) is dropped silently.
- `execute` receives only `signal` in its options; there is no `invocation` and no `resumeTool()` (continuation tokens are an explainer).
- The browser doesn't validate input against `inputSchema`.
- When the page's `registerTool` is replaced and then deleted, the prototype method is restored (used by the `exposedTo` test).

### OutputSchema follow-up (15 November 2026)

WebMCP PR #254 merged on 2 November and added optional `outputSchema` to `ModelContextTool` and `RegisteredTool`. The spec expects results to conform but does not require `executeTool()` itself to reject a mismatch; issue #92 remains open. This demo declares the schema printed in Listing 17.1 and checks successful catalog results against it. The adapter's input-error value is outside that schema, which is what the chapter says. Any agent harness consuming tool results still needs to validate them before model delivery and should give the model a clear error, not malformed data.

GitHub Actions ran `npm test` and `npm run test:chrome` successfully for this chapter on Chromium `159.0.8154.6` with WebMCP enabled. The probe reported `outputSchemaReflected: true` through `getTools()`. The requested build label `159.0.8140.0` was not the exact browser build used in that run. See the full matrix run: https://github.com/webmaxru/webmcp-book-demos/actions/runs/43772275737

Book 3.1.1 adds one check: a Chrome 160-shaped `waitForToolsUntil` that throws `InvalidStateError` or `NotAllowedError` is caught, `registerCatalog` still returns the batch promise, and that promise still rejects only after the batch aborts. A `TypeError` and an `OperationError` propagate, and the batch that already started still rolls back. Re-run on 27 November 2026 with Playwright 1.64.1 and Chromium 156.0.8078.4: 19 of 19 checks passed with the mock and 19 of 19 with Chromium's WebMCP. With `CHAPTER_MD` set, those runs also matched Listings 17.1–17.3 to the chapter.

When a later browser changes the observed behavior, the matching assertion in `npm run test:chrome` fails. That is the point: read the release notes and update `src/adapter.js`.
