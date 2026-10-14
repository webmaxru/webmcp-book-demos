// Test doubles for the Trailhead unit tests (not a listing; support code).
const PRODUCTS = [
  { sku: 'TH-TENT-2P', name: 'Fjellbu 2-person tent', category: 'tents', price: 2490, rating: 4.6, stock: 3 },
  { sku: 'TH-TENT-4P', name: 'Fjellbu 4-person tent', category: 'tents', price: 4290, rating: 4.4, stock: 0 },
  { sku: 'TH-BAG-SUM', name: 'Lett summer sleeping bag', category: 'sleeping-bags', price: 1190, rating: 4.2, stock: 12 },
  { sku: 'TH-PACK-45', name: 'Vidde 45 L backpack', category: 'backpacks', price: 1890, rating: 4.7, stock: 5 },
  { sku: 'TH-BOOT-GTX', name: 'Stig hiking boots', category: 'footwear', price: 2290, rating: 4.5, stock: 7 },
  { sku: 'TH-SHELL-W', name: 'Regnly shell jacket', category: 'clothing', price: 2790, rating: 4.3, stock: 2 }
];

export function fakeCatalog(products = PRODUCTS) {
  return {
    searches: 0,
    async search({ query, category, maxPrice, inStockOnly }, { signal }) {
      signal.throwIfAborted();
      this.searches++;
      const words = query.toLowerCase().split(/\s+/);
      return products.filter((p) =>
        words.some((w) => p.name.toLowerCase().includes(w) || p.category.includes(w)) &&
        (category === undefined || p.category === category) &&
        (maxPrice === undefined || p.price <= maxPrice) &&
        (!inStockOnly || p.stock > 0));
    },
    async get(sku, { signal }) {
      signal.throwIfAborted();
      return products.find((p) => p.sku === sku) ?? null;
    }
  };
}

export function fakeCart() {
  const lines = new Map();
  return {
    lines,
    add(product, quantity) {
      const line = lines.get(product.sku) ?? { sku: product.sku, quantity: 0 };
      line.quantity += quantity;
      lines.set(product.sku, line);
      return line;
    }
  };
}

export function recordingUi() {
  const calls = [];
  return {
    calls,
    showResults: (hits) => calls.push(['showResults', hits.length]),
    showCart: (cart) => calls.push(['showCart', cart.lines.size])
  };
}
