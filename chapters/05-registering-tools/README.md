# Chapter 5 — Registering Tools: Chromium probe

Chapter 5's listings (Listings 5.1, 5.3–5.6) are part of the Fjord Table demo and live in [`../../fjord-table/`](../../fjord-table/), where `npm test` and `npm run test:chrome` check them against the mock and against Chromium's own WebMCP.

Listing 5.7 is `wait-for-tools.js` in this folder. `registerToolsWhenReady` passes one `Promise.allSettled()` batch to `document.modelContext.waitForToolsUntil?.()`, and aborts that batch if any registration rejects. A synchronous `InvalidStateError` or `NotAllowedError` from that call is caught, and the function still returns the batch promise. Any other exception is rethrown. `npm test` runs `tests/wait-for-tools.test.mjs` after the probe:

- On Chromium 156, `waitForToolsUntil` is absent. The optional call does not throw, and the tools still register.
- A page-local shim of the Chrome 160.0.8185.0 method receives that same promise while the `registerTool()` calls are still in flight. The promise settles only after they finish, and a rejection aborts the batch before it settles.
- That shim also throws `InvalidStateError` and `NotAllowedError`. Both are caught, the returned promise is the same batch, and the rejection still aborts it. A `TypeError`, or a `DOMException` with any other name, propagates. The batch has already started, so that rejection still aborts it.

Listing 5.2 is an IDL excerpt in the chapter, not a file here. The same `waitForToolsUntil` line is in Appendix A's `webmcp.idl`.

This folder also holds `tests/chromium-probe.mjs`. It backs every sentence in Chapter 5 that says what "Chromium 156" does where that differs from, or isn't settled by, the draft:

| What the chapter says | Observed |
|---|---|
| `outputSchema` is dropped silently | `registerTool()` resolves; the `RegisteredTool` from `getTools()` has no `outputSchema` |
| Input isn't validated against `inputSchema` | `{ partySize: 'forty', extra: true }` reaches `execute` unchanged |
| A tool without `inputSchema` registers | yes; its `RegisteredTool` has no `inputSchema` member; an absent `title` is `""` |
| No continuation tokens | the options object `execute` receives has only `signal` |
| Return values (Table 5.5) | objects → JSON; a string → the string itself, no quotes; `42` → `"42"`; `NaN` → `"NaN"`; `undefined` → `"undefined"` (a success) |
| Platform errors are spec lag | thrown error, `BigInt`, circular result, unregistered tool → `UnknownError` (the 15 Oct 2026 draft says `OperationError` / `NotFoundError`); caller abort → `AbortError` |
| Re-registering during schema serialization (PR #347) | the renderer crashed |
| `navigator.modelContext` | absent |

## Run it

```bash
npm install
npx playwright install chromium
npm run probe:chrome
```

It launches Chromium with `--enable-features=WebMCPTesting`, prints what it observed as JSON, and exits non-zero if any observation no longer matches the chapter, so a newer Chromium that changes behaviour gets noticed.

Result on 15 October 2026: Chromium 156.0.8078.4 (Playwright 1.64.1, headless), all observations match Chapter 5.
