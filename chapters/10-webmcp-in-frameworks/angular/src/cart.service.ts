import { Service, computed, signal } from '@angular/core';
import { getProduct } from './catalog';

export interface CartLine { sku: string; name: string; quantity: number; unitPrice: number }

@Service()
export class CartService {
  readonly lines = signal<CartLine[]>([]);
  readonly total = computed(() => this.lines().reduce((s, l) => s + l.quantity * l.unitPrice, 0));

  add(sku: string, quantity: number): void {
    const product = getProduct(sku);
    if (!product) throw new Error(`Unknown SKU: ${sku}`);
    this.lines.update((lines) => [...lines, { sku, name: product.name, quantity, unitPrice: product.price.amount }]);
  }

  snapshot() {
    return { lines: this.lines(), total: { amount: this.total(), currency: 'NOK' as const } };
  }
}
