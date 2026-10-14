import { registerCheckoutTool } from './checkout-tool.js';

// checkout is registered only while the cart has something in it.
let checkoutRegistration = null;        // an AbortController while registered

export function syncCheckoutTool(cartSnapshot) {
  const wanted = cartSnapshot.lines.length > 0;
  if (wanted && !checkoutRegistration) {                              // ①
    const registration = new AbortController();
    checkoutRegistration = registration;
    registerCheckoutTool(registration.signal).catch((err) => {
      if (checkoutRegistration === registration) checkoutRegistration = null;
      if (err.name !== 'AbortError') console.warn('checkout not registered:', err.name);
    });
  } else if (!wanted && checkoutRegistration) {
    checkoutRegistration.abort();       // unregisters; a call in flight still finishes
    checkoutRegistration = null;
  }
}

// Development aid: one toolchange per registration or unregistration.
export function countToolChanges({ signal }) {                        // ②
  let changes = 0;
  document.modelContext.addEventListener('toolchange', () => {
    changes += 1;
    console.debug(`[webmcp] toolchange #${changes}`);
  }, { signal });
}
