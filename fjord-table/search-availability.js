// Fjord Table's search tool. The body is Listing 5.1 with its numbered markers removed.
// The two import lines are added for the demo so the module can run.
// Listing 4.1 prints the same registration without outputSchema.
import { availability } from './availability.js';
import { bookingPanel } from './booking-panel.js';

// Progressive enhancement: do nothing where WebMCP isn't available.
if ('modelContext' in document) {
  const agentTools = new AbortController();

  await document.modelContext.registerTool({
    name: 'search_availability',
    title: 'Search available tables',
    description:
      'Find open tables at Fjord Table for a date, time and party size. ' +
      'Returns up to five nearby time slots. Does not make a booking.',
    inputSchema: {
      type: 'object',
      properties: {
        date:      { type: 'string', description: 'Visit date, YYYY-MM-DD' },
        time:      { type: 'string', description: 'Preferred time, 24h HH:MM' },
        partySize: { type: 'integer', minimum: 1, maximum: 12 }
      },
      required: ['date', 'partySize']
    },
    outputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        partySize: { type: 'integer' },
        slots: { type: 'array', items: { type: 'string' } }
      },
      required: ['date', 'partySize', 'slots']
    },
    annotations: { readOnlyHint: true },
    async execute({ date, time, partySize }, { signal }) {
      // The same function the date picker calls when a human searches.
      const slots = await availability.search({ date, time, partySize, signal });
      bookingPanel.showSlots(slots);   // the user sees what the agent found
      return { date, partySize, slots: slots.map((s) => s.time) };
    }
  }, { signal: agentTools.signal });

  // Later, e.g. when the user leaves the booking view:
  // agentTools.abort();   // unregisters the tool
}
