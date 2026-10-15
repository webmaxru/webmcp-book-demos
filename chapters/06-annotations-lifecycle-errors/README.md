# Chapter 6 — Annotations, Lifecycle and Errors (Trailhead)

Runnable examples for Chapter 6 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (working title).
Every listing in the chapter is a file here, byte-identical to the code printed in the book.

## Files and listings

| File | Book | What it shows |
|---|---|---|
| — | Listing 6.1 | `ToolAnnotations` IDL excerpt from the 15 October 2026 draft (WebIDL, not runnable; not in this folder) |
| `trailhead/product-tools.js` | Listing 6.2 | `search_products` (`readOnlyHint`) and `get_product_reviews` (`readOnlyHint` + `untrustedContentHint`) |
| `trailhead/checkout-tool.js` | Listing 6.3 | `checkout` (`consequentialHint`), confirmed in the page's own dialog, signal checked before the order |
| `trailhead/debug-tools.js` | Listing 6.4 | `debug_dump_cart_state` (`debugging: true`), registered in development builds only |
| `trailhead/tool-lifecycle.js` | Listing 6.5 | `toolactivated` / `toolcancel` observers and the `tracked()` wrapper |
| `trailhead/compare-tool.js` | Listing 6.6 | `compare_products`: cancellation plus a page-owned deadline (`AbortSignal.any`, `AbortSignal.timeout`), partial results |
| `trailhead/cart-tools.js` | Listing 6.7 | `add_to_cart` and `get_cart`: tool-level errors as values with stable codes (`status: 'error'` to fix, `status: 'refused'` for out of stock) |
| `trailhead/tool-sync.js` | Listing 6.8 | Registering `checkout` only while the cart is non-empty; counting `toolchange` |

Support files (not printed in the book, added so the listings run):

- `trailhead/index.html` — a minimal Trailhead page (product list, cart, confirmation `<dialog>`, agent banner, activity log).
- `trailhead/app.js` — wiring: the page for people, then the agent layer as a progressive enhancement (`'modelContext' in document`). `?debug` stands in for a development build and registers the debugging tool.
- `trailhead/store.js` — fake in-memory backend (catalogue, reviews, stock, cart, orders). Every async method takes an `AbortSignal`. Exposes `window.__trailheadLatency` so tests can slow parts of it down.
- `trailhead/ui.js` — DOM helpers: product list, cart, `confirmCheckout()` (closes the dialog when the call's signal aborts), agent banner, activity log.
- `tests/mock-model-context.js` — **dev-only** mock of `document.modelContext` that follows the draft (never loaded by the app).
- `tests/run-tests.mjs` — the test runner. `tests/probe.html` — blank page used by the platform probe.

`get_product_reviews` and `debug_dump_cart_state` are introduced in this chapter; the other five tools are Trailhead's standard tools.
Fake data includes a review containing a prompt-injection sentence on purpose (see the chapter's untrustedContentHint section).

## Run it

```bash
npx serve .            # then open http://localhost:3000/trailhead/  (any static server works; localhost is a secure context)
```

To expose the tools, use Chrome/Chromium with `chrome://flags/#enable-webmcp-testing` enabled (or launch with `--enable-features=WebMCPTesting`), or a page with a valid WebMCP origin-trial token.

## Tests

```bash
npm install
npx playwright install chromium
npm test
```

The runner:

1. `node --check` on every JavaScript file.
2. Runs 31 behaviour scenarios against the **dev-only mock** (Playwright Chromium, no flag).
3. Runs the **same 31 scenarios against Chromium's real WebMCP implementation** (`--enable-features=WebMCPTesting`), playing the agent with `getTools()` / `executeTool()`.
4. Runs a **platform probe** that records how Chromium reports lifecycle events, cancellation and errors, and writes it to `tests/results/chromium-observations.json`.

Result on 15 October 2026 (tech review, after aligning result shapes with Chapter 11), Chromium 156.0.8078.4 (Playwright 1.64): **73 passed, 0 failed** (10 syntax + 31 mock + 1 availability + 31 Chromium). See `tests/results/summary.json`.

### What Chromium 156.0.8078.4 did (probe output, 14 October 2026)

| Probe | Observed | 14 Oct 2026 draft says |
|---|---|---|
| Order of `execute` vs `toolactivated` | execute called → toolactivated event | event first, then `execute` (issue #332 proposes changing the spec) |
| Caller aborts a running call | caller: rejected AbortError; tool: tool signal aborted (AbortError); tool kept running and settled; events: toolactivated:slow, toolcancel:slow | same |
| Call with an already-aborted signal | rejected AbortError; tool never ran | same |
| Unregister while a call is running | resolved "{\"aborted\":false}" | in-flight call not cancelled |
| Call a tool that was unregistered | rejected UnknownError | `NotFoundError` |
| `execute` throws | rejected UnknownError | `OperationError` |
| `execute` returns `undefined` | resolved "undefined" | `OperationError` |
| Result contains a BigInt | rejected UnknownError | `OperationError` |
| Input is not an object (`"text"`) | rejected TypeError (thrown by `executeTool()`) | `DataError` |
| Input is an array | resolved "[1,2]" | arrays are objects: allowed |
| Two concurrent calls | start 1, start 2, end 1, end 2 | not specified (issue #47) |
| `toolchange` counts | register 3 tools → 3 events; abort their shared signal → 3 events | one per change |
| `annotations` omitted at registration | `getTools()` → undefined | — |
| Target document navigates during a call | rejected UnknownError | `AbortError`; Chrome docs say `null` |
| Tool navigates but returns first | resolved "navigating" | — |
| Caller document unloads during a call | target saw: toolactivated:top_slow, toolcancel:top_slow; tool signal: aborted | call cancelled, `toolcancel` fires |

Fill-ins beyond the book: `store.js`, `ui.js`, `app.js` and `index.html` are support code written for this demo; the listings themselves are unchanged.

## Result convention (tech review, 15 October 2026)

Every tool here returns Chapter 11's result statuses: `{ status: 'error', code, message }` for something the agent can fix (`INVALID_INPUT`, `INVALID_QUANTITY`, `UNKNOWN_SKU`, `EMPTY_CART`, `DETAILS_UNAVAILABLE`), `{ status: 'refused', code: 'OUT_OF_STOCK', message, available }` when a rule says no, `{ status: 'cancelled_by_user', message }` when the person cancels checkout, and a domain word (`added`, `placed`, `complete`, `partial`) on success.

Chromium's `UnknownError` in the table above is spec lag: the draft used `UnknownError` for these failures until 8 October 2026 (commit b206dae, PR #339), and Chromium 156 still implements that text.
