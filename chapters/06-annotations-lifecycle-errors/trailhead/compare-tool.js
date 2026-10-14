import { catalog } from './store.js';
import { tracked } from './tool-lifecycle.js';

const PAGE_DEADLINE_MS = 8000;   // Trailhead's own limit, independent of the agent

export function registerCompareTool(signal) {
  return document.modelContext.registerTool({
    name: 'compare_products',
    title: 'Compare products',
    description:
      'Compare 2 to 4 products side by side: price, weight, season rating, ' +
      'customer rating and stock. Use SKUs from search_products. Can take a few ' +
      'seconds; may return a partial comparison if some details are slow.',
    inputSchema: {
      type: 'object',
      properties: {
        skus: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 }
      },
      required: ['skus']
    },
    annotations: { readOnlyHint: true },
    execute: tracked('compare_products', async ({ skus }, { signal }) => {
      if (!Array.isArray(skus) || skus.length < 2 || skus.length > 4) {
        return { status: 'invalid_input', message: 'Provide 2 to 4 SKUs in "skus".' };
      }
      const unknown = skus.filter((sku) => !catalog.get(sku));
      if (unknown.length) {
        return { status: 'unknown_sku', unknown, message: 'Use search_products to find valid SKUs.' };
      }
      // Stop when the caller cancels (signal) or when our own deadline passes.
      const stop = AbortSignal.any([signal, AbortSignal.timeout(PAGE_DEADLINE_MS)]);  // ①
      const settled = await Promise.allSettled(skus.map((sku) => catalog.specs(sku, stop)));
      signal.throwIfAborted();          // cancelled: nobody will read a result ②
      const rows = [], missing = [];
      settled.forEach((r, i) => (r.status === 'fulfilled' ? rows.push(r.value) : missing.push(skus[i])));
      if (rows.length === 0) {
        return { status: 'unavailable', message: 'Product details did not load in time. Try again shortly.' };
      }
      return { status: missing.length ? 'partial' : 'complete', rows, missing };  // ③
    })
  }, { signal });
}
