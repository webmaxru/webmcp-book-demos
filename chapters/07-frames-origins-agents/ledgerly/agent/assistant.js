// Wires Ledgerly's assistant panel to the agent loop (demo fill, not a listing).
import { runAgent } from './agent-loop.js';
import { rulePlanner } from './rule-planner.js';
import { discoverTools, watchTools } from './discover.js';

const transcript = document.getElementById('transcript');
const say = (text) => { const li = document.createElement('li'); li.textContent = text; transcript.append(li); };

if ('modelContext' in document) {
  // One Ledgerly tool of its own, so the catalog mixes origins.
  await document.modelContext.registerTool({
    name: 'find_invoice',
    description: 'Find a Ledgerly invoice by number and return its payment state and amount in NOK.',
    inputSchema: { type: 'object', properties: { number: { type: 'string' } }, required: ['number'] },
    annotations: { readOnlyHint: true },
    async execute({ number }) {
      return { number, invoiceState: 'unpaid', amount: { value: 12500, currency: 'NOK' } };
    },
  }).catch(() => {});

  window.ledgerlyAgent = { runAgent, rulePlanner, discoverTools };
  watchTools((catalog) => {
    document.body.dataset.catalog = [...catalog.keys()].join(',');
  });

  document.getElementById('ask').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goal = new FormData(e.target).get('goal');
    say(`You: ${goal}`);
    const stop = new AbortController();
    await runAgent(goal, rulePlanner, {
      stop: stop.signal,
      onStep: (s) => say(s.type === 'answer' ? `Assistant: ${s.text}` : `→ ${s.name}: ${JSON.stringify(s.result)}`),
    });
  });
} else {
  say('This browser has no WebMCP, so the assistant is off.');
}
