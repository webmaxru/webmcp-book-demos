// The store's own catalog logic. The search page and the agent tools both call these functions.
export type Category = 'tents' | 'sleeping-bags' | 'backpacks' | 'footwear' | 'clothing';
export const CATEGORIES: readonly Category[] = ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'];

export interface Price { amount: number; currency: 'NOK' }

export interface Product {
  sku: string;
  name: string;
  category: Category;
  price: Price;
  rating: number;
  inStock: boolean;
  weightGrams: number;
}

const nok = (amount: number): Price => ({ amount, currency: 'NOK' });

export const PRODUCTS: readonly Product[] = [
  { sku: 'TH-TENT-01', name: 'Fjellheim 2 Ultralight Tent', category: 'tents', price: nok(4499), rating: 4.7, inStock: true, weightGrams: 1350 },
  { sku: 'TH-TENT-02', name: 'Lofoten 3 Tunnel Tent', category: 'tents', price: nok(6999), rating: 4.5, inStock: true, weightGrams: 3100 },
  { sku: 'TH-TENT-03', name: 'Hardanger 1 Bivy Tent', category: 'tents', price: nok(2899), rating: 4.2, inStock: false, weightGrams: 950 },
  { sku: 'TH-SB-01', name: 'Jotunheimen -10 Down Sleeping Bag', category: 'sleeping-bags', price: nok(3799), rating: 4.8, inStock: true, weightGrams: 1100 },
  { sku: 'TH-SB-02', name: 'Sommer +5 Synthetic Sleeping Bag', category: 'sleeping-bags', price: nok(1299), rating: 4.1, inStock: true, weightGrams: 900 },
  { sku: 'TH-BP-01', name: 'Rondane 45 L Trekking Backpack', category: 'backpacks', price: nok(2199), rating: 4.6, inStock: true, weightGrams: 1450 },
  { sku: 'TH-BP-02', name: 'Trolltunga 28 L Daypack', category: 'backpacks', price: nok(1149), rating: 4.4, inStock: true, weightGrams: 780 },
  { sku: 'TH-BP-03', name: 'Finnmark 65 L Expedition Backpack', category: 'backpacks', price: nok(3499), rating: 4.5, inStock: false, weightGrams: 2200 },
  { sku: 'TH-FW-01', name: 'Besseggen GTX Hiking Boot', category: 'footwear', price: nok(2599), rating: 4.6, inStock: true, weightGrams: 1240 },
  { sku: 'TH-FW-02', name: 'Preikestolen Trail Runner', category: 'footwear', price: nok(1699), rating: 4.3, inStock: true, weightGrams: 620 },
  { sku: 'TH-CL-01', name: 'Nordkapp Insulated Jacket', category: 'clothing', price: nok(2999), rating: 4.7, inStock: true, weightGrams: 540 },
  { sku: 'TH-CL-02', name: 'Senja Merino Base Layer', category: 'clothing', price: nok(899), rating: 4.5, inStock: true, weightGrams: 210 },
];

export interface ProductQuery {
  query: string;
  category?: Category;
  maxPrice?: number;
  inStockOnly?: boolean;
}

export function searchProducts({ query, category, maxPrice, inStockOnly }: ProductQuery): Product[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return PRODUCTS
    .filter((p) => words.every((w) => `${p.name} ${p.category}`.toLowerCase().includes(w)))
    .filter((p) => category === undefined || p.category === category)
    .filter((p) => maxPrice === undefined || p.price.amount <= maxPrice)
    .filter((p) => !inStockOnly || p.inStock)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 10);
}

export function getProduct(sku: string): Product | undefined {
  return PRODUCTS.find((p) => p.sku === sku);
}

export interface Comparison {
  products: { sku: string; name: string }[];
  rows: { attribute: string; values: (string | number | boolean)[] }[];
}

export function compareProducts(products: Product[]): Comparison {
  return {
    products: products.map(({ sku, name }) => ({ sku, name })),
    rows: [
      { attribute: 'price (NOK)', values: products.map((p) => p.price.amount) },
      { attribute: 'rating', values: products.map((p) => p.rating) },
      { attribute: 'weight (g)', values: products.map((p) => p.weightGrams) },
      { attribute: 'category', values: products.map((p) => p.category) },
      { attribute: 'in stock', values: products.map((p) => p.inStock) },
    ],
  };
}
