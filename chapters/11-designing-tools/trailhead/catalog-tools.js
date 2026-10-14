import { catalog } from './store.js';
import { checkArgs } from '../shared/validate.js';
import { fail } from '../shared/results.js';

const LIMIT = 10;

const searchSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', maxLength: 100,
      description: 'What the user wants, in their words, e.g. "light 2 person tent".' },
    category: { type: 'string', enum: ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'],
      description: 'Only search one category. Omit to search all of them.' },
    maxPrice: { type: 'number', minimum: 0, description: 'Highest price in NOK, e.g. 2500.' },
    inStockOnly: { type: 'boolean', description: 'true hides products that are out of stock. Default false.' },
  },
  required: ['query'],
};

const compareSchema = {
  type: 'object',
  properties: {
    skus: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4, uniqueItems: true,
      description: '2 to 4 different SKUs from search_products, e.g. ["TH-TENT-2P", "TH-TENT-3P"].' },
  },
  required: ['skus'],
};

export async function registerCatalogTools(signal) {
  await document.modelContext.registerTool({
    name: 'search_products',
    title: 'Search products',
    description:
      'Search the Trailhead outdoor-gear catalogue. Returns up to 10 products, best match ' +
      'first, each with SKU, name, price in NOK, rating and whether it is in stock, plus the ' +
      'total number of matches. Does not change the cart.',
    inputSchema: searchSchema,
    annotations: { readOnlyHint: true },
    async execute(args) {
      const invalid = checkArgs(searchSchema, args);
      if (invalid) return invalid;
      const matches = catalog.search(args);
      const result = {
        products: matches.slice(0, LIMIT).map((p) => ({                // ①
          sku: p.sku, name: p.name, price: { amount: p.price, currency: 'NOK' },
          rating: p.rating, inStock: p.stock > 0,
        })),
        total: matches.length,
      };
      if (matches.length > LIMIT) {                                    // ②
        result.note = `Showing ${LIMIT} of ${matches.length}. Add category or maxPrice to narrow the search.`;
      } else if (matches.length === 0) {
        result.note = 'No products matched. Try fewer or more general words.';
      }
      return result;
    },
  }, { signal });

  await document.modelContext.registerTool({
    name: 'compare_products',
    title: 'Compare products',
    description:
      'Compare 2 to 4 products side by side. Returns one row per attribute (price in NOK, ' +
      'rating, stock, weight in grams and the specs of that category) with each product\'s value.',
    inputSchema: compareSchema,
    annotations: { readOnlyHint: true },
    async execute(args) {
      const invalid = checkArgs(compareSchema, args);
      if (invalid) return invalid;
      const unknownSkus = args.skus.filter((sku) => !catalog.get(sku));
      if (unknownSkus.length) {                                        // ③
        return fail('UNKNOWN_SKU',
          `No product has SKU ${unknownSkus.join(', ')}. Use search_products to find SKUs.`,
          { unknownSkus });
      }
      const products = args.skus.map((sku) => catalog.get(sku));
      const row = (attribute, value) =>
        ({ attribute, values: Object.fromEntries(products.map((p) => [p.sku, value(p)])) });
      const specKeys = [...new Set(products.flatMap((p) => Object.keys(p.specs)))];
      return {
        products: products.map((p) => ({ sku: p.sku, name: p.name })),
        rows: [
          row('price (NOK)', (p) => p.price),
          row('rating', (p) => p.rating),
          row('in stock', (p) => p.stock > 0),
          ...specKeys.map((k) => row(k, (p) => p.specs[k] ?? null)),     // ④
        ],
      };
    },
  }, { signal });
}
