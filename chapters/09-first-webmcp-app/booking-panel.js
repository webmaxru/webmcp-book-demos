// booking-panel.js: Fjord Table's own booking UI (demo code, not from the book).
// The chapters call two methods on it:
//   bookingPanel.showSlots(slots)            Listing 4.1 / 5.1: put search results on screen
//   bookingPanel.confirmWithUser(details, { signal })
//                                           Listing 5.4: the pre-filled form the user confirms
// Humans use exactly the same two methods, so an agent's call and a person's click
// end up in the same place on screen.
import { availability } from './availability.js';

// The guest's details come from their signed-in account, never from the agent (Chapter 5).
export const account = { name: 'Ingrid Hansen', email: 'ingrid@example.com', phone: '+47 400 00 000' };

const $ = (sel) => document.querySelector(sel);

function formatDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function goToBookingView() {
  if (location.hash !== '#/book') location.hash = '#/book';
}

function renderSlots(slots) {
  const list = $('#slots');
  const heading = $('#slots-heading');
  list.replaceChildren();
  if (!slots.length) {
    heading.textContent = 'No free tables for that search. Try another day or time.';
    return;
  }
  const { date, partySize } = slots[0];
  heading.textContent = `Free tables on ${formatDate(date)} for ${partySize} ` +
                        (partySize === 1 ? 'guest' : 'guests') + ':';
  for (const slot of slots) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot';
    btn.dataset.time = slot.time;
    btn.innerHTML = `<strong>${slot.time}</strong><span>${slot.seating.join(' · ')}</span>`;
    btn.addEventListener('click', () => bookFromClick(slot));
    li.append(btn);
    list.append(li);
  }
}

// A person clicked a time: same confirm step as the agent path.
async function bookFromClick(slot) {
  try {
    await bookingPanel.confirmWithUser(
      { date: slot.date, time: slot.time, partySize: slot.partySize, seating: 'no preference', slot, source: 'user' },
      { signal: new AbortController().signal });
  } catch (err) {
    console.error(err);
  }
}

function showConfirmation(booking) {
  const box = $('#confirmation');
  box.hidden = false;
  box.textContent = `Booked: ${booking.reference} · ${formatDate(booking.date)} at ${booking.time}, ` +
    `${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}, ${booking.seating} seating. ` +
    `A confirmation goes to ${account.email}.`;
  const li = document.createElement('li');
  li.textContent = `${booking.reference}: ${formatDate(booking.date)} ${booking.time}, ${booking.partySize} ` +
    `${booking.partySize === 1 ? 'guest' : 'guests'} (${booking.seating})`;
  $('#my-bookings').append(li);
  $('#my-bookings-section').hidden = false;
}

export const bookingPanel = {
  showSlots(slots) {
    goToBookingView();
    renderSlots(slots);
  },

  // Opens the pre-filled booking form and waits for the user.
  // Resolves to { confirmed: true, reference } or { confirmed: false }.
  // Rejects with signal.reason if the caller's signal aborts first.
  confirmWithUser(details, { signal } = {}) {
    const dialog = $('#confirm-dialog');
    const form = $('#confirm-form');
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (dialog.open) dialog.close('cancel');            // only one confirmation at a time

    $('#confirm-intro').textContent = details.source === 'user'
      ? 'Check the details and confirm your booking.'
      : 'Your assistant filled this in. Check it, change anything you like, and confirm.';
    $('#confirm-when').textContent = `${formatDate(details.date)} at ${details.slot?.time ?? details.time}`;
    $('#confirm-party').textContent = `${details.partySize} ${details.partySize === 1 ? 'guest' : 'guests'}`;
    $('#confirm-guest').textContent = `${account.name} · ${account.email} · ${account.phone}`;

    const seating = form.elements.seating;
    seating.replaceChildren(...['no preference', ...(details.slot?.seating ?? [])].map((s) => new Option(s, s)));
    seating.value = (details.seating && [...seating.options].some((o) => o.value === details.seating))
      ? details.seating : 'no preference';
    form.elements.notes.value = details.notes ?? '';
    $('#confirm-error').hidden = true;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        form.removeEventListener('submit', onSubmit);
        dialog.removeEventListener('cancel', onCancel);
        $('#confirm-cancel').removeEventListener('click', onCancel);
        signal?.removeEventListener('abort', onAbort);
      };
      const onCancel = (e) => {
        e?.preventDefault();
        cleanup();
        dialog.close('cancel');
        resolve({ confirmed: false });
      };
      const onAbort = () => {
        cleanup();
        dialog.close('cancel');
        reject(signal.reason);
      };
      const onSubmit = async (e) => {
        e.preventDefault();
        const submit = $('#confirm-submit');
        submit.disabled = true;
        try {
          const booked = await availability.book({
            date: details.date,
            time: details.slot?.time ?? details.time,
            partySize: details.partySize,
            seating: seating.value,
            notes: form.elements.notes.value.trim(),
            guest: account
          });
          cleanup();
          dialog.close('confirm');
          showConfirmation({ ...booked, date: details.date, time: details.slot?.time ?? details.time,
                             partySize: details.partySize });
          resolve({ confirmed: true, reference: booked.reference });
        } catch (err) {
          const box = $('#confirm-error');
          box.textContent = err.message;
          box.hidden = false;
        } finally {
          submit.disabled = false;
        }
      };
      form.addEventListener('submit', onSubmit);
      dialog.addEventListener('cancel', onCancel);       // Esc key
      $('#confirm-cancel').addEventListener('click', onCancel);
      signal?.addEventListener('abort', onAbort, { once: true });
      dialog.showModal();
    });
  }
};
