# Chapter 3: MCP in Practice — Trailhead's backend MCP server

Runnable code for Chapter 3 of *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (working title).
It is the companion backend MCP server for the Trailhead outdoor-gear store: Node.js plus version 2 of the
official MCP TypeScript SDK, exposing `search_products` and `get_order_status`, a returns-policy resource and a
packing-list prompt, served over stdio and Streamable HTTP. It speaks MCP revision 2026-07-28 ("modern") and
still answers 2025-era ("legacy") clients that open with `initialize`.

## Run it

```sh
cd chapters/03-mcp-in-practice/trailhead-mcp-server
npm install
npm run ask          # Listing 3.8: an SDK client asks "a 2-person tent under 4000 NOK, in stock?"
npm start            # the stdio server (for a host such as an IDE or desktop assistant)
npm run start:http   # Streamable HTTP on http://127.0.0.1:3000/mcp  (PORT=... to change)
npm run inspect      # the MCP Inspector web UI against the stdio server
npm test             # the test suite (see below)
```

Node.js 20 or later. Pinned versions (all checked on npm on 15 Oct 2026): `@modelcontextprotocol/server` 2.3.1,
`@modelcontextprotocol/client` 2.3.1, `@modelcontextprotocol/node` 2.1.1, `zod` 4.6.7,
`@modelcontextprotocol/inspector` 2.11.0 (dev only).

## Files and the listings they match

Every numbered listing in the chapter is byte-identical to its file here (apart from the file's final newline).
`node tests/check-listings.mjs <path to WebMCP_Ch03_MCP_in_Practice.md>` verifies that.

| Listing | File | What it is |
|---|---|---|
| 3.1 | `wire/listing-3-1.txt` | A real `server/discover` request and response, captured over stdio |
| 3.2 | `src/catalog.js` | In-memory stand-in for Trailhead's product and order services |
| 3.3 | `src/tools.js` | `search_products` and `get_order_status`, with Zod schemas and annotations |
| 3.4 | `src/context.js` | The `trailhead://policies/returns` resource and the `packing_list` prompt |
| 3.5 | `src/server.js` | The server factory |
| 3.6 | `src/stdio.js` | stdio entry point (`serveStdio`) |
| 3.7 | `src/http.js` | Streamable HTTP entry point (`createMcpHandler` + Host/Origin guards) |
| 3.8 | `src/client.js` | Minimal SDK client with `versionNegotiation: { mode: 'auto' }` |
| 3.9 | `wire/listing-3-9.txt` | A real `tools/call` request and response, captured over stdio |
| 3.10 | `scripts/inspect.sh` | MCP Inspector CLI commands |

Not listings (support files): `package.json`, `tests/trailhead.test.mjs` (the suite), `tests/wire-tap.mjs`
(a dev-only stdio proxy that logs every JSON-RPC line), `tests/capture-wire.mjs` (re-captures the exchange behind
Listings 3.1 and 3.9), `tests/check-listings.mjs`. The two unnumbered blocks in the chapter (the `npm install` line
and the output of `npm run ask`) come from `package.json` and from running Listing 3.8.

Nothing in the chapter code is a fragment, so nothing had to be filled in. The wire listings are pretty-printed
with the keys in JSON-RPC order (`jsonrpc`, `id`, `method`/`result`); the test compares them to the live wire after
parsing, so key order and whitespace don't matter.

## Tests

`npm run check` runs `node --check` on every source file and `bash -n` on the Inspector script.
`npm test` runs 11 tests with Node's built-in test runner (about 4 seconds, no network):

1. Modern era over the HTTP handler in process (`handler.fetch`): era is `modern`, tools listed, annotations and schemas advertised.
2. `search_products`: keyword + price + stock filter, category filter, empty result; `structuredContent` equals the JSON text block.
3. Schema violations (`category: 'kayaks'`, `orderId: '12345'`) return `isError: true` with "Input validation error", without running the handler.
4. `get_order_status`: a found order (its state is in `orderState`; `status` is reserved for outcomes, as in Chapter 11), and a missing one returned as a recoverable `isError` result.
5. The resource and the prompt.
6. Legacy era (`initialize` handshake) over HTTP.
7. The stdio entry point as a real child process, in `auto` (modern) and `legacy` modes.
8. Listing 3.8 (`src/client.js`) run end to end.
9. Listings 3.1 and 3.9 re-captured from the live stdio pipe and compared with the files.
10. Listing 3.7 on a real port: modern client works; a POST without `Mcp-Method` gets HTTP 400; with it, 200; `Host: evil.example` gets HTTP 403 (DNS-rebinding guard).
11. Listing 3.10: the Inspector CLI lists the tools and calls `search_products`.

Result on 15 Oct 2026, re-run from a fresh clone during the tech review (Node.js 22.23.2, Linux): **11 passed, 0 failed**; `npm run check` clean; `check:listings` 10 of 10 identical.

## Observations worth knowing

- The SDK speaks the 2025 handshake unless you opt in. `serveStdio()` and `createMcpHandler()` serve both eras;
  clients need `versionNegotiation: { mode: 'auto' }` (or a pin) to use 2026-07-28.
- MCP Inspector CLI 2.11.0 opens with a 2025-11-25 `initialize`, so it exercises the server's legacy path.
- On Streamable HTTP (2026-07-28), a request without the `Mcp-Method` header is rejected with HTTP 400 even when
  `MCP-Protocol-Version` is present.
- No WebMCP / browser code in this chapter, so there is no Chromium test here; Trailhead's WebMCP tools arrive in later chapters.
