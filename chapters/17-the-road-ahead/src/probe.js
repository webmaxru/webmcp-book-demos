// probe.js: what does this browser's WebMCP actually support today?
// Run it on a test page in CI, once per browser release. Not for production pages.
export async function probeWebMCP() {
  const mc = globalThis.document?.modelContext;
  const report = {
    documentModelContext: Boolean(mc),
    legacyNavigatorModelContext: 'modelContext' in (globalThis.navigator ?? {}),
    getTools: typeof mc?.getTools === 'function',
    executeTool: typeof mc?.executeTool === 'function',
    resumeTool: typeof mc?.resumeTool === 'function',   // continuations explainer
    outputSchemaReflected: null,
    annotationsKept: null,
    executeOptions: null,
  };
  if (!report.documentModelContext || !report.getTools || !report.executeTool) {
    return report;
  }
  const controller = new AbortController();
  const name = `probe_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await mc.registerTool({
      name,
      description: 'Feature probe for tests. Returns the option names it receives.',
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: { options: { type: 'array' } } },
      annotations: { readOnlyHint: true, sensitiveHint: false },
      execute: async (_input, options = {}) => ({ options: Object.keys(options) }),
    }, { signal: controller.signal });
    const tool = (await mc.getTools()).find((t) => t.name === name);
    report.outputSchemaReflected = 'outputSchema' in tool;
    report.annotationsKept = Object.keys(tool.annotations ?? {}).sort();
    const raw = await mc.executeTool(tool, {});
    report.executeOptions = (typeof raw === 'string' ? JSON.parse(raw) : raw).options;
  } finally {
    controller.abort();
  }
  return report;
}
