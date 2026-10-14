// Fill-in (not printed in the book): wires the Chapter 13 listings into a tiny page.
import { session, cart, account, orders } from './trailhead/store.js';
import { bindToolsToSession } from './trailhead/session-tools.js';
import { showAgentPresence } from './trailhead/agent-presence.js';

cart.add('TH-TENT-2P');
cart.add('TH-BAG-M5', 2);
document.querySelector('#cart').replaceChildren(...cart.lines().map((l) => {
  const li = document.createElement('li'); li.textContent = `${l.quantity} × ${l.name}`; return li;
}));
document.querySelector('#sign-in').onclick = () => session.signIn('Kari');
document.querySelector('#sign-out').onclick = () => session.signOut();
session.addEventListener('change', () => {
  document.querySelector('#who').textContent = session.user ? `Signed in as ${session.user.name}` : 'Signed out';
});

showAgentPresence();
bindToolsToSession({ session, cart, account, orders });
window.trailhead = { session, cart, orders };   // for the tests
