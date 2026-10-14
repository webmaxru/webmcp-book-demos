# Chapter 15: Browser Support and the Standards Road

Examples for Chapter 15 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*.

| File | Listing | What it is |
|---|---|---|
| `origin-trial-head.html` | 15.1 | Meta tags carrying a Chrome and an Edge origin-trial token (placeholders) |
| `origin-trial.headers.txt` | 15.1 (header form) | The same tokens as `Origin-Trial` response headers |
| `webmcp-support.js` | 15.2 | `detectWebMCP()` and `registerIfSupported()`: feature detection across WebMCP builds |
| `standards-watch.mjs` | 15.3 | Snapshots seven primary sources (spec, commits, chromestatus, Edge trial, Mozilla, WebKit, TAG) and reports changes |
| `snapshots/2026-10-14.json` | 15.4 | The watcher's real output on 14 October 2026 |

Every listing in the chapter is byte-identical to its file here (apart from the final newline); `tests/check-listings.test.js` checks this when `CHAPTER_MD` points at the chapter Markdown.

## Run

```bash
npm install
npx playwright install chromium
npm test                 # all tests
npm run watch            # live standards snapshot -> snapshots/last.json (exit code 2 when something changed)
```

## Tests (all passed on 14 October 2026, Node 22, Playwright 1.64.1, Chromium 156.0.8078.4)

- `tests/webmcp-support.test.js` (Playwright, real Chromium, local HTTP server on localhost):
  - with `--enable-features=WebMCPTesting`: all three methods and three events detected, `policyAllows: true`, the Trailhead `search_products` tool registers and appears in `getTools()`;
  - same flag plus `Permissions-Policy: tools=()`: API present, `policyAllows: false`, nothing registered (a direct `registerTool()` call is rejected with `NotAllowedError`: "Access to the feature \"tools\" is disallowed by permissions policy.");
  - without the flag: `document.modelContext` absent, `policyAllows: null`, page works, nothing registered;
  - a dev-only mock of a pre-May-2026 build (`navigator.modelContext`): reported as `legacyNavigator: true`, not used.
- `tests/standards-watch.test.js`: the parsers against fragments cut from the real pages fetched on 14 October 2026 (`tests/fixtures/`), including a removed TAG label that must not count as current.
- `tests/check-listings.test.js`: listings vs. files.

Result: 11 of 11 tests pass. `standards-watch.mjs` was also run live against all seven sources; its output is `snapshots/2026-10-14.json`.

The origin-trial tokens in Listing 15.1 are placeholders. A real token can't be tested here, because tokens are issued per registered origin.
