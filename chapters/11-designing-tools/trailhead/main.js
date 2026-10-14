// Trailhead demo page wiring (not printed in the book).
import { registerCatalogTools } from './catalog-tools.js';
import { registerCartTools } from './cart-tools.js';
import { cart } from './store.js';

const controller = new AbortController();
const badge = document.getElementById('cart-count');
document.addEventListener('cartchange', () => {
  badge.textContent = String(cart.lines().reduce((n, l) => n + l.quantity, 0));
});
if ('modelContext' in document) {
  await registerCatalogTools(controller.signal);
  await registerCartTools(controller.signal);
}
window.__ready = true;
