// Supportly help widget: the three tools, redesigned (compare Listing 7.3).
import { helpdesk } from './helpdesk-api.js';
import { confirmTicket } from './widget-form.js';
import { COPY, LIMITS, PRIORITIES } from './copy.js';
import { checkArgs } from '../shared/validate.js';
import { fail, refuse, cancelledByUser } from '../shared/results.js';

const searchSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', maxLength: LIMITS.query,
      description: 'The user\'s question or the error text they see, e.g. "export invoices to CSV".' },
  },
  required: ['query'],
};

const ticketSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string', maxLength: LIMITS.subject,
      description: 'One-line summary, e.g. "CSV export fails for March invoices".' },
    body: { type: 'string', maxLength: LIMITS.body,
      description: 'What happened, what the user expected, and the steps that led to it.' },
    priority: { type: 'string', oneOf: PRIORITIES,                      // ①
      description: 'How urgent the problem is for the user.' },
  },
  required: ['subject', 'body', 'priority'],
};

const statusSchema = {
  type: 'object',
  properties: {
    ticketId: { type: 'string', pattern: '^SUP-[0-9]+$',
      description: 'Ticket ID as the user sees it, e.g. SUP-1042.' },
  },
  required: ['ticketId'],
};

export async function registerWidgetTools({ signal, exposedTo = [] }) {
  const mc = document.modelContext;
  const options = { signal, exposedTo };

  await mc.registerTool({
    name: 'search_articles',
    title: COPY.searchArticles.title,
    description:
      'Search Supportly\'s help articles for how-to answers about Ledgerly. Returns up to ' +
      '5 articles, best match first, each with title, link and a short excerpt.',
    inputSchema: searchSchema,
    annotations: { readOnlyHint: true },
    async execute(args) {
      const invalid = checkArgs(searchSchema, args);
      if (invalid) return invalid;
      const articles = await helpdesk.search(args.query, 5);
      if (articles.length === 0) {
        return { articles, note: 'No articles matched. Try the exact words of the error message.' };
      }
      return { articles };
    },
  }, options);

  await mc.registerTool({
    name: 'create_ticket',
    title: COPY.createTicket.title,                                       // ②
    description:
      'Open a support ticket with Supportly\'s team about a problem with Ledgerly. The user ' +
      'reviews and sends it in the help widget; their account and contact details are added ' +
      'automatically. Returns the ticket ID, e.g. SUP-1042, and when to expect a reply.',
    inputSchema: ticketSchema,                                            // ③
    annotations: { consequentialHint: true },
    async execute(args, { signal }) {
      const invalid = checkArgs(ticketSchema, args);
      if (invalid) return invalid;
      const quota = await helpdesk.ticketQuota();
      if (quota.remaining === 0) {                                        // ④
        return refuse('TICKET_LIMIT',
          `This account has opened ${quota.used} tickets in the past hour, the most allowed. ` +
          `Tell the user they can open another after ${quota.resetsAt} (UTC).`,
          { resetsAt: quota.resetsAt });
      }
      const sent = await confirmTicket(args, signal);
      if (!sent) return cancelledByUser('The user closed the ticket form without sending it.');
      const ticket = await helpdesk.createTicket(args);
      return { status: 'created', ticketId: ticket.id, expectedReply: ticket.expectedReply };
    },
  }, options);

  await mc.registerTool({
    name: 'get_ticket_status',
    title: COPY.getTicketStatus.title,
    description:
      'Get the state of one of the user\'s Supportly tickets by its ID. Returns the ticket ' +
      'state (open, waiting_on_user or resolved), when it last changed, and the latest reply, ' +
      'quoted as its author wrote it.',
    inputSchema: statusSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(args) {
      const invalid = checkArgs(statusSchema, args);
      if (invalid) return invalid;
      const ticket = await helpdesk.getTicket(args.ticketId);
      if (!ticket) {                                                      // ⑤
        return fail('TICKET_NOT_FOUND',
          `No ticket ${args.ticketId} on this account. Check the ID with the user; it is in ` +
          'the confirmation email.');
      }
      return {
        ticketId: ticket.id,
        ticketState: ticket.state,                                        // ⑥
        updated: ticket.updated,
        latestReply: ticket.latestReply,
      };
    },
  }, options);
}
