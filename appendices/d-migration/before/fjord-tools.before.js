// BEFORE (navigator.modelContext, early 2026). Does not run in current browsers.
// provideContext() replaced the page's whole tool set; clearContext() removed it.
if ('modelContext' in navigator) {
  navigator.modelContext.provideContext({
    tools: [
      {
        name: 'search_availability',
        description: 'Find open tables at Fjord Table for a date, time and party size.',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Visit date, YYYY-MM-DD' },
            time: { type: 'string', description: 'Preferred time, 24h HH:MM' },
            partySize: { type: 'integer', minimum: 1, maximum: 12 }
          },
          required: ['date', 'partySize']
        },
        async execute({ date, time, partySize }) {
          const slots = await availability.search({ date, time, partySize });
          return { date, partySize, slots: slots.map((s) => s.time) };
        }
      },
      {
        name: 'book_table',
        description: 'Book a table at Fjord Table. Asks the user to confirm first.',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            time: { type: 'string' },
            partySize: { type: 'integer', minimum: 1, maximum: 12 },
            name: { type: 'string' }
          },
          required: ['date', 'time', 'partySize', 'name']
        },
        // The second argument was a ModelContextClient.
        async execute(booking, client) {
          const ok = await client.requestUserInteraction(() => confirmBooking(booking));
          if (!ok) return { booked: false, reason: 'The user declined.' };
          return { booked: true, reference: await bookings.create(booking) };
        }
      }
    ]
  });

  // Leaving the booking view: drop every tool on the page.
  window.addEventListener('pagehide', () => navigator.modelContext.clearContext());
}
