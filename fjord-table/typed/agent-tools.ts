// Listing 5.6 (Chapter 5): search_availability in TypeScript with webmcp-types.
// Unchanged from the book. Type-checked only (npm run typecheck); the running demo uses the .js files.
/// <reference types="webmcp-types" />

const searchSchema = {
  type: 'object',
  properties: {
    date:      { type: 'string', description: 'Visit date, YYYY-MM-DD' },
    time:      { type: 'string', description: 'Preferred time, 24h HH:MM' },
    partySize: { type: 'integer', minimum: 1, maximum: 12 },
  },
  required: ['date', 'partySize'],
} as const;   // keep literal types so the input can be inferred

await document.modelContext?.registerTool({
  name: 'search_availability',
  title: 'Search available tables',
  description:
    'Find open tables at Fjord Table for a date, time and party size. ' +
    'Returns up to five nearby time slots. Does not make a booking.',
  inputSchema: searchSchema,
  annotations: { readOnlyHint: true },
  async execute({ date, time, partySize }, { signal }) {
    // Inferred: date: string, partySize: number, time: string | undefined
    const slots = await availability.search({ date, time, partySize, signal });
    bookingPanel.showSlots(slots);
    return { date, partySize, slots: slots.map((s) => s.time) };
  },
});
