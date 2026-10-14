// Fake in-memory Supportly backend (demo only; not a book listing).
const articles = [
  { title: 'Exporting invoices to CSV', url: '/help/export-csv', excerpt: 'Use Invoices > Export to download all invoices as CSV.' },
  { title: 'Changing the VAT rate on an invoice', url: '/help/vat-rate', excerpt: 'Open the invoice, choose Edit, then set the VAT rate per line.' },
  { title: 'Connecting your bank account', url: '/help/bank-feed', excerpt: 'Settings > Bank feeds lets you connect a Norwegian bank.' },
];
const tickets = new Map([
  ['SUP-1042', { status: 'waiting_on_customer', latestReply: 'Could you send a screenshot of the export dialog?' }],
]);
let next = 1043;

export const helpdesk = {
  async search(query) {
    const words = query.toLowerCase().split(/\W+/).filter(Boolean);
    return articles
      .filter((a) => words.some((w) => (a.title + ' ' + a.excerpt).toLowerCase().includes(w)))
      .slice(0, 3);
  },
  async createTicket(draft) {
    const id = `SUP-${next++}`;
    tickets.set(id, { status: 'open', latestReply: null, ...draft });
    return { id };
  },
  async getTicket(id) {
    return tickets.get(id) ?? null;
  },
};
