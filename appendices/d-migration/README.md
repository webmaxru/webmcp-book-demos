# Appendix D: migration notes — examples and tests

Companion folder for Appendix D of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (book repo: `appendices/d-migration/`): moving from `navigator.modelContext` and `provideContext()` to `document.modelContext`.

| File | In the book |
|---|---|
| `before/fjord-tools.before.js` | Listing D.1 — Fjord Table's tools with `provideContext()` / `clearContext()` and `client.requestUserInteraction()` (early-2026 shape) |
| `before/register-unregister.before.js` | Listing D.2 — `registerTool()` / `unregisterTool(name)` on `navigator.modelContext` |
| `after/fjord-tools.js` | Listing D.3 — the same tools on `document.modelContext` with an `AbortController` per view |
| `after/tool-set.js` | Listing D.4 — a view-scoped tool set that replaces `provideContext()`'s "swap the tools" pattern |
| `after/detect.js` | Listing D.5 — feature detection that spots the legacy namespace |
| `tests/run-tests.mjs` | The checks described below |
| `tests/fixtures/*.html` | Test pages with a fake Fjord Table back end (`availability`, `bookings`, `confirmBooking`) — test-only |
| `tests/legacy-mock.js` | DEV-ONLY stand-in for the early-2026 `navigator.modelContext` shape, so the "before" listings can be exercised; loaded only with `?mock` |

All five listings are byte-identical to the book. The "before" files are deliberately the old API: they don't work in current browsers, which is the point.

## Run the tests

```bash
npm install
npx playwright install chromium
npm test
```

The test serves this folder on `http://localhost:<random port>` (a secure context) and launches Chromium with `--enable-features=WebMCPTesting`.

1. `node --check` on all five listings.
2. The "after" code (D.3–D.5) against Chromium's real WebMCP: both tools register with their annotations, `executeTool()` runs `search_availability`, `book_table` goes through the page's confirmation (yes and no), `view.abort()` unregisters both and fires `toolchange`, the tool set swaps only its own tools and rejects duplicate names, and `webmcpStatus()` says `'current'`.
3. The "before" code in Chromium 156: `navigator.modelContext` doesn't exist, so Listing D.1's guard registers nothing and Listing D.2 throws `TypeError`.
4. The "before" code against the dev-only mock of the old shape: `provideContext()` sets both tools, `book_table` calls `requestUserInteraction()`, `clearContext()` wipes them, and `unregisterTool(name)` removes by name.

## Result (14 October 2026)

20 of 20 checks pass in Chromium 156.0.8078.4 (Playwright 1.64) with `WebMCPTesting`.
