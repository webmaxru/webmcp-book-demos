import { cart, catalog } from './store.js';
import { checkArgs } from '../shared/validate.js';
import { fail, refuse, needsInput } from '../shared/results.js';

const addSchema = {
  type: 'object',
  properties: {
    sku: { type: 'string',
      description: 'SKU from search_products. Footwear SKUs end in the EU size, e.g. TH-BOOT-FJELL-42.' },
    quantity: { type: 'integer', minimum: 1, maximum: 10, description: 'How many to add, 1 to 10.' },
  },
  required: ['sku', 'quantity'],
};

export async function registerCartTools(signal) {
  await document.modelContext.registerTool({
    name: 'add_to_cart',
    title: 'Add to cart',
    description:
      'Add 1 to 10 units of one product to the cart, by SKU. Adding a SKU that is already ' +
      'in the cart increases its quantity. Returns the cart line and the cart total in NOK.',
    inputSchema: addSchema,
    async execute(args) {
      const invalid = checkArgs(addSchema, args);
      if (invalid) return invalid;                                       // ①
      const { sku, quantity } = args;

      const sizes = catalog.sizesOf(sku);
      if (sizes) {                                                       // ②
        return needsInput(['size'],
          `This product comes in EU sizes ${sizes.join(', ')}. Ask the user which size, then ` +
          `call add_to_cart again with the sized SKU, e.g. ${sku}-${sizes[0]}.`,
          { sizes });
      }

      const product = catalog.get(sku);
      if (!product) {
        return fail('UNKNOWN_SKU', `No product has SKU "${sku}". Use search_products to find SKUs.`);
      }

      const inCart = cart.quantityOf(sku);
      if (product.limitPerCustomer && inCart + quantity > product.limitPerCustomer) {
        return refuse('PURCHASE_LIMIT',                                  // ③
          `${product.name} is limited to ${product.limitPerCustomer} per customer and the cart ` +
          `has ${inCart}. Ask the user before adding a smaller quantity.`,
          { limit: product.limitPerCustomer, inCart });
      }
      if (product.stock < inCart + quantity) {
        return refuse('OUT_OF_STOCK',
          `Only ${product.stock} of ${product.name} in stock and the cart has ${inCart}. ` +
          'Ask the user before adding a smaller quantity.',
          { available: product.stock, inCart });
      }

      const line = cart.add(sku, quantity);
      return { status: 'added', line, total: { amount: cart.total(), currency: 'NOK' } };
    },
  }, { signal });
}
