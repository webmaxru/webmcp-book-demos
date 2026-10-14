// Trailhead's in-memory catalogue and cart (demo data; not printed in the book).
const PRODUCTS = [
  { sku: 'TH-TENT-2P', name: 'Fjellheim 2 Tent', category: 'tents', price: 3499, rating: 4.6, stock: 12, specs: { weightGrams: 1850, sleeps: 2, seasons: 3 } },
  { sku: 'TH-TENT-2P-UL', name: 'Fjellheim 2 UL Tent', category: 'tents', price: 5299, rating: 4.4, stock: 3, specs: { weightGrams: 1190, sleeps: 2, seasons: 3 } },
  { sku: 'TH-TENT-3P', name: 'Fjellheim 3 Tent', category: 'tents', price: 4299, rating: 4.5, stock: 0, specs: { weightGrams: 2400, sleeps: 3, seasons: 3 } },
  { sku: 'TH-TENT-4S', name: 'Polar 2 Four-Season Tent', category: 'tents', price: 7999, rating: 4.8, stock: 4, specs: { weightGrams: 3100, sleeps: 2, seasons: 4 } },
  { sku: 'TH-BAG-MINUS5', name: 'Lavvo -5 Sleeping Bag', category: 'sleeping-bags', price: 1999, rating: 4.3, stock: 20, specs: { weightGrams: 1100, comfortC: -5 } },
  { sku: 'TH-BAG-MINUS15', name: 'Lavvo -15 Sleeping Bag', category: 'sleeping-bags', price: 3299, rating: 4.7, stock: 7, specs: { weightGrams: 1600, comfortC: -15 } },
  { sku: 'TH-PACK-40', name: 'Rondane 40 Backpack', category: 'backpacks', price: 1899, rating: 4.5, stock: 15, specs: { weightGrams: 1300, litres: 40 } },
  { sku: 'TH-PACK-65', name: 'Rondane 65 Backpack', category: 'backpacks', price: 2699, rating: 4.6, stock: 9, specs: { weightGrams: 1900, litres: 65 } },
  { sku: 'TH-BOOT-FJELL', name: 'Fjell GTX Hiking Boot', category: 'footwear', price: 2499, rating: 4.4, stock: 30, sizes: [40, 41, 42, 43, 44, 45], specs: { weightGrams: 1250, waterproof: true } },
  { sku: 'TH-JACKET-SHELL', name: 'Storm Shell Jacket (limited edition)', category: 'clothing', price: 4199, rating: 4.9, stock: 25, limitPerCustomer: 2, specs: { weightGrams: 420, waterproof: true } },
  { sku: 'TH-MITTS', name: 'Vidda Wool Mittens', category: 'clothing', price: 399, rating: 4.2, stock: 40, specs: { weightGrams: 120 } },
];
// Twelve more two-person tents so that a broad search has more than ten results.
for (let i = 1; i <= 12; i++) {
  PRODUCTS.push({ sku: `TH-TENT-2P-C${i}`, name: `Camp 2 Tent, colour ${i}`, category: 'tents', price: 1999 + i * 10, rating: 4.0, stock: i % 3, specs: { weightGrams: 2600, sleeps: 2, seasons: 3 } });
}

const bySku = new Map(PRODUCTS.map((p) => [p.sku, p]));
const words = (s) => s.toLowerCase().split(/[^a-z0-9æøå-]+/).filter(Boolean);

export const catalog = {
  // A sized SKU such as TH-BOOT-FJELL-42 resolves to its product.
  get(sku) {
    const exact = bySku.get(sku);
    if (exact) return exact.sizes ? undefined : exact;   // a sized product needs its size
    const m = /^(.*)-(\d{2})$/.exec(sku ?? '');
    const p = m && bySku.get(m[1]);
    return p?.sizes?.includes(Number(m[2])) ? { ...p, sku } : undefined;
  },
  // Sizes when `sku` names a product that comes in sizes, otherwise null.
  sizesOf(sku) { return bySku.get(sku)?.sizes ?? null; },
  search({ query, category, maxPrice, inStockOnly = false }) {
    const q = words(query);
    return PRODUCTS
      .filter((p) => !category || p.category === category)
      .filter((p) => maxPrice === undefined || p.price <= maxPrice)
      .filter((p) => !inStockOnly || p.stock > 0)
      .map((p) => {
        const hay = words(`${p.name} ${p.category} ${p.specs.sleeps ? p.specs.sleeps + ' person' : ''}`);
        return { p, score: q.filter((w) => hay.some((h) => h.startsWith(w) || w.startsWith(h))).length };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.p.rating - a.p.rating)
      .map((x) => x.p);
  },
};

const lines = new Map();
export const cart = {
  quantityOf: (sku) => lines.get(sku)?.quantity ?? 0,
  add(sku, quantity) {
    const p = catalog.get(sku);
    const line = { sku, name: p.name, quantity: this.quantityOf(sku) + quantity, unitPrice: { amount: p.price, currency: 'NOK' } };
    lines.set(sku, line);
    document.dispatchEvent(new CustomEvent('cartchange'));
    return line;
  },
  total: () => [...lines.values()].reduce((s, l) => s + l.quantity * l.unitPrice.amount, 0),
  lines: () => [...lines.values()],
};
