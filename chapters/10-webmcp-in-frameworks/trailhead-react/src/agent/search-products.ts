// Agent-facing wrapper: a schema, validation in code, one call into the store's own search, a compact result.
import { CATEGORIES, searchProducts, type Category } from '../catalog';

export const searchProductsSchema = {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Keywords, for example "down sleeping bag".' },
    category: { type: 'string', enum: CATEGORIES, description: 'Optional product category.' },
    maxPrice: { type: 'number', minimum: 0, description: 'Optional maximum price in NOK.' },
    inStockOnly: { type: 'boolean', description: 'Only return products that are in stock.' },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

export function searchProductsTool({ query, category, maxPrice, inStockOnly }: Record<string, unknown>) {
  if (typeof query !== 'string') return { error: 'query must be a string.' };
  if (category !== undefined && !CATEGORIES.includes(category as Category)) {
    return { error: `category must be one of: ${CATEGORIES.join(', ')}.` };
  }
  if (maxPrice !== undefined && (typeof maxPrice !== 'number' || maxPrice < 0)) {
    return { error: 'maxPrice must be a non-negative number of NOK.' };
  }
  const products = searchProducts({
    query,
    category: category as Category | undefined,
    maxPrice: maxPrice as number | undefined,
    inStockOnly: inStockOnly === true,
  });
  return {
    products: products.map(({ sku, name, price, rating, inStock }) => ({ sku, name, price, rating, inStock })),
  };
}
