# Chapter 10: WebMCP in Frameworks

Runnable code for chapter 10 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*.
Every listing in the chapter is a file here, byte-identical to the book (`node check-listings.mjs path/to/manuscript/10-webmcp-in-frameworks.md` verifies it).

- `trailhead-react/`: Trailhead, the outdoor-gear store, in React 19 + Vite + TypeScript, with WebMCP tools registered through `usewebmcp`.
- `angular/`: the chapter's Angular listings (app-wide tools, a route-scoped tool, a Signal Form as a tool), type-checked and run in Chromium.

## Listings

| Listing | File |
|---|---|
| 10.1 A minimal hook that ties a tool to a component | `trailhead-react/src/agent/use-agent-tool.ts` |
| 10.2 App-wide tools with `useWebMCP` | `trailhead-react/src/agent/AgentTools.tsx` |
| 10.3 `search_products` as a thin wrapper | `trailhead-react/src/agent/search-products.ts` |
| 10.4 One cart for the buttons and the tools | `trailhead-react/src/cart-store.ts` |
| 10.5 A view-scoped, consequential tool | `trailhead-react/src/pages/CartPage.tsx` |
| 10.6 One checkout path, with a commit point | `trailhead-react/src/checkout.ts` |
| 10.7 A confirmation that survives navigation | `trailhead-react/src/confirm-store.ts` |
| 10.8 Showing the person what the agent is doing | `trailhead-react/src/agent/AgentActivity.tsx` |
| 10.9 An app-wide tool in the application config | `angular/src/app.config.ts` |
| 10.10 A tool that lives with its route | `angular/src/routes.ts` |
| 10.11 A Signal Form that is also a tool | `angular/src/stock-alert.ts` |

## Files the book doesn't print

These complete the app minimally; the book describes them but doesn't list them.

- `trailhead-react/src/catalog.ts`: 12 products with NOK prices, `searchProducts()`, `getProduct()`, `compareProducts()`. Shared with the Angular code through `angular/src/catalog.ts`.
- `trailhead-react/src/agent/compare-products.ts`, `cart-tools.ts`: the `compare_products`, `add_to_cart` and `get_cart` wrappers, written like Listing 10.3.
- `trailhead-react/src/pages/ShopPage.tsx`, `ComparePage.tsx`, `src/components/ConfirmDialog.tsx`, `src/App.tsx` (routes and layout), `src/main.tsx` (StrictMode), `src/styles.css`.
- `trailhead-react/hook-demo.html` + `src/hook-demo.tsx`: a test page that exercises Listing 10.1 on its own.
- `trailhead-react/dev/model-context-mock.js`: a test-only stand-in for `document.modelContext`, copied from `fjord-table/dev/` and extended with the `toolcancel` event and Chromium's `TypeError` for a `null` `inputSchema`. The app never loads it.
- `angular/src/catalog.service.ts`, `cart.service.ts`, `stock-alert.service.ts`, `pages.ts`, `main.ts` (JIT bootstrap for the test build; it exposes two services on `window` for the tests).

## Run it

```bash
cd trailhead-react
npm install
npm run dev                  # http://localhost:5173, works as a normal store in any browser
npm run build && npm test    # Playwright, WebMCP from the mock
npm run build && npm run test:chrome   # Playwright, WebMCP from Chromium (--enable-features=WebMCPTesting)

cd ../angular
npm install
npm test                     # tsc + esbuild + Playwright with the mock
npm run test:chrome          # the same against Chromium's own WebMCP
```

To try the store with a real agent, open it in Chrome with `chrome://flags/#enable-webmcp-testing` enabled (see `fjord-table/README.md` and chapter 9).

## Test results

2 November 2026 (second edition): Playwright 1.64.1, Chromium 156.0.8078.4 (Chrome 156 is the Stable channel since 20 October 2026). Versions: React 19.3.1, React Router 8.4.0, usewebmcp 6.0.3, Vite 8.3.4, TypeScript 7.0.2, Angular 22.2.2.

| Suite | Mock | Chromium WebMCPTesting | Run |
|---|---|---|---|
| `trailhead-react` (12 tests) | 12 passed | 12 passed | 2 November 2026 |
| `angular` (5 tests, after `tsc` and an esbuild bundle) | 5 passed | 5 passed | 14 October 2026 (listings unchanged since) |

Changed in the second edition: `src/checkout.ts` refuses with `CART_CHANGED` when the cart changed while the person was confirming (Chrome's "stale workflow state" best practice), `src/pages/CartPage.tsx` describes that outcome, and `tests/run-tests.mjs` has a test for it.
