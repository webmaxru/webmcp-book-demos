// Unit tests for Trailhead's execute callbacks. No browser, no WebMCP:
// node --test tests/trailhead-tools.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrailheadTools } from '../trailhead-tools.js';
import { fakeCatalog, fakeCart, recordingUi } from './fixtures/fakes.js';

function setup() {
  const catalog = fakeCatalog();
  const ui = recordingUi();
  const [search, addToCart] = createTrailheadTools({ catalog, cart: fakeCart(), ui });
  return { catalog, ui, search, addToCart };
}
const run = (tool, input, signal = new AbortController().signal) =>
  tool.execute(input, { signal });

test('search_products returns NOK prices and shows the same results', async () => {
  const { search, ui } = setup();
  const { products } = await run(search, { query: 'tent', maxPrice: 3000 });
  assert.ok(products.length > 0);
  for (const p of products) {
    assert.equal(p.price.currency, 'NOK');
    assert.ok(p.price.amount <= 3000);
  }
  assert.equal(ui.calls.at(-1)[0], 'showResults');           // the user sees it too
});

test('input the schema forbids comes back as a value, not a throw', async () => {
  const { search, catalog } = setup();
  for (const input of [{}, { query: '' }, { query: 'tent', maxPrice: '3000' },
                       { query: 'tent', category: 'kayaks' }]) {
    const result = await run(search, input);
    assert.equal(result.status, 'error', JSON.stringify(input));
    assert.equal(result.code, 'INVALID_ARGUMENT');
    assert.match(result.message, /must/);                    // tells the agent how to fix it
  }
  assert.equal(catalog.searches, 0);                         // never reached the backend
});

test('add_to_cart explains a stock problem the agent can act on', async () => {
  const { addToCart } = setup();
  const result = await run(addToCart, { sku: 'TH-TENT-2P', quantity: 9 });
  assert.equal(result.status, 'refused');
  assert.equal(result.code, 'OUT_OF_STOCK');
  assert.equal(result.available, 3);
});

test('an aborted call stops before touching the backend', async () => {
  const { search, catalog } = setup();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(run(search, { query: 'tent' }, controller.signal),
                       { name: 'AbortError' });
  assert.equal(catalog.searches, 0);
});
