import { cart, catalog } from './store.js';

// A tool-level failure: a stable code to branch on and a sentence to act on.
const fail = (code, message, details = {}) => ({ status: 'error', code, message, ...details });
// A rule says no: the call was fine, but other arguments won't help (Chapter 11).
const refuse = (code, message, details = {}) => ({ status: 'refused', code, message, ...details });

export async function registerCartTools(signal) {
  await document.modelContext.registerTool({
    name: 'add_to_cart',
    title: 'Add to cart',
    description:
      'Add 1 to 10 units of one product to the cart, by SKU. Adding a SKU that is ' +
      'already in the cart increases its quantity. Returns the cart line and total.',
    inputSchema: {
      type: 'object',
      properties: {
        sku:      { type: 'string', description: 'Product SKU from search_products' },
        quantity: { type: 'integer', minimum: 1, maximum: 10 }
      },
      required: ['sku', 'quantity']
    },
    async execute({ sku, quantity }, { signal }) {
      if (typeof sku !== 'string') {
        return fail('INVALID_INPUT', 'Provide "sku" as a string, for example "TH-TENT-2P".');
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return fail('INVALID_QUANTITY', 'Provide "quantity" as a whole number from 1 to 10.');
      }
      const product = catalog.get(sku);
      if (!product) {
        return fail('UNKNOWN_SKU', `No product has SKU "${sku}". Use search_products to find SKUs.`);
      }
      const available = await catalog.stock(sku, signal);
      if (available < quantity) {
        return refuse('OUT_OF_STOCK',
          `Only ${available} of ${product.name} in stock. Ask the user before adding fewer.`,
          { available });
      }
      signal.throwIfAborted();          // check right before the side effect
      const line = cart.add(sku, quantity);
      return { status: 'added', line, total: cart.snapshot().total };
    }
  }, { signal });

  await document.modelContext.registerTool({
    name: 'get_cart',
    title: 'View cart',
    description: 'Return the items in the cart, with quantities, line totals and the cart total in NOK.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => cart.snapshot()
  }, { signal });
}
