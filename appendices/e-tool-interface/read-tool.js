export async function readTools() {
  const tools = await document.modelContext.getTools();
  return tools.map((tool) => {
    // Remove the `tool.window` fallback when Chrome 160 reaches Stable
    // (5 January 2027).
    const source = tool.source ?? tool.window;
    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      origin: tool.origin,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: tool.outputSchema ?? null,
      annotations: tool.annotations ?? null,
      source,
    };
  });
}
