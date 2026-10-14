import { COPY, PRIORITIES, LIMITS } from './copy.js';

// The person's ticket form, built from the same copy as the agent's tool.
export function renderTicketForm(root) {
  root.innerHTML = `
    <button type="button" id="new-ticket">${COPY.createTicket.title}</button>
    <form id="ticket-form" hidden>
      <h2>${COPY.createTicket.title}</h2>
      <label>${COPY.fields.subject}
        <input name="subject" maxlength="${LIMITS.subject}" required></label>
      <label>${COPY.fields.body}
        <textarea name="body" maxlength="${LIMITS.body}" required></textarea></label>
      <label>${COPY.fields.priority}
        <select name="priority">${PRIORITIES.map((p) =>
          `<option value="${p.const}">${p.title}</option>`).join('')}</select></label>
      <button value="send">${COPY.createTicket.send}</button>
      <button value="cancel" formnovalidate>${COPY.createTicket.cancel}</button>
    </form>`;
}

// Shows the agent's draft in the form and waits for the person to send or cancel.
export function confirmTicket(draft, signal) {
  const form = document.getElementById('ticket-form');
  for (const [field, value] of Object.entries(draft)) form.elements[field].value = value;
  form.hidden = false;
  return new Promise((resolve) => {
    const done = (sent) => { form.hidden = true; form.onsubmit = null; resolve(sent); };
    form.onsubmit = (event) => {
      event.preventDefault();
      done(event.submitter?.value === 'send');
    };
    signal.addEventListener('abort', () => done(false), { once: true });
  });
}
