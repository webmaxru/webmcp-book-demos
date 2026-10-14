// book-form.js: the guest's click on "Book table" is the confirmation.
import { availability } from './availability.js';
import { showConfirmation, showProblem } from './booking-ui.js';

const form = document.querySelector('#book-form');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const request = {
    ...data,
    partySize: Number(data.partySize),
    seating: data.seating || undefined,
    guest: 'Ingrid Hansen'                     // the signed-in demo user
  };

  const outcome = availability.find(request).then(async (slot) => {
    if (!slot) {
      // Recoverable: say what went wrong and what to try next.
      const reason =
        `No table for ${request.partySize} at ${request.time} on ${request.date}.`;
      showProblem(reason);
      return { booked: false, reason,
               next: 'Call search_availability and offer the guest another time.' };
    }
    const { reference, seating } = await availability.book(request);
    showConfirmation(reference, request);
    return { booked: true, reference, date: request.date, time: request.time,
             partySize: request.partySize, seating };
  });

  if (event.agentInvoked) event.respondWith(outcome);

  // Clear the form only after the agent has its answer: resetting a form
  // while its tool call is still open cancels the call (Chromium 156).
  outcome.then((result) => {
    if (result.booked) setTimeout(() => form.reset());
  });
});
