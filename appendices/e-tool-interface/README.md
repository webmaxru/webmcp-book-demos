# Appendix E: from RegisteredTool to Tool

Companion folder for Appendix E of *Tools, Not Clicks*. Listing E.1 is `read-tool.js`, byte-identical to the book.

| File | In the book |
|---|---|
| `read-tool.js` | Listing E.1 — copy `Tool` fields, with `source ?? window` until Chrome 160 is stable |
| `tests/run-tests.mjs` | Not printed. Checks the listing on Chromium 156 and against a Chrome 160-shaped shim |

Appendix F's listing is an excerpt of unmerged pull request #375. It is not a file in this repository.

## Run the tests

```bash
npm install
npx playwright install chromium
npm test
```

Playwright is pinned to 1.64.1 so the browser is Chromium 156.0.8078.4, which still returns `RegisteredTool` dictionaries (`window`, absent schemas). The second check replaces `getTools()` with interface-like objects: `source` instead of `window`, `null` schemas, no own enumerable fields. `JSON.stringify` of those objects is `"{}"` and object spread copies nothing. `readTools()` still returns the fields, because it reads the getters by name.

Chromium 156 was the browser under test. Chrome 160.0.8173.0 was not launched.
