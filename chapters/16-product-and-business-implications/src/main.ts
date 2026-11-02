// main.ts: DEMO FILLER, not a book listing. Page wiring for tests/index.html.
import { registerTrailheadTools } from './register-tools.js';
import { orderAttribution } from './attribution.js';
import { analytics, sent } from './analytics.js';
import { breakHandlerForTest } from './trailhead-tools.js';

const tools = new AbortController();
await registerTrailheadTools(tools.signal);

// The customer's own click places the order; attribution rides along with it.
document.addEventListener('click', (e) => {
  if ((e.target as Element).id === 'place-order') {
    analytics.send('order_placed', { orderId: 'TH-' + Date.now(), ...orderAttribution() });
  }
});

Object.assign(window, { __trailhead: { sent, tools, breakHandlerForTest, registerTrailheadTools, ready: true } });
