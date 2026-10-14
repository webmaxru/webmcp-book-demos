# webmcp-book-demos

Runnable demos for *Tools, Not Clicks: Building Agent-Ready Websites with WebMCP* (working title). The manuscript lives in [vibeprogrammer/webmcp-book](https://github.com/vibeprogrammer/webmcp-book).

| Demo | What it shows | Chapters |
|---|---|---|
| [`fjord-table/`](fjord-table/) | A restaurant-booking site with the `search_availability` and `book_table` WebMCP tools: feature detection, validation in code, a confirm step in the site's own UI, recoverable failures as values, and view-scoped registration with `AbortController` | 4, 5 |

More demos will follow the outline: Trailhead (an outdoor-gear store in React), the Helpdesk Widget (cross-origin frames), and a test agent.

Each demo is static and needs no build step. Serve its folder (`npx serve .`) and open it on `localhost`. To see the WebMCP tools, use Chrome with `chrome://flags/#enable-webmcp-testing` enabled, or an origin-trial token. Each demo's README has the details.

WebMCP is a W3C Community Group draft, not a standard, and it changes between Chrome releases. The code here follows the 13 October 2026 draft and was tested on 14 October 2026.

## License

[MIT](LICENSE)
