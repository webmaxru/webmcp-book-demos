# Chapter 17: The Road Ahead

Runnable examples for chapter 17 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*. They belong to **Trailhead**, the book's fictional Norwegian outdoor-gear store, and show how to build so that today's tools survive tomorrow's API: tools as plain data, one adapter that knows the WebMCP API shape, and a probe that reports what a browser actually supports.

Every file under `src/` that maps to a listing is byte-identical to the code printed in the chapter (the tests check this when `CHAPTER_MD` points at the chapter's Markdown).

## Files and listings

| File | Book | Notes |
|---|---|---|
| `src/catalog.js` | Listing 17.1 | `search_products` as plain data plus a `run()` function, with an `outputSchema` the draft doesn't have yet (issue #9, PR #254). |
| `src/adapter.js` | Listing 17.2 | `registerCatalog()`: feature detection, input validation, `outputSchema` and `exposedTo` passed through, one `AbortSignal` for the whole catalog. |
| `src/probe.js` | Listing 17.3 | `probeWebMCP()`: reports `document.modelContext`, the legacy `navigator.modelContext`, `resumeTool()`, whether `outputSchema` survives `getTools()`, which annotations are kept and which options `execute` receives. Test pages only. |
| `src/products.js` | none (filler) | A four-product in-memory catalogue so Listing 17.1 runs. Chapter 10 builds the real React store. |
| `src/check-input.js` | none (filler) | A small JSON Schema subset checker used by Listing 17.2 and by the tests (also to check results against `outputSchema`). Use a full validator such as Ajv in production. |
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
- Listing 17.1 is plain data with a valid name, a description within Chrome's provisional 500-character budget and an `outputSchema`; `run()` returns results that validate against that `outputSchema` for five inputs.
- The input checker rejects a missing `query`, an unknown category, a negative `maxPrice` and a non-object.
- Listings 17.1–17.3 are byte-identical to the chapter (when `CHAPTER_MD` is set).
- Without WebMCP, Listing 17.2 registers nothing and Listing 17.3 reports `documentModelContext: false`, with no page errors.
- With WebMCP, Listing 17.2 registers `search_products` with `readOnlyHint`; a valid call returns data matching `outputSchema`; an invalid call (no `query`, negative `maxPrice`) that the browser lets through is answered with Chapter 11's error shape, `{ status: 'error', code: 'INVALID_ARGUMENT', message }`, listing both problems in the message; `exposedTo` is passed only when given; aborting the signal unregisters the catalog.
- Listing 17.2 rolls back the whole batch when one registration fails (a duplicate name).
- Listing 17.3 reports the browser's support and leaves no probe tool behind.

## Results (2 November 2026, Playwright 1.64.1, Chromium 156.0.8078.4)

14 of 14 checks pass with the mock and 14 of 14 with Chromium's own WebMCP (`--enable-features=WebMCPTesting`). The probe reported, in Chromium 156:

```json
{"documentModelContext":true,"legacyNavigatorModelContext":false,"getTools":true,"executeTool":true,"resumeTool":false,"outputSchemaReflected":false,"annotationsKept":["consequentialHint","debugging","readOnlyHint","untrustedContentHint"],"executeOptions":["signal"]}
```

Observed in Chromium 156 (not guaranteed by the draft of 15 October 2026):

- `outputSchema` is accepted by `registerTool()` and silently dropped; `getTools()` doesn't return it.
- An annotation the browser doesn't know (`sensitiveHint`) is dropped silently.
- `execute` receives only `signal` in its options; there is no `invocation` and no `resumeTool()` (continuation tokens are an explainer).
- The browser doesn't validate input against `inputSchema`.
- When the page's `registerTool` is replaced and then deleted, the prototype method is restored (used by the `exposedTo` test).

When a later browser changes any of these, the matching assertion in `npm run test:chrome` fails. That is the point: read the release notes and update `src/adapter.js`.
