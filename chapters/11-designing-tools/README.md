# Chapter 11 examples: Designing Tools Agents Can Actually Use

Runnable code for Chapter 11 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP*.
Two projects: **Trailhead** (catalogue and cart tools redesigned) and the **Supportly Helpdesk Widget**
from Chapter 7 (its three tools rewritten from the model's side).

## Files and listings

Every listing file is byte-identical to the code printed in the chapter (`npm run check-listings` verifies it).

| File | Listing | What it is |
|---|---|---|
| `shared/tool-lint.js` | 11.1 | `measureTools()` and `lintTool()`: character counts and lint rules for `getTools()` output |
| `helpdesk/copy.js` | 11.2 | One source for the widget's words: titles, priority `{ const, title }` pairs, limits |
| `shared/validate.js` | 11.3 | `checkArgs()`: validates arguments against the published schema, errors reuse parameter descriptions |
| `trailhead/catalog-tools.js` | 11.4 | `search_products` (with truncation note) and `compare_products` |
| `shared/results.js` | 11.5 | `fail()`, `refuse()`, `needsInput()`, `cancelledByUser()` |
| `trailhead/cart-tools.js` | 11.6 | `add_to_cart` with `needs_input` (shoe size) and `refused` (purchase limit, out of stock) |
| `helpdesk/widget-form.js` | 11.7 | The person's ticket form built from the same copy, and `confirmTicket()` |
| `helpdesk/widget-tools.js` | 11.8 | The widget's `search_articles`, `create_ticket`, `get_ticket_status`, redesigned |

Files not printed in the book (filling the gaps):

- `trailhead/store.js` – in-memory catalogue (prices in NOK) and cart; `trailhead/main.js`, `trailhead/index.html` – demo page.
- `helpdesk/helpdesk-api.js` – in-memory Supportly backend (articles, tickets, a 3-per-hour ticket limit); `helpdesk/main.js`, `helpdesk/index.html` – demo page. The widget runs on a single origin here; the Chapter 7 folder runs it cross-origin inside Ledgerly.
- `tests/fixtures/before.js` – the agent-facing metadata of the earlier tool versions (Listings 6.2, 6.7, 7.3), used for Table 11.2 and Figure 11.3.
- `tests/mock-model-context.js` – the DEV-ONLY `document.modelContext` mock from Chapter 6. Never loaded by the demo pages; the tests inject it.

## Running

```sh
npm install
npx playwright install chromium
npm test                 # syntax + unit + mock + Chromium (WebMCPTesting)
npm run check-listings   # compares the listings in the chapter Markdown with these files
```

`npm test` starts a static server on a random `127.0.0.1` port, runs the Trailhead and widget scenarios against the mock and then in Chromium launched with `--enable-features=WebMCPTesting`, and writes `tests/results/observations.json` (measurements, lint results and example results).

## Results (14 October 2026)

99/99 checks passed: 16 syntax checks, 10 unit tests (validator, lint, result helpers), 36 behavioural checks against the mock and the same 36 in Chromium 156.0.8078.4 (Playwright 1.64), plus one check that WebMCP is available in Chromium. 8/8 listings match the chapter.

Observed in Chromium 156 with WebMCPTesting:

- `getTools()` returns `inputSchema` with `oneOf` lists of `{ const, title }` and array keywords (`minItems`, `maxItems`, `uniqueItems`) unchanged.
- All six redesigned tools pass the lint (Chrome's character budgets, described parameters, no steering words or empty/numeric enums). The earlier versions had undescribed parameters (Table 11.2).
- Characters per definition (name + description + inputSchema): Trailhead 1,798 for three tools; widget 1,850 (was 955 in Chapter 7). A broad `search_products` result: 1,312 characters, 10 of 16 products with a narrowing note.
- Tool-level outcomes come back as JSON results with `status` `error`, `needs_input`, `refused` or `cancelled_by_user`; the widget's form labels, options and `maxlength` match the tool's title and schema.
