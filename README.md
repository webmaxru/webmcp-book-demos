# webmcp-book-demos

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22.22+](https://img.shields.io/badge/node-%E2%89%A522.22-339933.svg)](#requirements)

Runnable, tested code for every listing in the book *[Tools, Not Clicks: Building Agent-Ready Websites with WebMCP](https://webmcp.salnikov.no/)* by Maxim Salnikov.

The book is free to read online at **[webmcp.salnikov.no](https://webmcp.salnikov.no/)**, and its manuscript lives in [vibeprogrammer/webmcp-book](https://github.com/vibeprogrammer/webmcp-book). Each folder here belongs to one chapter or appendix. Every listing in the book is a file here, byte-identical to the printed code, and each folder has its own tests that run against Chromium's built-in WebMCP and against a `document.modelContext` mock.

## Table of contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [What's in each folder](#whats-in-each-folder)
- [Real Chromium or the mock](#real-chromium-or-the-mock)
- [Trying the demos in your own browser](#trying-the-demos-in-your-own-browser)
- [WebMCP status](#webmcp-status)
- [Issues and contributions](#issues-and-contributions)
- [License](#license)

## Requirements

- **Node.js 22.22 or later** (or 24.15+) and npm. The Angular folder needs this; the other folders run on Node.js 20 or later. Tested with Node.js 22.23 and npm 10.1.
- **Chromium 156**, the build that Playwright 1.64 installs (Chrome for Testing 156.0.8078.4). The tests start it themselves, with `--enable-features=WebMCPTesting` where they test the browser's own WebMCP.
- Git. No API keys are needed for the tests.

## Quick start

Each folder is a self-contained npm project; there is no root `package.json`. To run one, for example Fjord Table:

```bash
git clone https://github.com/vibeprogrammer/webmcp-book-demos.git
cd webmcp-book-demos/fjord-table
npm install
npx playwright install chromium   # once per machine: downloads Playwright's Chromium 156
npm test                          # WebMCP from the mock
npm run test:chrome               # WebMCP from Chromium itself
```

Every folder has `npm test`. In `chapters/10-webmcp-in-frameworks/trailhead-react/`, build the app first: `npm run build && npm test`.

To run every folder's tests in one go from the repository root:

```bash
for d in $(find . -name package.json -not -path '*/node_modules/*' -exec dirname {} \; | sort); do
  (cd "$d" && npm install && npm run build --if-present && npm test) || echo "FAILED: $d"
done
```

On 15 October 2026 all 18 folders installed and passed from a fresh clone (Node.js 22.23, Playwright 1.64.1, Chromium 156.0.8078.4), with `npm test` and, where it exists, `npm run test:chrome`.

## What's in each folder

The book follows three running projects: **Fjord Table**, a restaurant-booking site in Oslo; **Trailhead**, an outdoor-gear store; and **Supportly**, a helpdesk widget embedded across origins. Chapters 1 and 2 have no code.

| Folder | Chapter | What it is | Real Chromium in `npm test` |
|---|:---:|---|:---:|
| [`fjord-table/`](fjord-table/) | [4](https://webmcp.salnikov.no/04-enter-webmcp.html), [5](https://webmcp.salnikov.no/05-registering-tools.html) | Fjord Table, a restaurant-booking site in plain HTML and JS modules with the `search_availability` and `book_table` tools: feature detection, validation in code, a confirm step in the page's own UI, and registration scoped with `AbortController` | `npm run test:chrome` |
| [`chapters/03-mcp-in-practice/trailhead-mcp-server/`](chapters/03-mcp-in-practice/trailhead-mcp-server/) | [3](https://webmcp.salnikov.no/03-mcp-in-practice.html) | Trailhead's backend MCP server (Node.js and the official MCP TypeScript SDK v2) over stdio and Streamable HTTP | not needed |
| [`chapters/05-registering-tools/`](chapters/05-registering-tools/) | [5](https://webmcp.salnikov.no/05-registering-tools.html) | A Chromium probe that backs the chapter's statements about Chromium 156 (the chapter's listings live in `fjord-table/`) | ✓ |
| [`chapters/06-annotations-lifecycle-errors/`](chapters/06-annotations-lifecycle-errors/) | [6](https://webmcp.salnikov.no/06-annotations-lifecycle-errors.html) | Trailhead: annotations, the tool lifecycle, events and errors | ✓ |
| [`chapters/07-frames-origins-agents/`](chapters/07-frames-origins-agents/) | [7](https://webmcp.salnikov.no/07-frames-origins-agents.html) | The Supportly Helpdesk Widget: cross-origin frames, `allow="tools"` and page-embedded agents | ✓ |
| [`chapters/08-declarative-api/`](chapters/08-declarative-api/) | [8](https://webmcp.salnikov.no/08-declarative-api.html) | Fjord Table's forms as tools through HTML attributes (the declarative API) | ✓ |
| [`chapters/09-first-webmcp-app/`](chapters/09-first-webmcp-app/) | [9](https://webmcp.salnikov.no/09-first-webmcp-app.html) | Fjord Table end to end, as a progressive enhancement with an opt-in pinned polyfill and the Test Agent | ✓ |
| [`chapters/10-webmcp-in-frameworks/trailhead-react/`](chapters/10-webmcp-in-frameworks/trailhead-react/) | [10](https://webmcp.salnikov.no/10-webmcp-in-frameworks.html) | Trailhead in React 19, Vite and TypeScript, with tools registered through `usewebmcp` | `npm run test:chrome` |
| [`chapters/10-webmcp-in-frameworks/angular/`](chapters/10-webmcp-in-frameworks/angular/) | [10](https://webmcp.salnikov.no/10-webmcp-in-frameworks.html) | The chapter's Angular listings (Angular 22) | `npm run test:chrome` |
| [`chapters/11-designing-tools/`](chapters/11-designing-tools/) | [11](https://webmcp.salnikov.no/11-designing-tools.html) | Trailhead's catalogue and cart tools and the Supportly widget's tools, redesigned from the model's side | ✓ |
| [`chapters/12-threat-models/`](chapters/12-threat-models/) | [12](https://webmcp.salnikov.no/12-threat-models.html) | Result shaping, input guards, a tool-surface audit and a demonstration of the `registerTool()` wrapper attack | ✓ |
| [`chapters/13-privacy-consent-human-in-the-loop/`](chapters/13-privacy-consent-human-in-the-loop/) | [13](https://webmcp.salnikov.no/13-privacy-consent-human-in-the-loop.html) | Trailhead's checkout, built so that an order never completes without a person | ✓ |
| [`chapters/14-testing-debugging-evals/`](chapters/14-testing-debugging-evals/) | [14](https://webmcp.salnikov.no/14-testing-debugging-evals.html) | Tool tests over CDP, instrumentation, the Test Agent in Fjord Table and an eval harness | ✓ |
| [`chapters/15-browser-support-and-standards/`](chapters/15-browser-support-and-standards/) | [15](https://webmcp.salnikov.no/15-browser-support-and-standards.html) | Origin-trial tokens, `detectWebMCP()` feature detection and a standards-watch script | ✓ |
| [`chapters/16-product-and-business-implications/`](chapters/16-product-and-business-implications/) | [16](https://webmcp.salnikov.no/16-product-and-business-implications.html) | Trailhead's tool catalog, a CI check for Chrome's character budgets, measurement and order attribution | `npm run test:chrome` |
| [`chapters/17-the-road-ahead/`](chapters/17-the-road-ahead/) | [17](https://webmcp.salnikov.no/17-the-road-ahead.html) | Trailhead's tools as plain data, one adapter for the WebMCP API shape and a support probe | `npm run test:chrome` |
| [`appendices/a-api-reference/`](appendices/a-api-reference/) | [App. A](https://webmcp.salnikov.no/appendix-a-api-reference.html) | The WebMCP IDL, an error classifier and probes of Chromium's behaviour | ✓ |
| [`appendices/d-migration/`](appendices/d-migration/) | [App. D](https://webmcp.salnikov.no/appendix-d-migration.html) | Before and after: moving from `navigator.modelContext` and `provideContext()` to `document.modelContext` | ✓ |

Each folder's README maps every file to its listing number and says exactly what its tests check.

## Real Chromium or the mock

The tests use Playwright to drive Chromium 156 in two ways:

- **Real Chromium:** the browser is started with `--enable-features=WebMCPTesting`, so `document.modelContext` is Chromium's own implementation. This is what tells you the code works in a shipping browser.
- **The mock:** a small dev-only `document.modelContext` implementation is injected into the page. It follows the draft spec and lets the tests run in any Chromium, including where the browser's behaviour differs from the draft.

In most folders `npm test` runs both. Where the table says `npm run test:chrome`, `npm test` uses the mock and `npm run test:chrome` uses real Chromium. Chapter 3's MCP server runs in Node.js and needs no browser.

## Trying the demos in your own browser

1. Use Chrome 146 or later and turn on `chrome://flags/#enable-webmcp-testing`, then relaunch.
2. Serve a demo folder over `http://localhost` (for example `npx serve .` in `fjord-table/`). WebMCP only exists in secure contexts, and `file://` URLs won't load ES modules.
3. Inspect and call the page's tools in DevTools (Chapter 5) or with Chrome's [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) extension.

To use WebMCP on a real origin without flags, register for an origin trial and add the token to the page (Chapter 15 and [`chapters/15-browser-support-and-standards/`](chapters/15-browser-support-and-standards/) show how):

- **Chrome:** the [WebMCP origin trial](https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241) started in Chrome 149. It originally ran through Chrome 156 and on 28 September 2026 was extended through Chrome 162.
- **Microsoft Edge:** the [WebMCP origin trial](https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials/0b76fe60-b266-458e-a285-04e375c0c31a) runs from Edge 150 and expires on 30 March 2027.

## WebMCP status

WebMCP is a [Draft Community Group Report](https://webmachinelearning.github.io/webmcp/) of the W3C Web Machine Learning Community Group ([repository](https://github.com/webmachinelearning/webmcp)). It is not a W3C standard and is not on the standards track, and the API changes between drafts and browser releases. The code here follows the draft of 15 October 2026 and was re-tested on that date. Where Chromium 156 differs from the draft, the probes for Chapter 5 and Appendix A record it. [Appendix D](https://webmcp.salnikov.no/appendix-d-migration.html) covers the move from `navigator.modelContext` and `provideContext()` to `document.modelContext`.

## Issues and contributions

- If a demo fails, or a newer browser or draft breaks it, please [open an issue](https://github.com/vibeprogrammer/webmcp-book-demos/issues/new). Include the folder, your Node.js and browser versions, and the test output.
- Errors in the book text belong in the [book repository's issues](https://github.com/vibeprogrammer/webmcp-book/issues).
- Pull requests that fix a bug are welcome. The listings must stay byte-identical to the book, so a change to a listing file may also need a change in the book.

## License

The code in this repository is released under the [MIT License](LICENSE). The book's text is © 2026 Maxim Salnikov, all rights reserved; it is [free to read online](https://webmcp.salnikov.no/).
