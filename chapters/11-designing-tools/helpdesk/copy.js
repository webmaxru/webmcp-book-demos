// Supportly widget: every word that people and agents see, in one place.
// The form (widget-form.js) and the tools (widget-tools.js) both import it.
export const LIMITS = { query: 200, subject: 120, body: 4000 };

export const PRIORITIES = [
  { const: 'low', title: 'Low: a question; nothing is blocked. Reply within 2 business days.' },
  { const: 'normal', title: 'Normal: something is broken, with a workaround. Reply within 1 business day.' },
  { const: 'high', title: 'High: the user or their team cannot work. Reply within 4 hours.' },
];

export const COPY = {
  searchArticles: { title: 'Search help articles' },
  createTicket: { title: 'Open a support ticket', send: 'Send ticket', cancel: 'Cancel' },
  getTicketStatus: { title: 'Check a support ticket' },
  fields: {
    subject: 'Subject',
    body: 'What happened?',
    priority: 'How urgent is it?',
  },
};
