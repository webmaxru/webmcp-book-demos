// dev/model-context-mock.js: a tiny stand-in for document.modelContext, for tests only.
// NOT part of the app. index.html never loads it. The test harness injects it before
// any page script runs, so the app sees 'modelContext' in document and registers its tools.
//
// It follows the 13 Oct 2026 draft closely enough to test against:
//   registerTool(tool, { signal })  name rules, duplicate names, AbortSignal unregistration,
//                                   resolves to undefined, fires 'toolchange'
//   getTools()                      [{ name, title, description, inputSchema, window, origin, annotations }]
//   executeTool(tool, input, { signal })
//                                   input goes through JSON; result = JSON.stringify(value);
//                                   NotFoundError / DataError / OperationError as in the draft;
//                                   the caller's abort rejects with its abort reason
// It is a mock, not a polyfill: no permissions policy, no exposedTo, no frames.
(() => {
  if ('modelContext' in document) return;   // a real implementation wins

  const NAME = /^[A-Za-z0-9_.\-]{1,128}$/;
  const tools = new Map();                   // name -> { tool, schemaJSON }
  const calls = [];                          // a log for tests: { name, input, result | error }

  class ModelContextMock extends EventTarget {
    async registerTool(tool, options = {}) {
      const { signal } = options;
      if (signal?.aborted) throw signal.reason;
      if (!tool || typeof tool.name !== 'string' || typeof tool.description !== 'string'
          || typeof tool.execute !== 'function') {
        throw new TypeError('registerTool: name, description and execute are required');
      }
      if (!NAME.test(tool.name)) throw new DOMException(`Invalid tool name "${tool.name}"`, 'InvalidStateError');
      if (tool.description === '') throw new DOMException('Empty description', 'InvalidStateError');
      if (tools.has(tool.name)) throw new DOMException(`Duplicate tool name "${tool.name}"`, 'InvalidStateError');
      const schemaJSON = tool.inputSchema === undefined ? '' : JSON.stringify(tool.inputSchema);
      tools.set(tool.name, { tool, schemaJSON });
      this.dispatchEvent(new Event('toolchange'));
      signal?.addEventListener('abort', () => {
        if (tools.get(tool.name)?.tool === tool) {
          tools.delete(tool.name);
          this.dispatchEvent(new Event('toolchange'));
        }
      }, { once: true });
      return undefined;
    }

    async getTools() {
      return [...tools.values()].map(({ tool, schemaJSON }) => ({
        name: tool.name, title: tool.title ?? '', description: tool.description,
        ...(schemaJSON ? { inputSchema: JSON.parse(schemaJSON) } : {}),
        window, origin: location.origin, annotations: { ...(tool.annotations ?? {}) }
      }));
    }

    async executeTool(registeredTool, input = {}, options = {}) {
      // Like Web IDL dictionary conversion: a RegisteredTool needs name and description.
      if (typeof registeredTool?.name !== 'string' || typeof registeredTool?.description !== 'string') {
        throw new TypeError("executeTool: pass a tool from getTools() (name and description are required)");
      }
      const name = registeredTool.name;
      const entry = tools.get(name);
      if (!entry) throw new DOMException(`No tool named "${name}"`, 'NotFoundError');
      let inputObject;
      try { inputObject = JSON.parse(JSON.stringify(input ?? {})); } catch { inputObject = null; }
      if (inputObject === null || typeof inputObject !== 'object' || Array.isArray(inputObject)) {
        throw new DOMException('Invalid input', 'DataError');
      }
      if (options.signal?.aborted) throw options.signal.reason;
      this.dispatchEvent(Object.assign(new Event('toolactivated'), { toolName: name }));
      // As in the draft: the caller's abort rejects executeTool() with the abort reason
      // and cancels the pending execution (the tool's own signal aborts).
      const controller = new AbortController();
      const callerAborted = new Promise((_, reject) => options.signal?.addEventListener('abort', () => {
        controller.abort(options.signal.reason);
        reject(options.signal.reason);
      }, { once: true }));
      callerAborted.catch(() => {});
      let value;
      try {
        value = await Promise.race([entry.tool.execute(inputObject, { signal: controller.signal }), callerAborted]);
      } catch (err) {
        if (options.signal?.aborted) throw options.signal.reason;
        calls.push({ name, input: inputObject, error: String(err && err.name) });
        throw new DOMException('Tool rejected', 'OperationError');
      }
      let json;
      try { json = JSON.stringify(value); } catch { json = undefined; }
      if (json === undefined) {
        calls.push({ name, input: inputObject, error: 'unserializable result' });
        throw new DOMException('Unserializable result', 'OperationError');
      }
      calls.push({ name, input: inputObject, result: json });
      return json;
    }
  }

  const mc = new ModelContextMock();
  Object.defineProperty(Document.prototype, 'modelContext', { configurable: true, get: () => mc });
  window.__webmcpMock = { calls, tools };
})();
