# Appendix A: API quick reference — examples and probes

Companion folder for Appendix A of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (book repo: `appendices/a-api-reference/`).

| File | In the book |
|---|---|
| `webmcp.idl` | Listing A.1 — the specification's IDL index (Draft CG Report, 15 October 2026; unchanged from 14 October), unabridged |
| `classify-tool-error.js` | Listing A.2 — classifying an `executeTool()` rejection under both the draft and Chromium 156 |
| `tests/run-tests.mjs` | The probes behind Tables A.1–A.8: registration rules, `getTools()` shape, `executeTool()` results, events, Permissions Policy, cross-origin `exposedTo`/`fromOrigins`, exception names, and the declarative `<form toolname>` attributes |

`webmcp.idl` is the specification's text, not something you run. Listing A.2 is byte-identical to the book.

## Run the tests

```bash
npm install
npx playwright install chromium
npm test
```

The test starts two local origins (`http://localhost:8611` and `http://127.0.0.1:8612`; both count as secure contexts) inside the test process, launches Chromium with `--enable-features=WebMCPTesting`, runs the probes and asserts the values printed in the appendix. Nothing in this folder ships a mock: every WebMCP check runs against Chromium's real implementation.

## Result (15 October 2026, tech review)

25 of 25 checks pass in Chromium 156.0.8078.4 (Playwright 1.64) with `WebMCPTesting`.

The checks named "Chromium differs" pin today's differences from the draft (`UnknownError` where the draft says `NotFoundError`, `OperationError` or `AbortError`; `undefined` and `BigInt` results resolving where the draft rejects). One check pins a crash: registering a second tool with the same name from inside an `inputSchema`'s `toJSON()` (the case the draft's 15 October re-check, PR #347, covers) makes Chromium 156 kill the page's renderer (bad IPC message, reason 345; Chromium issue 573722078, marked Fixed but the fix was reverted and had not relanded as of 15 October 2026). When Chromium catches up with the draft, those checks will fail on purpose: update Table A.5 and Table A.7 in the book at the same time.
