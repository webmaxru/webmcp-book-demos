import { useSyncExternalStore } from 'react';

export interface PendingConfirmation {
  id: number;
  title: string;
  detail: string;
  answer: (confirmed: boolean) => void;
}

let pending: PendingConfirmation | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((notify) => notify());

// Ask the person, in the page's own UI, and wait for their click.
// The question lives here, not in a route component, so it survives navigation.
export function requestConfirmation(title: string, detail: string, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    pending?.answer(false);                // only one question on screen at a time
    const id = nextId++;
    const close = () => {
      signal.removeEventListener('abort', onAbort);
      if (pending?.id === id) { pending = null; emit(); }
    };
    const onAbort = () => { close(); reject(signal.reason); };
    signal.addEventListener('abort', onAbort, { once: true });
    pending = { id, title, detail, answer: (confirmed) => { close(); resolve(confirmed); } };
    emit();
  });
}

export function usePendingConfirmation(): PendingConfirmation | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => pending,
  );
}
