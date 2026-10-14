// Tools exist only while someone is signed in, and vanish the moment they sign out.
import { registerCheckoutTools } from './checkout-tools.js';

export function bindToolsToSession({ session, cart, account, orders }) {
  if (!('modelContext' in document)) return;
  let tools = null;

  async function onChange() {
    tools?.abort();                       // signed out, or a different user: drop everything
    tools = null;
    if (!session.user) return;
    tools = new AbortController();
    try {
      await registerCheckoutTools({ cart, account, orders, signal: tools.signal });
    } catch (err) {
      if (err.name !== 'AbortError') throw err;   // the session changed mid-registration
    }
  }

  session.addEventListener('change', onChange);
  onChange();
}
