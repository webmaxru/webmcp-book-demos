import { catalog } from './store.js';
import { showProducts } from './ui.js';

const CATEGORIES = ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'];

export async function registerProductTools(signal) {
  await document.modelContext.registerTool({
    name: 'search_products',
    title: 'Search products',
    description:
      'Search the Trailhead catalogue by keyword, with an optional category, ' +
      'maximum price in NOK and in-stock filter. Returns up to 10 products ' +
      'with SKU, name, price, rating and stock. Does not change the cart.',
    inputSchema: {
      type: 'object',
      properties: {
        query:       { type: 'string', description: 'Keywords, e.g. "2 person tent"' },
        category:    { type: 'string', enum: CATEGORIES },
        maxPrice:    { type: 'number', description: 'Highest price in NOK' },
        inStockOnly: { type: 'boolean', description: 'Only products in stock' }
      },
      required: ['query']
    },
    annotations: { readOnlyHint: true },                               // ①
    async execute({ query, category, maxPrice, inStockOnly = false }, { signal }) {
      if (typeof query !== 'string' || query.trim() === '') {
        return { status: 'error', code: 'INVALID_INPUT',
                 message: 'Provide "query" as a non-empty string.' };
      }
      if (category !== undefined && !CATEGORIES.includes(category)) {
        return { status: 'error', code: 'INVALID_INPUT',
                 message: `"category" must be one of: ${CATEGORIES.join(', ')}.` };
      }
      const products = await catalog.search({ query, category, maxPrice, inStockOnly }, signal);
      showProducts(products);            // the user sees what the agent found
      return { products };
    }
  }, { signal });

  await document.modelContext.registerTool({
    name: 'get_product_reviews',
    title: 'Read customer reviews',
    description:
      'Return up to five recent customer reviews for one product, by SKU. ' +
      'Review text is written by customers, not by Trailhead.',
    inputSchema: {
      type: 'object',
      properties: { sku: { type: 'string', description: 'Product SKU from search_products' } },
      required: ['sku']
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },  // ②
    async execute({ sku }, { signal }) {
      const product = catalog.get(sku);
      if (!product) {
        return { status: 'error', code: 'UNKNOWN_SKU',
                 message: `No product has SKU "${sku}". Use search_products to find SKUs.` };
      }
      const reviews = await catalog.reviews(sku, signal);
      return {
        sku,
        averageRating: product.rating,
        // Customer text stays in its own field; it is never merged into our sentences.
        reviews: reviews.map(({ rating, date, text }) => ({ rating, date, text }))   // ③
      };
    }
  }, { signal });
}
