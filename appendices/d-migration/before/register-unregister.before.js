// BEFORE (navigator.modelContext, February 2026). Does not run in current browsers.
// registerTool() returned nothing, and tools were removed by name.
navigator.modelContext.registerTool({
  name: 'search_availability',
  description: 'Find open tables at Fjord Table for a date, time and party size.',
  inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] },
  async execute({ date }) {
    return { date, slots: (await availability.search({ date })).map((s) => s.time) };
  }
});

// Any script on the page could do this, including to tools it didn't register.
navigator.modelContext.unregisterTool('search_availability');
