// search-form.js: one submit handler for people and agents alike.
import { availability } from './availability.js';
import { showSlots } from './booking-ui.js';

const form = document.querySelector('#search-form');
const dateInput = form.elements.date;

// A rule HTML attributes can't express: Fjord Table is closed on Mondays.
// The custom validity message is what an agent sees if the check fails.
dateInput.addEventListener('input', () => {
  const monday = dateInput.value !== '' &&
    new Date(`${dateInput.value}T12:00:00`).getDay() === 1;
  dateInput.setCustomValidity(monday ? 'Fjord Table is closed on Mondays.' : '');
});

form.addEventListener('submit', (event) => {
  event.preventDefault();                      // stay on this page
  const data = new FormData(form);
  const date = data.get('date');
  const partySize = Number(data.get('partySize'));
  const seating = data.get('seating');

  const result = availability.search({
    date, partySize, time: data.get('time') || undefined
  }).then((slots) => {
    const open = seating ? slots.filter((s) => s.seating.includes(seating)) : slots;
    showSlots(open);                           // the person sees the result...
    return {                                   // ...and so does the agent
      date, partySize,
      slots: open.map((s) => ({ time: s.time, seating: s.seating }))
    };
  });

  if (event.agentInvoked) event.respondWith(result);
});
