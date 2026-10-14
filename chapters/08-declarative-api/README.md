# Chapter 8: The Declarative API: Forms as Tools

Runnable code for Chapter 8 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (working title).
Fjord Table's search and booking forms become WebMCP tools through HTML attributes (`toolname`,
`tooldescription`, `toolparamdescription`, `toolautosubmit`), with `SubmitEvent.agentInvoked` /
`respondWith()`, the `toolactivated` / `toolcancel` events and the `:tool-form-active` /
`:tool-submit-active` pseudo-classes.

> **Status (14 October 2026).** The declarative API was removed from the WebMCP specification on
> 8 October 2026 (webmachinelearning/webmcp PR #338). It still ships in Chrome's WebMCP implementation
> and Chrome still documents it. Everything here was tested against **Chromium 156.0.8078.4** with
> `--enable-features=WebMCPTesting` (the switch behind `chrome://flags/#enable-webmcp-testing`).
> In a browser without WebMCP the page is an ordinary booking page and the attributes do nothing.

## Run it

```sh
npx serve .          # then open http://localhost:3000/
```

To try the tools, use Chrome with `chrome://flags/#enable-webmcp-testing` enabled (localhost is a
secure context), then inspect them with `document.modelContext.getTools()` in DevTools or with
Chrome's Model Context Tool Inspector extension (Chapter 9). On a public origin you need a WebMCP
origin-trial token in the commented-out `<meta http-equiv="origin-trial">` tag in `index.html`.

## Files and listings

| File | Listing | Notes |
|---|---|---|
| `listings/listing-8-1-search-form-before.html` | 8.1 | The search form before (no tool attributes). Test: registers no tool. |
| `listings/listing-8-2-search-form-tool.html` | 8.2 | The search form as a tool. Appears byte-for-byte in `index.html` (checked by the tests). |
| `listings/listing-8-3-synthesized-schema.json` | 8.3 | The schema Chromium 156 synthesized for Listing 8.2, from `getTools()`. The tests compare it. |
| `listings/listing-8-4-book-form-tool.html` | 8.4 | The booking form as a tool (no `toolautosubmit`). Appears byte-for-byte in `index.html`. |
| `search-form.js` | 8.5 | One submit handler for people and agents; Monday rule via `setCustomValidity()`. |
| `book-form.js` | 8.6 | Booking on the guest's click; recoverable failures as values; reset only after the agent has its answer. |
| `results.html` | 8.7 | The no-script / navigation path: JSON-LD for the agent that navigated here. |
| `agent-feedback.js` | 8.8 | `toolactivated` / `toolcancel` banner. |
| `tool-styles.css` | 8.9 | `:tool-form-active` / `:tool-submit-active`, wrapped in `@supports selector(...)`. |
| `listings/listing-8-10-js-driven-form.html` | 8.10 | A form the declarative API can't drive (no submit button). Test: the call fails. |
| `index.html` | (page) | Contains Listings 8.2 and 8.4 verbatim, plus page markup. Not a listing. |
| `booking-ui.js` | (glue) | Not in the book: `showSlots()`, `showConfirmation()`, `showProblem()`, the status line and defaults. |
| `availability.js` | (glue) | Not in the book: the fake in-memory backend, copied from `fjord-table/availability.js`, **plus one addition**: `searchNow()`, a synchronous search that `results.html` uses so its JSON-LD is in the page before parsing ends (standing in for server rendering). `search()` now calls it after the simulated latency. |
| `styles.css` | (glue) | `fjord-table/styles.css` plus a few form-layout rules. |

Every listing in the chapter is byte-identical to the file above (the chapter Markdown was generated from these files).

## Tests

```sh
npm install
npx playwright install chromium
npm test
```

`tests/run-tests.mjs` serves this folder on localhost and runs:

1. Static checks: Listings 8.2 and 8.4 appear verbatim in `index.html`; every `.js` file passes `node --check`.
2. **Plain Chromium (no WebMCP):** the page loads with no errors; `'agentInvoked' in SubmitEvent.prototype` is false;
   a person can search, pick a slot and book; the Monday rule shows its message.
3. **Chromium with `--enable-features=WebMCPTesting`**, driving the forms the way a browser agent does, through the
   DevTools Protocol's experimental `WebMCP` domain (`WebMCP.invokeTool`, `WebMCP.cancelInvocation`,
   `WebMCP.toolResponded`), plus one in-page `executeTool()` call:
   - both forms are tools and the synthesized schema equals Listing 8.3; `search_availability` carries the `autosubmit` hint;
   - an agent search is answered by `respondWith()` and shown on the page (no navigation);
   - validation feedback reaches the agent: custom validity ("closed on Mondays"), `max`, an unknown enum value, an unknown parameter;
   - `book_table` waits for the person; nothing is booked until the click; the click completes the call with the reference; the form resets afterwards;
   - without `toolautosubmit`, the person's click on an invalid agent-filled form ends the call with the validation error, and the corrected re-submission is an ordinary one (`agentInvoked` false);
   - a full sitting comes back as `{ booked: false, ... }`;
   - agent cancellation fires `toolcancel` and clears `:tool-form-active`; a `reset()` cancels the call without `toolcancel`;
   - with `search-form.js` blocked, the form navigates to `results.html` and the agent receives its JSON-LD;
   - Listing 8.1 registers nothing; Listing 8.10 fails at call time ("No submit button was found ...").

There is deliberately **no `document.modelContext` mock** here: what this chapter documents is the browser's own
form-to-tool behaviour (schema synthesis, filling, submission), which a mock would only imitate.

Result on 14 October 2026, Chromium 156.0.8078.4 (Playwright 1.64): **17 passed, 0 failed.**

## Other observations behind the chapter (one-off probes, Chromium 156, 14 October 2026)

- Description order: `toolparamdescription`, then `<label>`, then `aria-description`; `placeholder` and `title` ignored.
- `type="date"` gets `"format": "date"` and a "(Dates MUST be provided in 'YYYY-MM-DD' format.)" suffix; `time`,
  `datetime-local` and `color` get a regular expression in `"format"`; `number`/`range` get `minimum`/`maximum`/`multipleOf`;
  a single checkbox is a boolean; same-name checkboxes and `<select multiple>` are arrays with `uniqueItems`;
  `minlength`/`maxlength` and the email/URL types are dropped; `disabled`, `readonly`, `hidden`, `file` and
  form-associated custom elements are left out; a control associated with `form="..."` is included.
- Registration: a bad `toolname` or a duplicate name is silently not registered; `tooldescription=""` stays registered;
  the tool's `title` is empty (an undocumented `tooltitle` attribute filled it); adding/removing tool forms fires `toolchange`.
- With `toolautosubmit`, `submit` fires before `toolactivated`; without it, `toolactivated` comes first.
- `toolactivated` fired even for a call then rejected for an invalid value (form not filled).
- `respondWith()`: throws `InvalidStateError` without a prior `preventDefault()` and on non-agent submissions; a rejected
  promise gives "respondWith promise was rejected"; `preventDefault()` without `respondWith()` gives a "programming error" message;
  a plain value works; `undefined` becomes `"undefined"`.
- JSON-LD after navigation: all blocks as an array, `[]` if none; blocks added after an `await`, a timer or `load` are missed.
- Removing the form during a call: "Tool execution cancelled, since tool definition was updated" (no `toolcancel`).
- In plain Chromium, `document.querySelector(':tool-form-active')` throws `SyntaxError`; `CSS.supports('selector(:tool-form-active)')` is false.
