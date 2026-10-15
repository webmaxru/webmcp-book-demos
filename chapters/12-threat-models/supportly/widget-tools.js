// Supportly widget, served from https://widget.supportly.example
import { checkArgs, ToolInputError } from './guards.js';
import { shapeArticles } from './result-shaping.js';
import { helpCenter, tickets, ticketDialog } from './widget-app.js';

const HOST = 'https://app.ledgerly.example';   // the one embedder we trust

// Chapter 11's result shape: a recoverable failure is a value, not a throw.
const invalid = (err) => ({ status: 'error', code: 'INVALID_ARGUMENT', message: err.message });

export async function registerSupportTools(signal) {
  if (!('modelContext' in document)) return;
  const mc = document.modelContext;

  // Read-only, and its output is written by strangers: say both.
  await mc.registerTool({
    name: 'search_articles',
    title: 'Search help articles',
    description: 'Search Supportly help articles and community answers. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', maxLength: 200 } },
      required: ['query'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    async execute(input) {
      try {
        const { query } = checkArgs(input, { query: { required: true, maxLength: 200 } });
        return shapeArticles(await helpCenter.search(query));
      } catch (err) {
        if (err instanceof ToolInputError) return invalid(err);
        throw err;
      }
    }
  }, { signal, exposedTo: [HOST] });

  await mc.registerTool({
    name: 'get_ticket_status',
    title: 'Check a ticket',
    description: 'Get the status of one of the signed-in user\'s support tickets by ID.',
    inputSchema: {
      type: 'object',
      properties: { ticketId: { type: 'string', pattern: '^SUP-[0-9]{1,8}$' } },
      required: ['ticketId'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    async execute(input) {
      try {
        const { ticketId } = checkArgs(input, { ticketId: { required: true, maxLength: 12 } });
        const t = tickets.get(ticketId);
        if (!t) {
          return { status: 'error', code: 'TICKET_NOT_FOUND',
                   message: `No ticket ${ticketId} on this account. Check the ID with the user.` };
        }
        return { ticketId, ticketState: t.state, updated: t.updated };
      } catch (err) {
        if (err instanceof ToolInputError) return invalid(err);
        throw err;
      }
    }
  }, { signal, exposedTo: [HOST] });

  // Consequential, and NOT exposed to the embedder: only an agent working
  // with this frame directly can call it, and the user confirms in our UI.
  await mc.registerTool({
    name: 'create_ticket',
    title: 'Open a support ticket',
    description: 'Open a support ticket. The user reviews and sends it in the widget.',
    inputSchema: {
      type: 'object',
      properties: {
        subject:  { type: 'string', maxLength: 120 },
        body:     { type: 'string', maxLength: 4000 },
        priority: { type: 'string', enum: ['low', 'normal', 'high'] }
      },
      required: ['subject', 'body'],
      additionalProperties: false
    },
    annotations: { consequentialHint: true },
    async execute(input, { signal: call }) {
      let args;
      try {
        args = checkArgs(input, {
          subject:  { required: true, maxLength: 120 },
          body:     { required: true, maxLength: 4000 },
          priority: { maxLength: 6, enum: ['low', 'normal', 'high'] }
        });
      } catch (err) {
        if (err instanceof ToolInputError) return invalid(err);
        throw err;
      }
      const sent = await ticketDialog.review(args, { signal: call });
      return sent
        ? { status: 'created', ticketId: sent.id }
        : { status: 'cancelled_by_user', message: 'The user closed the ticket form without sending it.' };
    }
  }, { signal });
}
