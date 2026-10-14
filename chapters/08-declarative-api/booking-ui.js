// booking-ui.js: the page's own UI helpers (demo glue, not a book listing).
// Used by search-form.js (Listing 8.5) and book-form.js (Listing 8.6).
import { availability } from './availability.js';

const $ = (sel) => document.querySelector(sel);

export function showSlots(slots) {
  const date = $('#search-form').elements.date.value;
  $('#slots-heading').textContent = slots.length
    ? `Open tables on ${date}. Pick one to fill in the booking form.`
    : `No open tables on ${date} for that party. Try another date or time.`;
  $('#slots').replaceChildren(...slots.map((slot) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.dataset.time = slot.time;
    button.innerHTML = `<strong>${slot.time}</strong><span>${slot.seating.join(', ')}</span>`;
    button.addEventListener('click', () => {
      const book = $('#book-form').elements;
      book.date.value = slot.date;
      book.time.value = slot.time;
      book.partySize.value = String(slot.partySize);
      book.notes.focus();
    });
    li.append(button);
    return li;
  }));
}

export function showProblem(message) {
  $('#confirmation').hidden = true;
  $('#booking-problem').textContent = message;
  $('#booking-problem').hidden = false;
}

export function showConfirmation(reference, request) {
  $('#booking-problem').hidden = true;
  $('#agent-banner').hidden = true;
  $('#confirmation').textContent =
    `Booked: ${request.date} at ${request.time} for ${request.partySize}. Reference ${reference}.`;
  $('#confirmation').hidden = false;
  $('#my-bookings-section').hidden = false;
  $('#my-bookings').replaceChildren(...availability.bookings.map((b) => {
    const li = document.createElement('li');
    li.textContent = `${b.reference}: ${b.date} ${b.time}, ${b.partySize} guests, ${b.seating}`;
    return li;
  }));
}

// Status line and sensible defaults.
const status = $('#webmcp-status');
if ('modelContext' in document) {
  status.textContent = 'WebMCP is available: the two forms on this page are also agent tools.';
  status.dataset.state = 'on';
} else {
  status.textContent = 'WebMCP is not available in this browser. The forms work as usual.';
}
const d = new Date(Date.now() + 2 * 86400000);
if (d.getDay() === 1) d.setDate(d.getDate() + 1);
const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
$('#search-form').elements.date.value = iso;
$('#search-form').elements.partySize.value = '2';
