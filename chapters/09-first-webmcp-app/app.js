// app.js: Fjord Table works for people first; agent tools are an enhancement.
import { availability } from './availability.js';
import { bookingPanel } from './booking-panel.js';
import { enableWebMCP } from './webmcp/enable.js';

const params = new URLSearchParams(location.search);
const chip = document.querySelector('#webmcp-status');

// 1. The page itself: the search form calls the same code the tool calls.
document.querySelector('#search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget.elements;
  bookingPanel.showSlots(await availability.search({
    date: form.date.value, time: form.time.value || undefined,
    partySize: Number(form.partySize.value)
  }));
});

// 2. The enhancement: tools only where the browser (or a polyfill) can carry them.
const webmcp = await enableWebMCP({ polyfill: params.has('webmcp-polyfill') });
if (webmcp.mode === 'off') {
  chip.textContent = `Agent tools off (${webmcp.reason}). The booking page works as usual.`;
} else {
  const tools = new AbortController();     // one signal for the whole tool surface
  try {
    const { registerFjordTools } = await import('./webmcp/tools.js');
    const names = await registerFjordTools({ signal: tools.signal });
    chip.textContent = `Agent tools on (${webmcp.mode}): ${names.join(', ')}`;
  } catch (err) {
    tools.abort();                         // all or nothing: withdraw what did register
    // NotAllowedError: a "tools" Permissions Policy blocks this document.
    chip.textContent = `Agent tools unavailable (${err.name}). The booking page works as usual.`;
  }
}
chip.dataset.state = webmcp.mode;

// 3. Development only: load the Test Agent with ?test-agent.
if (params.has('test-agent') && webmcp.mode !== 'off') {
  const { createTestAgent } = await import('./test-agent.js');
  window.testAgent = createTestAgent();
}
