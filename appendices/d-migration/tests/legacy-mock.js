// DEV-ONLY: a stand-in for the early-2026 navigator.modelContext shape, so the
// "before" listings can be exercised. Installed only when ?mock is in the URL.
if (window.legacyMock && !('modelContext' in navigator)) {
  const tools = new Map();
  const log = [];
  const client = {
    async requestUserInteraction(callback) { log.push('requestUserInteraction'); return callback(); }
  };
  const mc = {
    provideContext({ tools: list = [] } = {}) {
      tools.clear(); log.push('provideContext');
      for (const t of list) tools.set(t.name, t);
    },
    clearContext() { tools.clear(); log.push('clearContext'); },
    registerTool(t) {
      if (tools.has(t.name)) throw new DOMException('Duplicate tool name', 'InvalidStateError');
      tools.set(t.name, t); log.push('registerTool:' + t.name);
    },
    unregisterTool(name) { tools.delete(name); log.push('unregisterTool:' + name); },
    // test hooks
    _names: () => [...tools.keys()].sort(),
    _call: async (name, input) => JSON.stringify(await tools.get(name).execute(input, client)),
    _log: log
  };
  Object.defineProperty(Navigator.prototype, 'modelContext', { get: () => mc, configurable: true });
}
