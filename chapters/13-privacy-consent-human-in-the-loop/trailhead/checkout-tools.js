// Trailhead's cart and checkout tools. The page, not the agent, owns the final step.
import { confirmOrder } from './confirm-sheet.js';

export async function registerCheckoutTools({ cart, account, orders, signal }) {
  const mc = document.modelContext;

  await mc.registerTool({
    name: 'get_cart',
    title: 'View cart',
    description: 'List the items in the cart with prices in NOK and the order total.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async execute() {
      return {
        lines: cart.lines().map(({ sku, name, quantity, amount }) =>
          ({ sku, name, quantity, price: { amount, currency: 'NOK' } })),
        total: { amount: cart.total(), currency: 'NOK' },
        shipTo: account.shippingSummary(),   // "Oslo 0150", never the street address
        payWith: account.paymentSummary()    // "Visa ending 4242", never the number
      };
    }
  }, { signal });

  await mc.registerTool({
    name: 'checkout',
    title: 'Place your order',
    description:
      'Start checkout for the current cart. Trailhead shows the order and the user ' +
      'places it on the page. Returns status "placed", or "cancelled_by_user" if the user ' +
      'backs out. Never charges without the user.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { consequentialHint: true },
    async execute(_input, { signal: call }) {
      if (cart.lines().length === 0) {
        return { status: 'error', code: 'EMPTY_CART',
                 message: 'The cart is empty. Add items with add_to_cart first.' };
      }
      // Stop waiting if the agent cancels OR the user signs out: unregistering a tool
      // does not cancel calls that are already running.
      const stop = AbortSignal.any([call, signal]);
      let outcome;
      try {
        outcome = await confirmOrder({
          lines: cart.lines(),
          total: cart.total(),
          shipTo: account.shippingSummary(),
          payWith: account.paymentSummary()
        }, { signal: stop });
      } catch (err) {
        if (call.aborted) throw err;
        return { status: 'refused', code: 'SESSION_ENDED',
                 message: 'The user signed out, so nothing was ordered.' };
      }
      if (outcome !== 'confirmed') {
        return { status: 'cancelled_by_user',
                 message: 'The user closed the order without placing it. Nothing was charged.' };
      }
      const order = await orders.place(cart.snapshot());
      cart.clear();
      return { status: 'placed', orderId: order.id, total: { amount: order.total, currency: 'NOK' } };
    }
  }, { signal });
}
