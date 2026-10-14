// DEV/TEST ONLY: a same-document stand-in for document.modelContext, used to unit-test
// the agent loop in browsers without WebMCP. It does not model frames, origins or
// Permissions Policy (the Chromium tests cover those). Never ship this.
(() => {
  if ('modelContext' in document) return;
  const tools = new Map();
  const target = new EventTarget();
  const mc = Object.assign(target, {
    async registerTool(tool, { signal } = {}) {
      if (tools.has(tool.name)) throw new DOMException('duplicate', 'InvalidStateError');
      tools.set(tool.name, tool);
      signal?.addEventListener('abort', () => { tools.delete(tool.name); target.dispatchEvent(new Event('toolchange')); });
      target.dispatchEvent(new Event('toolchange'));
    },
    async getTools() {
      return [...tools.values()].sort((a, b) => (a.name < b.name ? -1 : 1)).map((t) => ({
        name: t.name, title: t.title ?? '', description: t.description,
        inputSchema: t.inputSchema && JSON.parse(JSON.stringify(t.inputSchema)),
        window, origin: location.origin,
        annotations: { readOnlyHint: false, untrustedContentHint: false, consequentialHint: false, debugging: false, ...t.annotations },
      }));
    },
    async executeTool(rt, input = {}, { signal } = {}) {
      const tool = tools.get(rt.name);
      if (!tool) throw new DOMException('not found', 'NotFoundError');
      if (signal?.aborted) throw signal.reason;
      const ac = new AbortController();
      const run = Promise.resolve()
        .then(() => tool.execute(JSON.parse(JSON.stringify(input)), { signal: ac.signal }))
        .then((v) => (typeof v === 'string' ? v : JSON.stringify(v)), () => { throw new DOMException('tool failed', 'UnknownError'); });
      if (!signal) return run;
      return Promise.race([run, new Promise((_, reject) => signal.addEventListener('abort', () => { ac.abort(signal.reason); reject(signal.reason); }, { once: true }))]);
    },
  });
  Object.defineProperty(Document.prototype, 'modelContext', { get: () => mc, configurable: true });
})();
