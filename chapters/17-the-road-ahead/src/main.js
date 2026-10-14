// main.js (filler, not a listing): the test page's start-up code.
import { catalog } from './catalog.js';
import { registerCatalog } from './adapter.js';

const controller = new AbortController();
window.__trailhead = { ready: false, registered: [], unregister: () => controller.abort() };
registerCatalog(catalog, { signal: controller.signal })
  .then((names) => { window.__trailhead.registered = names; })
  .catch((err) => { window.__trailhead.error = `${err.name}: ${err.message}`; })
  .finally(() => { window.__trailhead.ready = true; });
