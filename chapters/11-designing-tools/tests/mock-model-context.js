// DEV-ONLY: a minimal stand-in for document.modelContext, used by tests/run-tests.mjs
// in browsers without WebMCP (copied from the Chapter 6 demo folder). It follows the 14 October 2026 draft (toolactivated fires
// before execute; platform failures are NotFoundError / DataError / OperationError /
// AbortError). It is NOT part of the app and is never loaded by index.html.
(() => {
  if ('modelContext' in document) return;
  class ModelContextMock extends EventTarget {
    #tools = new Map();
    async registerTool(tool, { signal } = {}) {
      if (!/^[A-Za-z0-9_.-]{1,128}$/.test(tool.name ?? '')) throw new DOMException('bad name', 'InvalidStateError');
      if (!tool.description) throw new DOMException('empty description', 'InvalidStateError');
      if (this.#tools.has(tool.name)) throw new DOMException('duplicate name', 'InvalidStateError');
      if (signal?.aborted) throw signal.reason;
      const record = {
        name: tool.name, title: tool.title ?? '', description: tool.description,
        inputSchema: tool.inputSchema === undefined ? undefined : JSON.parse(JSON.stringify(tool.inputSchema)),
        annotations: tool.annotations ? {
          readOnlyHint: !!tool.annotations.readOnlyHint, untrustedContentHint: !!tool.annotations.untrustedContentHint,
          consequentialHint: !!tool.annotations.consequentialHint, debugging: !!tool.annotations.debugging } : undefined,
        execute: tool.execute
      };
      this.#tools.set(tool.name, record);
      signal?.addEventListener('abort', () => {
        if (this.#tools.get(tool.name) === record) { this.#tools.delete(tool.name); this.#change(); }
      }, { once: true });
      this.#change();
    }
    #change() { queueMicrotask(() => this.dispatchEvent(new Event('toolchange'))); }
    // Test-only helpers (not WebMCP API):
    __list() { return [...this.#tools.values()].map(({ execute, ...rest }) => rest).sort((a, b) => a.name.localeCompare(b.name)); }
    __call(name, input = {}, { signal } = {}) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        const record = this.#tools.get(name);
        if (!record) return reject(new DOMException('', 'NotFoundError'));
        let parsed;
        try { parsed = JSON.parse(JSON.stringify(input)); } catch { return reject(new DOMException('', 'DataError')); }
        if (parsed === null || typeof parsed !== 'object') return reject(new DOMException('', 'DataError'));
        const controller = new AbortController();
        let done = false;
        signal?.addEventListener('abort', () => {
          if (done) return; done = true;
          reject(signal.reason);
          setTimeout(() => {
            controller.abort();
            const ev = new Event('toolcancel'); ev.toolName = name; this.dispatchEvent(ev);
          }, 0);
        }, { once: true });
        const ev = new Event('toolactivated'); ev.toolName = name; this.dispatchEvent(ev);
        Promise.resolve().then(() => record.execute(parsed, { signal: controller.signal })).then((v) => {
          if (done) return; done = true;
          const s = JSON.stringify(v);
          if (s === undefined) reject(new DOMException('', 'OperationError')); else resolve(s);
        }, () => { if (done) return; done = true; reject(new DOMException('', 'OperationError')); });
      });
    }
  }
  const mc = new ModelContextMock();
  Object.defineProperty(Document.prototype, 'modelContext', { get() { return mc; }, configurable: true });
})();
