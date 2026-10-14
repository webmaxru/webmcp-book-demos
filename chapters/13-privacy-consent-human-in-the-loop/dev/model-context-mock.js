// dev/model-context-mock.js: a tiny stand-in for document.modelContext (dev/test only, never shipped).
// Single-document only: it records registrations, fires toolchange/toolactivated and runs execute();
// it does not model frames, exposedTo or cancellation events.
(() => {
  if ('modelContext' in document) return;
  const tools = new Map();
  class ModelContext extends EventTarget {
    async registerTool(tool, options = {}) {
      if (!tool.name || !tool.description) throw new DOMException('bad tool', 'InvalidStateError');
      if (tools.has(tool.name)) throw new DOMException('duplicate', 'InvalidStateError');
      if (options.signal?.aborted) throw options.signal.reason;
      tools.set(tool.name, { tool, options });
      queueMicrotask(() => this.dispatchEvent(new Event('toolchange')));
      options.signal?.addEventListener('abort', () => { tools.delete(tool.name); this.dispatchEvent(new Event('toolchange')); }, { once: true });
    }
    async getTools() {
      return [...tools.values()].map(({ tool }) => ({
        name: tool.name, title: tool.title, description: tool.description,
        inputSchema: structuredClone(tool.inputSchema), annotations: { ...tool.annotations },
        window, origin: location.origin }));
    }
    async executeTool(t, input = {}, { signal } = {}) {
      const entry = tools.get(t.name);
      if (!entry) throw new DOMException('no tool', 'NotFoundError');
      const s = signal ?? new AbortController().signal;
      const ev = new Event('toolactivated'); ev.toolName = t.name; this.dispatchEvent(ev);
      const r = await entry.tool.execute(JSON.parse(JSON.stringify(input)), { signal: s });
      return typeof r === 'string' ? r : JSON.stringify(r);
    }
    _options(name) { return tools.get(name)?.options; }
  }
  window.ModelContext = ModelContext;
  const mc = new ModelContext();
  Object.defineProperty(Document.prototype, 'modelContext', { get: () => mc, configurable: true });
})();
