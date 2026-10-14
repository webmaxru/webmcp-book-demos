// Supportly help widget: tools for the embedding page's agent.
// Runs inside https://widget.supportly.example/embed.html.
import { helpdesk } from './helpdesk-api.js';
import { confirmTicket } from './widget-ui.js';

// Which origins each customer has registered with Supportly.
const CUSTOMER_ORIGINS = {
  ledgerly: ['https://app.ledgerly.example'],
};

export async function registerWidgetTools(signal) {
  if (!('modelContext' in document)) return 'unsupported';

  const customer = new URLSearchParams(location.search).get('customer');
  const exposedTo = CUSTOMER_ORIGINS[customer] ?? [];   // ①
  const mc = document.modelContext;

  try {
    await mc.registerTool({
      name: 'search_articles',
      title: 'Search help articles',
      description:
        'Search the Supportly help centre for articles that answer a ' +
        'question about the product. Returns titles, links and a short excerpt.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', maxLength: 200 } },
        required: ['query'],
      },
      annotations: { readOnlyHint: true },
      async execute({ query }) {
        if (typeof query !== 'string' || !query.trim()) {
          return { error: 'query must be a non-empty string' };
        }
        return { articles: await helpdesk.search(query.slice(0, 200)) };
      },
    }, { signal, exposedTo });                                   // ②

    await mc.registerTool({
      name: 'create_ticket',
      title: 'Open a support ticket',
      description:
        'Open a support ticket with the Supportly team on the user\'s behalf. ' +
        'The user reviews and sends it in the help widget. Returns the ticket ID.',
      inputSchema: {
        type: 'object',
        properties: {
          subject: { type: 'string', maxLength: 120 },
          body: { type: 'string', maxLength: 4000 },
          priority: { type: 'string', enum: ['low', 'normal', 'high'] },
        },
        required: ['subject', 'body', 'priority'],
      },
      annotations: { consequentialHint: true },
      async execute({ subject, body, priority }, { signal }) {
        if (!subject?.trim() || !body?.trim()) {
          return { error: 'subject and body are required' };
        }
        if (!['low', 'normal', 'high'].includes(priority)) {
          return { error: 'priority must be low, normal or high' };
        }
        const draft = { subject: subject.slice(0, 120), body: body.slice(0, 4000), priority };
        const sent = await confirmTicket(draft, signal);          // ③
        if (!sent) return { status: 'cancelled_by_user' };
        const ticket = await helpdesk.createTicket(draft);
        return { status: 'created', ticketId: ticket.id };
      },
    }, { signal, exposedTo });

    await mc.registerTool({
      name: 'get_ticket_status',
      title: 'Check a support ticket',
      description:
        'Get the status and latest reply of a Supportly ticket by its ID ' +
        '(for example SUP-1042).',
      inputSchema: {
        type: 'object',
        properties: { ticketId: { type: 'string', pattern: '^SUP-[0-9]+$' } },
        required: ['ticketId'],
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },  // ④
      async execute({ ticketId }) {
        if (!/^SUP-[0-9]+$/.test(ticketId ?? '')) {
          return { error: 'ticketId looks like SUP-1042' };
        }
        const ticket = await helpdesk.getTicket(ticketId);
        if (!ticket) return { error: `no ticket ${ticketId}` };
        return { ticketId, status: ticket.status, latestReply: ticket.latestReply };
      },
    }, { signal, exposedTo });

    return 'registered';
  } catch (err) {
    if (err.name === 'NotAllowedError') return 'blocked';         // ⑤
    throw err;
  }
}
