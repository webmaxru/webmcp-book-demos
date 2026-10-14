import { cart, orders } from './store.js';
import { confirmCheckout } from './ui.js';

export function registerCheckoutTool(signal) {
  return document.modelContext.registerTool({
    name: 'checkout',
    title: 'Check out',
    description:
      'Check out the current cart. Trailhead shows the order summary and the user ' +
      'must press "Place order" on the page; the tool waits for that. Returns the ' +
      'order ID, or status "declined" if the user cancels.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { consequentialHint: true },                          // ①
    async execute(_input, { signal }) {
      const summary = cart.snapshot();
      if (summary.lines.length === 0) {
        return { status: 'empty_cart', message: 'The cart is empty. Add items with add_to_cart first.' };
      }
      // The user decides, in Trailhead's own dialog. Cancelling the call closes it.
      const confirmed = await confirmCheckout(summary, { signal });   // ②
      if (!confirmed) {
        return { status: 'declined', message: 'The user cancelled checkout. Nothing was ordered.' };
      }
      signal.throwIfAborted();          // last check before the irreversible step ③
      const order = await orders.place(summary);
      return { status: 'placed', orderId: order.id, total: order.total };
    }
  }, { signal });
}
