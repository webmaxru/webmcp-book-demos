// Supportly's backend, faked in memory for the demo (not printed in the book).
// The signed-in account is "ledgerly-acme"; tickets of other accounts are invisible.
const ARTICLES = [
  { title: 'Export invoices to CSV', url: 'https://help.supportly.example/ledgerly/export-csv', excerpt: 'Go to Invoices, filter by month, then choose Export > CSV.' },
  { title: 'Fix "Export failed" errors', url: 'https://help.supportly.example/ledgerly/export-failed', excerpt: 'Exports over 10,000 rows run in the background; you get an email.' },
  { title: 'Invite a teammate', url: 'https://help.supportly.example/ledgerly/invite', excerpt: 'Settings > Team > Invite. Teammates get an email link valid for 7 days.' },
  { title: 'Connect your bank account', url: 'https://help.supportly.example/ledgerly/bank', excerpt: 'Ledgerly supports Norwegian banks through open banking.' },
  { title: 'Change the invoice template', url: 'https://help.supportly.example/ledgerly/template', excerpt: 'Settings > Invoices > Template lets you add your logo.' },
  { title: 'Invoice numbering rules', url: 'https://help.supportly.example/ledgerly/numbering', excerpt: 'Invoice numbers are sequential per company.' },
];
const ACCOUNT = 'ledgerly-acme';
const tickets = new Map([
  ['SUP-1042', { id: 'SUP-1042', account: ACCOUNT, state: 'waiting_on_user', updated: '2026-10-14T09:12:00Z',
    latestReply: { author: 'Supportly support', text: 'Could you send a screenshot of the export error?' } }],
  ['SUP-1043', { id: 'SUP-1043', account: 'someone-else', state: 'open', updated: '2026-10-14T10:00:00Z',
    latestReply: { author: 'Customer', text: 'Private ticket of another account.' } }],
]);
let next = 1044;
const opened = [];   // timestamps of tickets opened by this account
const HOURLY_LIMIT = 3;
const recentKeys = new Map();   // idempotency key (the exact ticket content) -> { id, at }
const ticketKey = ({ subject, body, priority }) => JSON.stringify([subject, body, priority]);

const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

export const helpdesk = {
  async search(query, limit) {
    const q = words(query);
    return ARTICLES
      .map((a) => ({ a, score: q.filter((w) => words(`${a.title} ${a.excerpt}`).some((h) => h.startsWith(w))).length }))
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, limit)
      .map(({ a }) => ({ ...a }));
  },
  async ticketQuota() {
    const hourAgo = Date.now() - 3600_000;
    const recent = opened.filter((t) => t > hourAgo);
    const resetsAt = recent.length ? new Date(recent[0] + 3600_000).toISOString().slice(11, 16) : null;
    return { used: recent.length, remaining: Math.max(0, HOURLY_LIMIT - recent.length), resetsAt };
  },
  // The same subject, body and priority within an hour is the same request sent twice.
  async findDuplicate(draft) {
    const hit = recentKeys.get(ticketKey(draft));
    return hit && hit.at > Date.now() - 3600_000
      ? { id: hit.id, openedAt: new Date(hit.at).toISOString().slice(11, 16) } : null;
  },
  async createTicket({ subject, body, priority }) {
    const id = `SUP-${next++}`;
    opened.push(Date.now());
    recentKeys.set(ticketKey({ subject, body, priority }), { id, at: Date.now() });
    tickets.set(id, { id, account: ACCOUNT, subject, body, priority, state: 'open', updated: new Date().toISOString(), latestReply: null });
    const expectedReply = { low: 'within 2 business days', normal: 'within 1 business day', high: 'within 4 hours' }[priority];
    return { id, expectedReply };
  },
  // Unknown and foreign tickets look the same to the caller: no existence leak.
  async getTicket(id) {
    const t = tickets.get(id);
    return t && t.account === ACCOUNT ? { ...t } : null;
  },
};
