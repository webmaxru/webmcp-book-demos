// adapter.js: the only file that knows the shape of the WebMCP API.
import { checkInput } from './check-input.js';

export function webmcpAvailable() {
  return typeof document !== 'undefined'
    && typeof document.modelContext?.registerTool === 'function';
}

export function registerCatalog(catalog, { signal, exposedTo } = {}) {
  if (!webmcpAvailable()) return Promise.resolve([]);
  // Callers await done. registerBatch aborts the batch before that promise rejects.
  const done = registerBatch(catalog, { signal, exposedTo });
  // A synchronous InvalidStateError or NotAllowedError must not skip the return.
  try {
    document.modelContext.waitForToolsUntil?.(done);
  } catch (err) {
    if (err?.name !== 'InvalidStateError' && err?.name !== 'NotAllowedError') throw err;
  }
  return done;
}

async function registerBatch(catalog, { signal, exposedTo } = {}) {
  // All or nothing: if one registration fails, the ones before it are rolled back.
  const batch = new AbortController();
  const batchSignal = signal ? AbortSignal.any([signal, batch.signal]) : batch.signal;
  const registered = [];
  try {
    for (const def of catalog) {
      const tool = {
        name: def.name,
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
        outputSchema: def.outputSchema,
        annotations: def.annotations,
        async execute(input, { signal: callSignal } = {}) {
          // The browser does not check input against inputSchema. We do.
          const problems = checkInput(def.inputSchema, input);
          if (problems.length > 0) {
            return { status: 'error', code: 'INVALID_ARGUMENT', message: problems.join('; ') };
          }
          return def.run(input, { signal: callSignal });
        },
      };
      const options = { signal: batchSignal };
      if (exposedTo) options.exposedTo = exposedTo;
      await document.modelContext.registerTool(tool, options);
      registered.push(def.name);
    }
  } catch (err) {
    batch.abort();
    throw err;
  }
  return registered;
}
