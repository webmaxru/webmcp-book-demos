import { cartStore } from './cart-store';
import { requestConfirmation } from './confirm-store';

export type CheckoutResult =
  | { status: 'placed'; orderId: string; total: { amount: number; currency: 'NOK' } }
  | { status: 'cancelled_by_user'; message: string }
  | { status: 'refused'; code: 'CART_CHANGED'; message: string }
  | { status: 'error'; code: 'CART_EMPTY'; message: string };

// The one checkout path. The Checkout button and the checkout tool both call it.
export async function checkout(signal: AbortSignal): Promise<CheckoutResult> {
  const cart = cartStore.getSnapshot();
  if (cart.itemCount === 0) {
    return { status: 'error', code: 'CART_EMPTY', message: 'The cart is empty. Add products with add_to_cart first.' };
  }
  const confirmed = await requestConfirmation(
    'Place this order?',
    `${cart.itemCount} item(s), ${cart.total.amount.toLocaleString('nb-NO')} NOK in total.`,
    signal,
  );
  if (!confirmed) {
    return { status: 'cancelled_by_user', message: 'The user declined the order in the confirmation dialog.' };
  }
  // The commit point. The person confirmed the cart they saw, so order exactly that cart or nothing.
  if (cartStore.getSnapshot() !== cart) {
    return {
      status: 'refused',
      code: 'CART_CHANGED',
      message: 'The cart changed while the user was confirming, so nothing was ordered. Call get_cart, tell the user what changed, then call checkout again.',
    };
  }
  const order = cartStore.placeOrder();
  return { status: 'placed', orderId: order.orderId, total: order.total };
}
