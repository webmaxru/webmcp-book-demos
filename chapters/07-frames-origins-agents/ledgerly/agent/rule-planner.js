// A stand-in for a model: picks tools with simple rules (demo fill, not a listing).
// Swap in any planner with the same next({ history, tools }) shape.
export const rulePlanner = {
  async next({ history, tools }) {
    const has = (n) => tools.some((t) => t.name === n);
    const last = history[history.length - 1];
    if (last.role === 'tool') {
      return { answer: last.result.ok ? JSON.stringify(last.result.value) : `That didn't work: ${last.result.reason}` };
    }
    const goal = last.text.toLowerCase();
    const id = last.text.match(/SUP-[0-9]+/)?.[0];
    if (id && has('supportly__get_ticket_status')) return { call: 'supportly__get_ticket_status', args: { ticketId: id } };
    if (goal.includes('ticket') && has('supportly__create_ticket')) {
      return { call: 'supportly__create_ticket', args: { subject: last.text.slice(0, 80), body: last.text, priority: 'normal' } };
    }
    if (has('supportly__search_articles')) return { call: 'supportly__search_articles', args: { query: last.text } };
    return { answer: 'I have no tools for that here.' };
  },
};
