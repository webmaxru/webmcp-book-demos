// adapter.js: the only file that knows the shape of the WebMCP API.
import { checkInput } from './check-input.js';

export function webmcpAvailable() {
  return typeof document !== 'undefined'
    && typeof document.modelContext?.registerTool === 'function';
}

export async function registerCatalog(catalog, { signal, exposedTo } = {}) {
  if (!webmcpAvailable()) return [];
  const registered = [];
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
    const options = { signal };
    if (exposedTo) options.exposedTo = exposedTo;
    await document.modelContext.registerTool(tool, options);
    registered.push(def.name);
  }
  return registered;
}
