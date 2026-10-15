// Trailhead's tools, built by a factory. Every dependency arrives as an
// argument, so a unit test can pass fakes and call execute() directly.
export function createTrailheadTools({ catalog, cart, ui }) {
  const searchProducts = {
    name: 'search_products',
    title: 'Search products',
    description:
      'Search the Trailhead catalogue by keyword, with an optional category, ' +
      'maximum price in NOK and in-stock filter. Returns up to 10 products. ' +
      'Does not change the cart.',
    inputSchema: {
      type: 'object',
      properties: {
        query:       { type: 'string', description: 'Keywords, e.g. "2-person tent"' },
        category:    { type: 'string', enum: CATEGORIES },
        maxPrice:    { type: 'number', minimum: 0, description: 'Maximum price in NOK' },
        inStockOnly: { type: 'boolean', description: 'Only products that are in stock' }
      },
      required: ['query']
    },
    annotations: { readOnlyHint: true },
    async execute(input, { signal }) {
      const problem = checkSearchInput(input);              // the browser won't check
      if (problem) return { status: 'error', code: 'INVALID_ARGUMENT', message: problem };
      const hits = await catalog.search(input, { signal });
      ui.showResults(hits);                                 // the user sees it too
      return {
        products: hits.slice(0, 10).map((p) => ({
          sku: p.sku, name: p.name,
          price: { amount: p.price, currency: 'NOK' },
          rating: p.rating, inStock: p.stock > 0
        }))
      };
    }
  };

  const addToCart = {
    name: 'add_to_cart',
    title: 'Add to cart',
    description:
      'Add a product to the cart by its SKU from search_products. ' +
      'Returns the updated cart line, or a status and code saying why not.',
    inputSchema: {
      type: 'object',
      properties: {
        sku:      { type: 'string', description: 'SKU from search_products' },
        quantity: { type: 'integer', minimum: 1, maximum: 10 }
      },
      required: ['sku', 'quantity']
    },
    async execute({ sku, quantity }, { signal }) {
      if (typeof sku !== 'string' || sku === '')
        return { status: 'error', code: 'INVALID_ARGUMENT', message: 'sku must be a SKU from search_products.' };
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
        return { status: 'error', code: 'INVALID_ARGUMENT', message: 'quantity must be a whole number from 1 to 10.' };
      const product = await catalog.get(sku, { signal });
      if (!product)
        return { status: 'error', code: 'UNKNOWN_SKU', message: `No product ${sku}. Call search_products first.` };
      if (product.stock < quantity)
        return { status: 'refused', code: 'OUT_OF_STOCK',
                 message: `Only ${product.stock} of ${product.name} in stock. Ask the user before adding fewer.`,
                 available: product.stock };
      const line = cart.add(product, quantity);
      ui.showCart(cart);
      return { sku, quantity: line.quantity,
               lineTotal: { amount: line.quantity * product.price, currency: 'NOK' } };
    }
  };

  return [searchProducts, addToCart];
}

export const CATEGORIES = ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'];

function checkSearchInput({ query, category, maxPrice, inStockOnly }) {
  if (typeof query !== 'string' || query.trim() === '')
    return 'query must be a non-empty string, e.g. "tent".';
  if (category !== undefined && !CATEGORIES.includes(category))
    return `category must be one of: ${CATEGORIES.join(', ')}.`;
  if (maxPrice !== undefined && !(typeof maxPrice === 'number' && maxPrice >= 0))
    return 'maxPrice must be a number of NOK, 0 or more.';
  if (inStockOnly !== undefined && typeof inStockOnly !== 'boolean')
    return 'inStockOnly must be true or false.';
  return null;
}
