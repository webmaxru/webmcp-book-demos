// trailhead-tools.ts: DEMO FILLER, not a book listing.
// The store's own logic that Listing 16.5 imports: input schemas and execute handlers for
// the five Trailhead tools, over a tiny in-memory catalogue. Chapters 10 and 11 build the
// real React versions; this file only exists so the chapter 16 listings can run.
import type { ToolName } from './tool-catalog.js';

interface Product { sku: string; name: string; category: string; price: number; weightG: number; rating: number; stock: number; }
const PRODUCTS: Product[] = [
  { sku: 'TH-TENT-2P', name: 'Fjellheim 2P tent', category: 'tents', price: 3499, weightG: 2100, rating: 4.6, stock: 7 },
  { sku: 'TH-TENT-UL1', name: 'Vidde UL 1P tent', category: 'tents', price: 4299, weightG: 980, rating: 4.4, stock: 0 },
  { sku: 'TH-BAG-M5', name: 'Myrull -5 sleeping bag', category: 'sleeping-bags', price: 1899, weightG: 1250, rating: 4.7, stock: 12 },
  { sku: 'TH-PACK-45', name: 'Stig 45 L backpack', category: 'backpacks', price: 2199, weightG: 1400, rating: 4.5, stock: 4 },
];
const cart = new Map<string, number>();
const nok = (amount: number) => ({ amount, currency: 'NOK' as const });
// Chapter 11's result convention: `status` says who acts next, `code` is stable.
const fail = (code: string, message: string) => ({ status: 'error' as const, code, message });
const refuse = (code: string, message: string) => ({ status: 'refused' as const, code, message });
const show = (html: string) => { const el = document.querySelector('#view'); if (el) el.innerHTML = html; };
function cartTotal() { let t = 0; for (const [sku, q] of cart) t += (PRODUCTS.find((p) => p.sku === sku)?.price ?? 0) * q; return t; }

export const schemas: Record<ToolName, object> = {
  search_products: { type: 'object', properties: {
    query: { type: 'string' }, category: { type: 'string', enum: ['tents', 'sleeping-bags', 'backpacks', 'footwear', 'clothing'] },
    maxPrice: { type: 'number', description: 'Maximum price in NOK' }, inStockOnly: { type: 'boolean' } }, required: ['query'] },
  compare_products: { type: 'object', properties: { skus: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 } }, required: ['skus'] },
  add_to_cart: { type: 'object', properties: { sku: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['sku', 'quantity'] },
  get_cart: { type: 'object', properties: {} },
  checkout: { type: 'object', properties: {} },
};

export const handlers: Record<ToolName, WebMCP.ToolExecuteCallback> = {
  async search_products(input) {
    const q = String(input.query ?? '').toLowerCase();
    const found = PRODUCTS.filter((p) => (!q || p.name.toLowerCase().includes(q) || p.category.includes(q))
      && (!input.category || p.category === input.category)
      && (typeof input.maxPrice !== 'number' || p.price <= input.maxPrice)
      && (!input.inStockOnly || p.stock > 0)).slice(0, 10);
    show(`<ul id="results">${found.map((p) => `<li data-sku="${p.sku}">${p.name}</li>`).join('')}</ul>`);
    return { products: found.map((p) => ({ sku: p.sku, name: p.name, price: nok(p.price), rating: p.rating, inStock: p.stock > 0 })) };
  },
  async compare_products(input) {
    const skus = Array.isArray(input.skus) ? input.skus.map(String) : [];
    if (skus.length < 2 || skus.length > 4) return fail('INVALID_INPUT', 'Compare 2 to 4 SKUs.');
    const rows = skus.map((sku) => PRODUCTS.find((p) => p.sku === sku));
    if (rows.includes(undefined)) return fail('UNKNOWN_SKU', 'One or more SKUs do not exist.');
    show('<table id="compare"></table>');
    return { rows: rows.map((p) => ({ sku: p!.sku, price: nok(p!.price), weightG: p!.weightG, rating: p!.rating, inStock: p!.stock > 0 })) };
  },
  async add_to_cart(input) {
    const product = PRODUCTS.find((p) => p.sku === input.sku);
    const quantity = Number(input.quantity);
    if (!product) return fail('UNKNOWN_SKU', `No product with SKU ${String(input.sku)}.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return fail('INVALID_INPUT', 'Quantity must be 1 to 10.');
    if (product.stock < (cart.get(product.sku) ?? 0) + quantity) return refuse('OUT_OF_STOCK', `${product.name} is out of stock.`);
    cart.set(product.sku, (cart.get(product.sku) ?? 0) + quantity);
    const badge = document.querySelector('#cart-count'); if (badge) badge.textContent = String([...cart.values()].reduce((a, b) => a + b, 0));
    return { cartTotal: nok(cartTotal()) };
  },
  async get_cart() {
    return { items: [...cart].map(([sku, quantity]) => ({ sku, quantity })), total: nok(cartTotal()) };
  },
  async checkout(_input, { signal }) {
    if (cart.size === 0) return fail('EMPTY_CART', 'The cart is empty.');
    show('<section id="checkout"><p>Review your order</p><button id="place-order">Place order</button></section>');
    if (signal.aborted) throw signal.reason;
    return { status: 'awaiting_customer', total: nok(cartTotal()) };
  },
};

// Test hook: lets the test make a handler throw, to see the 'threw' outcome.
export function breakHandlerForTest(name: ToolName): void {
  handlers[name] = async () => { throw new Error('backend unavailable'); };
}
