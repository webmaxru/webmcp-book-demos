// Runs in every matching frame, in the extension's isolated world.
// It shares the frame's DOM and origin, so it sees the frame's own tools.
async function report() {
  if (!('modelContext' in document)) return;
  try {
    const tools = await document.modelContext.getTools();
    chrome.runtime.sendMessage({
      type: 'tools',
      origin: location.origin,
      tools: tools
        .filter((t) => t.window === window)      // this frame's tools only
        .map(({ name, description, inputSchema, annotations }) =>
          ({ name, description, inputSchema, annotations })),
    });
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'tools', origin: location.origin, error: err.name });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== 'execute') return;
  (async () => {
    const tools = await document.modelContext.getTools();
    const tool = tools.find((t) => t.name === msg.name && t.window === window);
    if (!tool) return reply({ error: 'NotFound' });
    try {
      reply({ result: await document.modelContext.executeTool(tool, msg.args) });
    } catch (err) {
      reply({ error: err.name });
    }
  })();
  return true;   // we will reply asynchronously
});

document.modelContext?.addEventListener('toolchange', report);
report();
