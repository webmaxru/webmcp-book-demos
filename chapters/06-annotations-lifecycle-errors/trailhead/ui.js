// Trailhead's page UI (support file for Chapter 6; not a listing).
import { cart } from './store.js';

const $ = (sel) => document.querySelector(sel);
const nok = (n) => new Intl.NumberFormat('nb-NO').format(n) + ' kr';

export function showProducts(products) {
  const list = $('#products');
  list.replaceChildren(...products.map((p) => {
    const li = document.createElement('li');
    li.dataset.sku = p.sku;
    li.innerHTML = `<strong></strong> <span class="price"></span> <span class="stock"></span> <button type="button">Add to cart</button>`;
    li.querySelector('strong').textContent = p.name;
    li.querySelector('.price').textContent = nok(p.price.amount);
    li.querySelector('.stock').textContent = p.inStock ? 'In stock' : 'Sold out';
    li.querySelector('button').disabled = !p.inStock;
    li.querySelector('button').addEventListener('click', () => cart.add(p.sku, 1));
    return li;
  }));
}

export function showCart(snapshot) {
  $('#cart-lines').replaceChildren(...snapshot.lines.map((l) => {
    const li = document.createElement('li');
    li.textContent = `${l.quantity} × ${l.name} — ${nok(l.lineTotal.amount)}`;
    return li;
  }));
  $('#cart-total').textContent = nok(snapshot.total.amount);
  $('#checkout-button').disabled = snapshot.lines.length === 0;
}

// Trailhead's own order-confirmation dialog. Resolves true when the user presses
// "Place order" and false on "Cancel". If `signal` aborts, the dialog closes and the
// promise rejects with the signal's reason.
export function confirmCheckout(summary, { signal } = {}) {
  const dialog = $('#confirm-dialog');
  $('#confirm-summary').textContent =
    summary.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ') + ` — total ${nok(summary.total.amount)}`;
  return new Promise((resolve, reject) => {
    const finish = (fn, value) => {
      dialog.close();
      $('#confirm-ok').onclick = $('#confirm-cancel').onclick = null;
      signal?.removeEventListener('abort', onAbort);
      fn(value);
    };
    const onAbort = () => finish(reject, signal.reason);
    if (signal?.aborted) return reject(signal.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    $('#confirm-ok').onclick = () => finish(resolve, true);
    $('#confirm-cancel').onclick = () => finish(resolve, false);
    dialog.showModal();
  });
}

// A small banner that says when an agent is working on the page.
const runningCalls = new Map();
export const agentBanner = {
  start(name) {
    runningCalls.set(name, (runningCalls.get(name) ?? 0) + 1);
    render();
  },
  end(name) {
    const n = (runningCalls.get(name) ?? 1) - 1;
    if (n > 0) runningCalls.set(name, n); else runningCalls.delete(name);
    render();
  }
};
function render() {
  const banner = $('#agent-banner');
  banner.hidden = runningCalls.size === 0;
  banner.textContent = runningCalls.size ? `Agent working: ${[...runningCalls.keys()].join(', ')}` : '';
}

export const activityLog = {
  entries: [],
  add(text) {
    activityLog.entries.push(text);
    const li = document.createElement('li');
    li.textContent = text;
    $('#activity').append(li);
  }
};
