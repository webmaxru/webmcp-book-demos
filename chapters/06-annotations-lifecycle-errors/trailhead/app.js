// Trailhead Chapter 6 demo: wiring (support file; not a listing).
import { cart, catalog, orders } from './store.js';
import { showProducts, showCart, confirmCheckout } from './ui.js';
import { registerProductTools } from './product-tools.js';
import { registerCartTools } from './cart-tools.js';
import { registerCompareTool } from './compare-tool.js';
import { registerDebugTools } from './debug-tools.js';
import { watchToolLifecycle } from './tool-lifecycle.js';
import { syncCheckoutTool, countToolChanges } from './tool-sync.js';

// The ordinary page, for people.
const form = document.querySelector('#search-form');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showProducts(await catalog.search({ query: document.querySelector('#q').value || 'tent' }));
});
document.querySelector('#checkout-button').addEventListener('click', async () => {
  const summary = cart.snapshot();
  if (await confirmCheckout(summary)) {
    const order = await orders.place(summary);
    document.querySelector('#order-status').textContent = `Order ${order.id} placed.`;
  }
});
cart.subscribe(showCart);
showCart(cart.snapshot());
showProducts(await catalog.search({ query: 'tent' }));

// The agent layer: a progressive enhancement.
const debug = import.meta.env?.DEV || new URLSearchParams(location.search).has('debug');
if ('modelContext' in document) {
  const agentTools = new AbortController();
  const { signal } = agentTools;
  watchToolLifecycle({ signal });
  countToolChanges({ signal });
  try {
    await registerProductTools(signal);
    await registerCartTools(signal);
    await registerCompareTool(signal);
    if (debug) await registerDebugTools(signal);
  } catch (err) {
    console.warn('WebMCP tools not registered:', err.name, err.message);
  }
  cart.subscribe(syncCheckoutTool);
  syncCheckoutTool(cart.snapshot());
}
window.__trailheadReady = true;   // test hook
