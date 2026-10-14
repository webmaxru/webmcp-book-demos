import * as z from 'zod/v4';

const RETURNS_POLICY = `# Trailhead returns policy
- Unused items can be returned within 60 days for a full refund.
- Tents and sleeping bags that have been used can be returned within 30 days.
- Returns are free with Posten from any post office in Norway.`;

export function registerContext(server) {
  // A resource: context the host or the user chooses to attach.
  server.registerResource(
    'returns-policy',
    'trailhead://policies/returns',
    {
      title: 'Trailhead returns policy',
      description: 'The current returns and refunds policy',
      mimeType: 'text/markdown'
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: RETURNS_POLICY }]
    })
  );

  // A prompt: a reusable starting point the user picks, e.g. as a slash command.
  server.registerPrompt(
    'packing_list',
    {
      title: 'Plan a packing list',
      description: 'Draft a packing list for a trip using Trailhead gear',
      argsSchema: z.object({
        trip: z.string().describe('Where and when, e.g. "Jotunheimen in October"'),
        nights: z.string().describe('Number of nights')
      })
    },
    ({ trip, nights }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text:
            `I'm going to ${trip} for ${nights} nights. Draft a packing list. ` +
            'Use search_products to suggest in-stock Trailhead gear for each item.'
        }
      }]
    })
  );
}
