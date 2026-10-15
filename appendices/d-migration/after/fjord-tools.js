// AFTER (document.modelContext, 15 October 2026 draft; Chromium 156).
// One registerTool() call per tool, one AbortController per view.
export async function registerFjordTools({ availability, bookings, confirmBooking }) {
  if (!('modelContext' in document)) return null;   // progressive enhancement
  const view = new AbortController();
  const options = { signal: view.signal };

  await document.modelContext.registerTool({
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
    annotations: { readOnlyHint: true },
    async execute({ date, time, partySize }, { signal }) {
      const slots = await availability.search({ date, time, partySize, signal });
      return { date, partySize, slots: slots.map((s) => s.time) };
    }
  }, options);

  await document.modelContext.registerTool({
    name: 'book_table',
    description: 'Book a table at Fjord Table. The user confirms in the page first.',
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
    annotations: { consequentialHint: true },
    // The second argument is now { signal }. Confirmation is the page's own UI.
    async execute(booking, { signal }) {
      const ok = await confirmBooking(booking, { signal });
      if (!ok) return { status: 'cancelled_by_user', message: 'The guest declined in the booking dialog.' };
      return { status: 'booked', reference: await bookings.create(booking) };
    }
  }, options);

  // Leaving the booking view: abort() unregisters exactly these two tools.
  window.addEventListener('pagehide', () => view.abort(), { once: true });
  return view;
}
