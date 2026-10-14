import { cart } from './store.js';

// Call this only in development builds, e.g. behind import.meta.env.DEV in Vite.
export async function registerDebugTools(signal) {
  await document.modelContext.registerTool({
    name: 'debug_dump_cart_state',
    title: 'Dump cart state (developers)',
    description:
      'Developer tool. Returns the raw cart store with internal line IDs and ' +
      'timestamps, for debugging Trailhead. Not useful for shopping tasks.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, debugging: true },
    execute: () => ({ raw: cart.debugState() })
  }, { signal });
}
