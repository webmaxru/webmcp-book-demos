// AFTER: the useful half of provideContext(), "swap this view's tools",
// without the dangerous half. It can only remove tools it registered itself,
// and it registers each set all or nothing.
export function createToolSet(modelContext = document.modelContext) {
  let current = null;
  return {
    async replace(tools) {
      current?.abort();                        // drop the previous set (ours only)
      const controller = new AbortController();
      current = controller;
      try {
        await Promise.all(tools.map((tool) =>
          modelContext.registerTool(tool, { signal: controller.signal })));
      } catch (err) {
        controller.abort();                    // roll back the tools that did register
        if (current === controller) current = null;
        throw err;
      }
    },
    clear() {
      current?.abort();
      current = null;
    }
  };
}
