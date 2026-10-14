// Fill-in for the book listings (not printed in Chapter 13): an in-memory session,
// cart, account and order service for the Trailhead checkout demo.
export const session = Object.assign(new EventTarget(), {
  user: null,
  signIn(name) { this.user = { name }; this.dispatchEvent(new Event('change')); },
  signOut() { this.user = null; this.dispatchEvent(new Event('change')); }
});

const CATALOG = {
  'TH-TENT-2P': { name: 'Fjellheim 2-person tent', amount: 3499 },
  'TH-BAG-M5':  { name: 'Mørketid -5 °C sleeping bag', amount: 1899 }
};
let lines = [];
export const cart = {
  add(sku, quantity = 1) { lines.push({ sku, quantity, ...CATALOG[sku] }); },
  lines: () => lines.map((l) => ({ ...l })),
  total: () => lines.reduce((s, l) => s + l.amount * l.quantity, 0),
  snapshot: () => ({ lines: lines.map((l) => ({ ...l })), total: lines.reduce((s, l) => s + l.amount * l.quantity, 0) }),
  clear() { lines = []; }
};

export const account = {
  // The full address and card stay on the server; the page only ever shows summaries.
  shippingSummary: () => 'Oslo 0150',
  paymentSummary: () => 'Visa ending 4242'
};

export const orders = {
  placed: [],
  async place(snapshot) {
    const order = { id: `TH-${100200 + this.placed.length}`, total: snapshot.total };
    this.placed.push(order);
    return order;
  }
};
