import { useSyncExternalStore } from 'react';
import { useWebMCP } from 'usewebmcp';
import { cartStore, useCart } from '../cart-store';
import { checkout } from '../checkout';

export function CartPage() {
  const cart = useCart();
  const lastOrder = useSyncExternalStore(cartStore.subscribe, cartStore.getLastOrder);

  // A view-scoped, consequential tool: it exists only on this page, and only with items in the cart.
  useWebMCP({
    name: 'checkout',
    description: 'Place the order for everything in the cart. The user must confirm in the page\'s own dialog; nothing is ordered until they click "Place order". Returns the order ID, or status "cancelled" if the user declines.',
    annotations: { consequentialHint: true },
    enabled: cart.itemCount > 0,
    execute: (_input, { signal }) => checkout(signal),
  });

  return (
    <section>
      <h1>Your cart</h1>
      {lastOrder && cart.itemCount === 0 && (
        <p className="notice" data-testid="order-placed">Order {lastOrder.orderId} placed. Takk!</p>
      )}
      {cart.itemCount === 0 ? <p>Your cart is empty.</p> : (
        <>
          <ul className="lines">
            {cart.lines.map((l) => (
              <li key={l.sku}>{l.quantity} × {l.name} <span>{(l.quantity * l.unitPrice.amount).toLocaleString('nb-NO')} NOK</span></li>
            ))}
          </ul>
          <p className="total">Total: {cart.total.amount.toLocaleString('nb-NO')} NOK</p>
          <button type="button" onClick={() => void checkout(new AbortController().signal)}>Checkout</button>
        </>
      )}
    </section>
  );
}
