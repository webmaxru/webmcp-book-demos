# Appendix A: API quick reference — examples and probes

Companion folder for Appendix A of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (book repo: `appendices/a-api-reference/`).

| File | In the book |
|---|---|
| `webmcp.idl` | Listing A.1 — the specification's IDL index (Draft CG Report, 27 October 2026, identical to the 15 and 14 October drafts), unabridged |
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

## Result (2 November 2026, second edition)

25 of 25 checks pass in Chromium 156.0.8078.4 (Chrome for Testing, Playwright 1.64.1) with `WebMCPTesting`, re-run on 2 November 2026 against the spec draft of 27 October 2026, whose IDL is identical to the 15 October draft the first edition used. Chrome 156 is the stable channel since 20 October 2026; newer builds (157 stable on 3 November 2026, 158 beta) were not available in the test setup.

The checks named "Chromium differs" pin today's differences from the draft (`UnknownError` where the draft says `NotFoundError`, `OperationError` or `AbortError`; plain strings not JSON-quoted; `undefined` and `BigInt` results resolving where the draft rejects). Spec issue #361 (opened 23 October 2026) confirms the string and `undefined` difference in Chrome 156.0.8078.48 and 158.0.8119.0, and on 26 October the spec editor said the spec is right about strings and proposed mapping `undefined` to `"null"`. One check pins a crash: registering a second tool with the same name from inside an `inputSchema`'s `toJSON()` (the case the draft covers since PR #347, merged 15 October 2026) makes Chromium 156 kill the page's renderer (bad IPC message, reason 345; Chromium issue 573722078, marked Fixed but the fix was reverted and had not relanded as of 15 October 2026; still reproducible in 156.0.8078.4 on 2 November 2026). When Chromium catches up with the draft, those checks will fail on purpose: update Table A.5 and Table A.7 in the book at the same time.
