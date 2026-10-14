// Listing 5.4 (Chapter 5): book_table, with a careful schema and validation in code.
// The two import lines marked "added" are for the demo; the rest is the listing as printed.
import { availability } from './availability.js';    // added for the demo
import { bookingPanel } from './booking-panel.js';    // added for the demo
import { registerAgentTool } from './agent-tools.js';

export const bookTable = {
  name: 'book_table',
  title: 'Book a table',
  description:
    'Book a table at Fjord Table for a slot returned by search_availability. ' +
    'Opens the filled-in booking form for the user to confirm. ' +
    'Returns the booking status and, if booked, a reference.',
  inputSchema: {
    type: 'object',
    properties: {
      date:      { type: 'string', description: 'Visit date, YYYY-MM-DD' },
      time:      { type: 'string', description: 'Slot time from search_availability, 24h HH:MM' },
      partySize: { type: 'integer', minimum: 1, maximum: 12,
                   description: 'Number of guests, including children' },
      seating:   { type: 'string', enum: ['window', 'indoor', 'terrace', 'no preference'],
                   description: 'Seating preference; use "no preference" if the user has none' },
      notes:     { type: 'string',
                   description: 'Allergies or occasion, in the user’s own words' }
    },
    required: ['date', 'time', 'partySize']
  },
  annotations: { consequentialHint: true },          // a real-world action: Chapter 6
  async execute(input, { signal }) {
    const problem = checkBookingInput(input);         // validate strictly in code
    if (problem) return { status: 'invalid_input', message: problem };

    const slot = await availability.find(input, { signal });
    if (!slot) {
      return {
        status: 'slot_unavailable',
        message: `No table for ${input.partySize} at ${input.time} on ${input.date}. ` +
                 'Call search_availability for current slots.'
      };
    }

    // Fjord Table's own UI: the booking form, pre-filled, on screen.
    // The guest's name and contact details come from their signed-in account.
    const outcome = await bookingPanel.confirmWithUser({ ...input, slot }, { signal });
    if (!outcome.confirmed) return { status: 'not_confirmed_by_user' };

    return { status: 'booked', reference: outcome.reference,
             date: input.date, time: slot.time, partySize: input.partySize };
  }
};

function checkBookingInput({ date, time, partySize }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? ''))
    return 'Invalid date. Use YYYY-MM-DD, for example 2026-11-20.';
  if (!/^\d{2}:\d{2}$/.test(time ?? ''))
    return 'Invalid time. Use 24-hour HH:MM, for example 19:00.';
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 12)
    return 'partySize must be a whole number from 1 to 12. ' +
           'For larger groups, ask the user to call the restaurant.';
  return null;
}
