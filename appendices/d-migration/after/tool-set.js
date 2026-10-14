// AFTER: the useful half of provideContext(), "swap this view's tools",
// without the dangerous half. It can only remove tools it registered itself.
export function createToolSet(modelContext = document.modelContext) {
  let current = null;
  return {
    async replace(tools) {
      current?.abort();                        // drop the previous set (ours only)
      current = new AbortController();
      const { signal } = current;
      await Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal })));
    },
    clear() {
      current?.abort();
      current = null;
    }
  };
}
