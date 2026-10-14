// The widget's own confirmation card for create_ticket (demo fill, not a listing).
export function confirmTicket(draft, signal) {
  return new Promise((resolve) => {
    const area = document.getElementById('confirm-area');
    const card = document.createElement('form');
    card.className = 'confirm';
    card.innerHTML = `
      <p><strong>Send this ticket to Supportly?</strong></p>
      <p class="subject"></p><p class="priority"></p><pre class="body"></pre>
      <button value="send" id="send-ticket">Send ticket</button>
      <button value="cancel" id="cancel-ticket">Cancel</button>`;
    card.querySelector('.subject').textContent = draft.subject;
    card.querySelector('.priority').textContent = `Priority: ${draft.priority}`;
    card.querySelector('.body').textContent = draft.body;
    const done = (ok) => { card.remove(); resolve(ok); };
    card.addEventListener('submit', (e) => { e.preventDefault(); done(e.submitter?.value === 'send'); });
    signal?.addEventListener('abort', () => done(false), { once: true });
    area.append(card);
  });
}
