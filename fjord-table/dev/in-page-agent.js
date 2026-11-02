// Listing 4.2 (Chapter 4): an in-page agent finds search_availability and calls it.
// Paste the lines below into the DevTools console on the running demo (top-level await works there),
// or load this file as a module. tests/run-tests.mjs runs the same lines against the mock and Chromium.
const tools  = await document.modelContext.getTools();
const search = tools.find((t) => t.name === 'search_availability');

const json = await document.modelContext.executeTool(search, {
  date: '2026-11-20', time: '19:00', partySize: 4
});
console.log(JSON.parse(json).slots);   // e.g. ["18:30", "19:00", "20:15"]
