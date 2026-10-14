// webmcp/tools.js: Fjord Table's two tools, as thin wrappers over the app's own code.
import { availability } from '../availability.js';
import { bookingPanel } from '../booking-panel.js';

const SEATING = ['window', 'indoor', 'terrace'];

const searchAvailability = {
  name: 'search_availability',
  title: 'Search available tables',
  description: 'Find open tables at Fjord Table for a date and party size. ' +
    'Returns up to five time slots near the preferred time. Does not book anything.',
  inputSchema: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Visit date, YYYY-MM-DD' },
      partySize: { type: 'integer', minimum: 1, maximum: 12 },
      time: { type: 'string', description: 'Preferred time, 24h HH:MM' },
      seating: { type: 'string', enum: SEATING }
    },
    required: ['date', 'partySize']
  },
  annotations: { readOnlyHint: true },
  async execute({ date, partySize, time, seating }, { signal }) {
    let slots = await availability.search({ date, time, partySize, signal });
    if (SEATING.includes(seating)) slots = slots.filter((s) => s.seating.includes(seating));
    bookingPanel.showSlots(slots);                    // the person sees what the agent found
    return { date, partySize, slots: slots.map(({ time, seating }) => ({ time, seating })) };
  }
};

const bookTable = {
  name: 'book_table',
  title: 'Book a table',
  description: 'Book a slot returned by search_availability. Opens the filled-in ' +
    'booking form for the guest to confirm. Returns the status and, if booked, a reference.',
  inputSchema: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Visit date, YYYY-MM-DD' },
      time: { type: 'string', description: 'Slot time from search_availability, HH:MM' },
      partySize: { type: 'integer', minimum: 1, maximum: 12 },
      seating: { type: 'string', enum: [...SEATING, 'no preference'] },
      notes: { type: 'string', description: 'Allergies or occasion, in the guest’s words' }
    },
    required: ['date', 'time', 'partySize']
  },
  annotations: { consequentialHint: true },
  async execute(input, { signal }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? '') || !/^\d{2}:\d{2}$/.test(input.time ?? '')
        || !Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 12) {
      return { status: 'invalid_input',
               message: 'Use date YYYY-MM-DD, time HH:MM and a partySize from 1 to 12.' };
    }
    const slot = await availability.find(input, { signal });
    if (!slot) return { status: 'slot_unavailable', message: 'Call search_availability again.' };
    const outcome = await bookingPanel.confirmWithUser({ ...input, slot }, { signal });
    return outcome.confirmed
      ? { status: 'booked', reference: outcome.reference, date: input.date, time: slot.time }
      : { status: 'not_confirmed_by_user' };
  }
};

export async function registerFjordTools({ signal }) {
  for (const tool of [searchAvailability, bookTable]) {
    await document.modelContext.registerTool(tool, { signal });
  }
  return [searchAvailability.name, bookTable.name];
}
