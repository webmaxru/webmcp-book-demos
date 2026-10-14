// products.js (filler, not a listing): a four-product in-memory catalogue
// so that Listing 17.1 runs. Chapter 10 builds the real React store.
const PRODUCTS = [
  { sku: 'TH-TENT-2P', name: 'Fjellheim 2P tent', category: 'tents', price: 3499, rating: 4.6, stock: 7 },
  { sku: 'TH-TENT-UL1', name: 'Vidde UL 1P tent', category: 'tents', price: 4299, rating: 4.4, stock: 0 },
  { sku: 'TH-BAG-M5', name: 'Myrull -5 sleeping bag', category: 'sleeping-bags', price: 1899, rating: 4.7, stock: 12 },
  { sku: 'TH-PACK-45', name: 'Stig 45 L backpack', category: 'backpacks', price: 2199, rating: 4.5, stock: 4 },
];

export function searchProducts({ query, category, maxPrice, inStockOnly }) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return PRODUCTS
    .filter((p) => words.some((w) => p.name.toLowerCase().includes(w) || p.category.includes(w)))
    .filter((p) => !category || p.category === category)
    .filter((p) => maxPrice === undefined || p.price <= maxPrice)
    .filter((p) => !inStockOnly || p.stock > 0)
    .slice(0, 10)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      price: { amount: p.price, currency: 'NOK' },
      rating: p.rating,
      inStock: p.stock > 0,
    }));
}
