# Chapter 13 · Privacy, Consent and the Human in the Loop

Runnable examples for Chapter 13 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*: Trailhead's checkout, built so that an order never completes without a person.
Every listing file below is byte-identical to the code printed in the chapter.

| File | Listing | What it is |
|---|---|---|
| `trailhead/confirm-sheet.js` | 13.1 | The page's own confirmation sheet: exact order, 800 ms arming delay, trusted clicks only, Back/Esc decline, abort-aware |
| `trailhead/checkout-tools.js` | 13.2 | `get_cart` (summaries, not secrets) and `checkout` (consequential; waits for the person; ends on sign-out) |
| `proposal/request-user-input.webidl` | 13.3 | The `requestUserInput()` IDL proposed in webmcp PR #204. Reference only: not in the spec, not implemented, nothing to run |
| `trailhead/session-tools.js` | 13.4 | Registers the tools only while someone is signed in |
| `trailhead/agent-presence.js` | 13.5 | Announces agent activity in a live region using `toolactivated` / `toolcancel` and localised tool titles |

Fill-in files (not printed in the book):

- `trailhead/store.js`: in-memory session, cart (a 3,499 NOK tent and two 1,899 NOK sleeping bags), account summaries and order service.
- `index.html`, `app.js`: a tiny page that wires the listings together.
- `dev/model-context-mock.js`: a single-document stand-in for `document.modelContext` used by one test in a browser without WebMCP. Dev and test only.

The listings are framework-neutral DOM modules; the React version of Trailhead is in Chapter 10's folder.

## Run it

```sh
npm install
npx playwright install chromium
npm test        # syntax + mock + real Chromium with --enable-features=WebMCPTesting
npm start       # serve the page; enable chrome://flags/#enable-webmcp-testing to see the tools
```

The test runner serves the page as `https://shop.trailhead.example` through Playwright request routing.

## What passed (15 October 2026, Chromium 156.0.8078.4, Playwright 1.64)

16 of 16 (re-run in the tech review, 15 October 2026):

- `node --check` on all 7 JavaScript files.
- Mock (plain Chromium): tools follow the session; declining returns a `cancelled_by_user` value; the presence banner announces the call.
- Real Chromium (WebMCPTesting):
  - No tools while signed out, `get_cart` (`readOnlyHint`) and `checkout` (`consequentialHint`) after sign-in, none after sign-out.
  - `get_cart` returns exactly `lines`, `total` (7,297 NOK), `shipTo: "Oslo 0150"` and `payWith: "Visa ending 4242"`.
  - `checkout` opens the sheet with focus on its heading; a scripted `click()` and a trusted click before the arming delay do nothing; after the delay, a Playwright click places order `TH-100200`. That Playwright click is `isTrusted: true`, which is the point of the chapter's section on issue #288.
  - Back and Esc both return `{ status: "cancelled_by_user", message }` (Chapter 11's convention) and place nothing.
  - Checkout with an empty cart returns `{ status: "error", code: "CART_EMPTY", message }` and opens no sheet.
  - The caller aborting closes the sheet, rejects with `AbortError` and the banner says the assistant stopped.
  - Signing out mid-checkout returns `{ status: "refused", code: "SESSION_ENDED", message }`.
  - A tool call does not give the page user activation (`isActive` and `hasBeenActive` both `false` inside `execute`). Note: Playwright's `evaluate()`/`waitForFunction()` count as user gestures, so this probe runs entirely from page script.
