# Chapter 14 — Testing, Debugging and Evals

Runnable examples for Chapter 14 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*.
Every numbered listing in the chapter is here, byte-for-byte identical to the code printed in the book.

## Files and listings

| File | Listing | What it is |
|---|---|---|
| `trailhead-tools.js` | 14.1 | Trailhead's `search_products` and `add_to_cart`, built by a factory so tests can inject fakes |
| `tests/trailhead-tools.test.js` | 14.2 | Unit tests for the execute callbacks (`node:test`, no browser) |
| `webmcp-cdp.js` | 14.3 | A driver for the experimental `WebMCP` domain of the Chrome DevTools Protocol |
| `tests/fjord-table.cdp.test.js` | 14.4 | Fjord Table driven over the DevTools Protocol, with a human click in the site's dialog |
| `evals/fjord-table.evals.json` | 14.5 | A task suite in the `evals.json` format of Chrome's `webmcp-evals`, plus DOM `assertions` |
| `evals/matcher.js` | 14.6 | Argument matching with `webmcp-evals`' semantics (subset objects, strict arrays, `$` constraints) |
| `evals/run-evals.js` | 14.7 | The eval runner: agent → calls over CDP → trajectory score → page checks |
| `instrument-tool.js` | 14.8 | Real-user measurement: wrap `execute()` to report outcome and duration, never content |

Support code (not printed in the book):

| File | What it is |
|---|---|
| `tests/fixtures/fakes.js` | In-memory catalogue (prices in NOK), cart and recording UI for the Trailhead tests |
| `tests/fixtures/serve.js` | Tiny static server and a date with open tables in Fjord Table's fake backend |
| `tests/fixtures/scripted-agents.js` | Deterministic "careful" and "sloppy" agents used to test the eval harness |
| `tests/pages/trailhead.html` | Test page that registers instrumented Trailhead tools |
| `tests/rum.test.js` | Tests for Listing 14.8, with the dev mock and with Chromium's own WebMCP |
| `tests/evals.test.js` | Tests for Listings 14.5–14.7 against the live Fjord Table page |
| `evals/fjord-table-page.js` | Opens Fjord Table's booking view with the CDP driver attached and plays the person who confirms |
| `evals/chat-agent.js` | Agent adapter for any OpenAI-compatible Chat Completions endpoint |
| `evals/run.js` | Command line for running the suite with a scripted or real agent |
| `evals/results/` | Raw reports of the two real-model runs described in the chapter |
| `tests/run-all.js` | `npm test`: runs every check below |

The Fjord Table tests serve the app from `../../fjord-table/` in this repository (the demo from Chapters 4–5); nothing there is modified. The RUM test borrows `../../fjord-table/dev/model-context-mock.js` as its dev-only `document.modelContext` mock.

## Run the tests

```sh
cd chapters/14-testing-debugging-evals
npm install
npx playwright install chromium
npm test
```

`npm test` runs, in order: `node --check` on every JavaScript file; the unit tests; the RUM tests with the mock; the RUM tests with Chromium's own WebMCP; the Fjord Table protocol tests; and the eval-harness tests. The last three launch Chromium with `--enable-features=WebMCPTesting` (the switch behind `chrome://flags/#enable-webmcp-testing`). The protocol tests need a real Chromium: the DevTools Protocol's `WebMCP` domain has no mock.

Result on 14 October 2026 (Node 22.23, Playwright 1.64, Chromium 156.0.8078.4):

```
ok   node --check … (16 files)
ok   unit tests  (pass 4, fail 0)
ok   RUM, mock WebMCP  (pass 3, fail 0)
ok   RUM, Chromium WebMCP  (pass 4, fail 0)
ok   Fjord Table over CDP  (pass 3, fail 0)
ok   eval harness  (pass 5, fail 0)

all checks passed
```

## Run the evals against a real model

```sh
EVAL_BASE_URL=https://api.openai.com/v1 EVAL_API_KEY=… EVAL_MODEL=… \
  node evals/run.js --agent=chat --runs=5
```

`EVAL_EXTRA_BODY` (a JSON object) is merged into every request, e.g. `'{"reasoning_effort":"none"}'` for models whose Chat Completions endpoint refuses function tools with reasoning enabled.

`evals/results/` holds the two runs described in the chapter, both against `gpt-6-sol` on 14 October 2026, five runs per case:

- `2026-10-14-gpt-6-sol-first-run.txt`: the first version of the suite, with no `assertions` and the third case asking for 17:00. Cases 1–2 passed 5/5; case 3 failed 5/5 because no 17:00 table for five existed and the model (correctly) asked the user about 17:30 instead.
- `2026-10-14-gpt-6-sol-after-fix.txt`: the suite as printed (17:30, with DOM assertions): 15/15.

Five runs of three cases against one model is a smoke test, not a benchmark.

## Observed in Chromium 156 (14 October 2026)

- `WebMCP.toolsAdded` fires once per registration, with `frameId` and the registration's stack trace; `WebMCP.enable` replays it for tools already registered.
- `invokeTool` with an unknown tool name fails the command with `Tool not found`.
- A throwing tool → `toolResponded` with status `Error`, empty `errorText` and the page's exception.
- `cancelInvocation` → the tool's `signal` aborts, `toolcancel` fires on the page, status `Canceled`.
- Object results arrive in `toolResponded.output` as objects.
- The synchronous start of an `async execute` ran before the page's `toolactivated` listener (the draft fires the event first).
- `getTools()` returns all four annotations with defaults filled in (`debugging` included) when any annotation was given, and no `annotations` member otherwise.
