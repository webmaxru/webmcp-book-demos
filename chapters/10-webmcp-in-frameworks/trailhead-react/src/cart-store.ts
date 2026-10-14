import { useSyncExternalStore } from 'react';
import { getProduct, type Price } from './catalog';

export interface CartLine { sku: string; name: string; quantity: number; unitPrice: Price }
export interface Cart { lines: readonly CartLine[]; itemCount: number; total: Price }
export interface Order { orderId: string; total: Price; itemCount: number }

let cart: Cart = { lines: [], itemCount: 0, total: { amount: 0, currency: 'NOK' } };
let lastOrder: Order | null = null;
let nextOrderNumber = 10001;
const listeners = new Set<() => void>();

function commit(lines: CartLine[]): void {
  cart = {
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    total: { amount: lines.reduce((s, l) => s + l.quantity * l.unitPrice.amount, 0), currency: 'NOK' },
  };
  listeners.forEach((notify) => notify());
}

// One store, two callers: the page's buttons and the agent's tools.
export const cartStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: (): Cart => cart,
  getLastOrder: (): Order | null => lastOrder,

  add(sku: string, quantity: number): Cart {
    const product = getProduct(sku);
    if (!product) throw new Error(`Unknown SKU: ${sku}`);
    const existing = cart.lines.find((l) => l.sku === sku);
    commit(existing
      ? cart.lines.map((l) => (l.sku === sku ? { ...l, quantity: l.quantity + quantity } : l))
      : [...cart.lines, { sku, name: product.name, quantity, unitPrice: product.price }]);
    return cart;
  },

  placeOrder(): Order {
    if (cart.itemCount === 0) throw new Error('The cart is empty.');
    lastOrder = { orderId: `TH-${nextOrderNumber++}`, total: cart.total, itemCount: cart.itemCount };
    commit([]);
    return lastOrder;
  },
};

export function useCart(): Cart {
  return useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot);
}
