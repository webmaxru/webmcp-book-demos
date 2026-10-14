// The page's own confirmation step. The agent can open it; only a person should finish it.
const ARMING_DELAY_MS = 800;   // ignore presses that land before a person could have read the sheet

export function confirmOrder(order, { signal } = {}) {
  const sheet = document.querySelector('#confirm-sheet');
  sheet.querySelector('[data-items]').replaceChildren(...order.lines.map((l) => {
    const li = document.createElement('li');
    li.textContent = `${l.quantity} × ${l.name}: ${formatNok(l.amount * l.quantity)}`;
    return li;
  }));
  sheet.querySelector('[data-total]').textContent = formatNok(order.total);
  sheet.querySelector('[data-ship-to]').textContent = order.shipTo;
  sheet.querySelector('[data-pay-with]').textContent = order.payWith;

  const place = sheet.querySelector('[data-place]');
  const back = sheet.querySelector('[data-back]');
  place.disabled = true;
  sheet.showModal();
  sheet.querySelector('h2').focus();              // screen readers start at the heading
  const armed = setTimeout(() => { place.disabled = false; }, ARMING_DELAY_MS);

  return new Promise((resolve, reject) => {
    const finish = (outcome) => { cleanup(); sheet.close(); resolve(outcome); };
    const onPlace = (e) => { if (e.isTrusted && !place.disabled) finish('confirmed'); };
    const onBack = () => finish('declined');
    const onCancel = (e) => { e.preventDefault(); finish('declined'); };   // Esc key
    const onAbort = () => { cleanup(); sheet.close(); reject(signal.reason); };
    place.addEventListener('click', onPlace);
    back.addEventListener('click', onBack);
    sheet.addEventListener('cancel', onCancel);
    signal?.addEventListener('abort', onAbort, { once: true });
    function cleanup() {
      clearTimeout(armed);
      place.removeEventListener('click', onPlace);
      back.removeEventListener('click', onBack);
      sheet.removeEventListener('cancel', onCancel);
      signal?.removeEventListener('abort', onAbort);
    }
  });
}

export const formatNok = (amount) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(amount);
