import { compareProducts, getProduct, type Product } from '../catalog';

export const compareProductsSchema = {
  type: 'object',
  properties: {
    skus: {
      type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4,
      description: 'Two to four SKUs from search_products results.',
    },
  },
  required: ['skus'],
  additionalProperties: false,
} as const;

export function compareProductsTool({ skus }: Record<string, unknown>) {
  if (!Array.isArray(skus) || skus.length < 2 || skus.length > 4) return { status: 'error', code: 'INVALID_ARGUMENT', message: 'skus must list 2 to 4 SKUs.' };
  const products = skus.map((sku) => getProduct(String(sku)));
  const unknown = skus.filter((_, i) => !products[i]);
  if (unknown.length) return { status: 'error', code: 'UNKNOWN_SKU', message: `Unknown SKU(s): ${unknown.join(', ')}. Use search_products to find SKUs.` };
  return compareProducts(products as Product[]);
}
