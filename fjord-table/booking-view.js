// Listing 5.5 (Chapter 5): registering book_table only while the booking view is open.
// The listing is unchanged; localizeTool() at the bottom is added for the demo
// (the chapter calls it without defining it).
import { registerAgentTool } from './agent-tools.js';
import { bookTable } from './booking-tools.js';

let bookingTools = null;   // AbortController for tools owned by this view

export async function onBookingViewOpened() {
  bookingTools = new AbortController();
  await registerAgentTool(bookTable, { signal: bookingTools.signal });
}

export function onBookingViewClosed() {
  bookingTools?.abort();   // removes book_table; a call already running carries on
  bookingTools = null;
}

// Agents read a tool's name, description and schema when they observe it.
// To change any of them (here: a localized title and description),
// unregister and register again; each step fires a toolchange event.
export async function relabelBookingTools(locale) {
  if (!bookingTools) return;
  onBookingViewClosed();
  bookingTools = new AbortController();
  await registerAgentTool(localizeTool(bookTable, locale), { signal: bookingTools.signal });
}

// ---------------------------------------------------------------------------
// Added for the demo: the minimal localizeTool() that Listing 5.5 calls.
// Only the parts the model reads (title and description) change; name, schema
// and execute stay the same, so the agent's calls keep working.
const TOOL_TEXT = {
  nb: {
    book_table: {
      title: 'Bestill bord',
      description:
        'Bestill bord på Fjord Table for et tidspunkt fra search_availability. ' +
        'Åpner det utfylte bestillingsskjemaet slik at brukeren kan bekrefte. ' +
        'Returnerer bestillingsstatus og, hvis bestilt, en referanse.'
    }
  }
};

function localizeTool(tool, locale) {
  const text = TOOL_TEXT[locale]?.[tool.name];
  return text ? { ...tool, ...text } : tool;
}
