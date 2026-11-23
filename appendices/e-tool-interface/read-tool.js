export async function readTools() {
  const tools = await document.modelContext.getTools();
  const readable = [];
  for (const tool of tools) {
    // `null` means the registering document is gone. `??` would replace
    // that null with `window`. Remove the `window` fallback when Chrome
    // 160 reaches Stable (5 January 2027).
    const source = tool.source !== undefined ? tool.source : tool.window;
    if (source == null) continue;
    readable.push({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      origin: tool.origin,
      inputSchema: tool.inputSchema ?? null,
      outputSchema: tool.outputSchema ?? null,
      annotations: tool.annotations ?? null,
      source,
    });
  }
  return readable;
}
