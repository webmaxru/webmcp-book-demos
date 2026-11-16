// Fjord Table's first tool: Listing 4.1 (Chapter 4), the same code as Listing 5.1 (Chapter 5).
// The two import lines are added for the demo; everything below them is the listing as printed.
// (The first edition called this file agent-tools.js. In the demo that name belongs to Listing 5.3's
// helper, so the registration lives here, and the second edition names this file.)
import { availability } from './availability.js';
import { bookingPanel } from './booking-panel.js';

function isISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTime(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

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
        status: { type: 'string', enum: ['error'] },
        code: { type: 'string', enum: ['INVALID_INPUT'] },
        message: { type: 'string' },
        date: { type: 'string' },
        partySize: { type: 'integer' },
        slots: { type: 'array', items: { type: 'string' } }
      },
      oneOf: [
        { required: ['date', 'partySize', 'slots'] },
        { required: ['status', 'code', 'message'] }
      ]
    },
    annotations: { readOnlyHint: true },
    async execute(input = {}, { signal } = {}) {
      const { date, time, partySize } = input ?? {};
      const problems = [];
      if (!isISODate(date)) problems.push('date must use YYYY-MM-DD and name a real date');
      if (!Number.isInteger(partySize) || partySize < 1 || partySize > 12) {
        problems.push('partySize must be an integer from 1 to 12');
      }
      if (time !== undefined && !isTime(time)) problems.push('time must use 24-hour HH:MM');
      if (problems.length > 0) {
        return { status: 'error', code: 'INVALID_INPUT', message: problems.join('; ') };
      }

      const slots = await availability.search({ date, time, partySize, signal });
      bookingPanel.showSlots(slots);   // the user sees what the agent found
      return { date, partySize, slots: slots.map((s) => s.time) };
    }
  }, { signal: agentTools.signal });

  // Later, e.g. when the user leaves the booking view:
  // agentTools.abort();   // unregisters the tool
}
