// catalog.js: Trailhead's search tool as plain data plus a plain function.
// Nothing here touches document.modelContext; adapter.js does (Listing 17.2).
import { searchProducts } from './products.js';

const price = {
  type: 'object',
  properties: {
    amount: { type: 'number', description: 'Price in Norwegian kroner' },
    currency: { type: 'string', enum: ['NOK'] },
  },
  required: ['amount', 'currency'],
};

export const catalog = [
  {
    name: 'search_products',
    title: 'Search products',
    description:
      'Search Trailhead outdoor gear by keyword, with optional category, ' +
      'maximum price in NOK and an in-stock filter. Shows the results on ' +
      'the page and returns up to 10 products with SKU, name, price and rating.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords, e.g. "2 person tent"' },
        category: {
          type: 'string',
          enum: ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'],
        },
        maxPrice: { type: 'number', minimum: 0, description: 'Maximum price in NOK' },
        inStockOnly: { type: 'boolean' },
      },
      required: ['query'],
    },
    // Not in the draft yet (issue #9, PR #254). Browsers that don't know it ignore it.
    outputSchema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            properties: {
              sku: { type: 'string' },
              name: { type: 'string' },
              price,
              rating: { type: 'number', minimum: 0, maximum: 5 },
              inStock: { type: 'boolean' },
            },
            required: ['sku', 'name', 'price', 'inStock'],
          },
        },
      },
      required: ['products'],
    },
    annotations: { readOnlyHint: true },
    run: (input) => ({ products: searchProducts(input) }),
  },
];
