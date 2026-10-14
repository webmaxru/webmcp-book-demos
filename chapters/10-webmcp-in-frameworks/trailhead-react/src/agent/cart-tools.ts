import { getProduct } from '../catalog';
import { cartStore } from '../cart-store';

export const addToCartSchema = {
  type: 'object',
  properties: {
    sku: { type: 'string', description: 'The product SKU, from search_products.' },
    quantity: { type: 'integer', minimum: 1, maximum: 10, description: 'How many to add (1-10).' },
  },
  required: ['sku', 'quantity'],
  additionalProperties: false,
} as const;

export function addToCartTool({ sku, quantity }: Record<string, unknown>) {
  const product = typeof sku === 'string' ? getProduct(sku) : undefined;
  if (!product) return { error: `Unknown SKU: ${String(sku)}. Use search_products first.` };
  if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10) {
    return { error: 'quantity must be a whole number from 1 to 10.' };
  }
  if (!product.inStock) return { error: `${product.sku} is out of stock.` };
  const cart = cartStore.add(product.sku, quantity as number);
  return { added: { sku: product.sku, quantity }, cart: { itemCount: cart.itemCount, total: cart.total } };
}

export function getCartTool() {
  const { lines, itemCount, total } = cartStore.getSnapshot();
  return { lines, itemCount, total };
}
