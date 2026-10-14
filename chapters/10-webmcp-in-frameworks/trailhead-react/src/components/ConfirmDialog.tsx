import { usePendingConfirmation } from '../confirm-store';

export function ConfirmDialog() {
  const pending = usePendingConfirmation();
  if (!pending) return null;
  return (
    <div className="backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="dialog">
        <h2 id="confirm-title">{pending.title}</h2>
        <p>{pending.detail}</p>
        <div className="actions">
          <button type="button" onClick={() => pending.answer(false)}>Cancel</button>
          <button type="button" className="primary" onClick={() => pending.answer(true)}>Place order</button>
        </div>
      </div>
    </div>
  );
}
