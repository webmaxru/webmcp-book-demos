// Runs in every matching frame, in the extension's isolated world.
// It shares the frame's DOM and origin, so it sees the frame's own tools.

// `null` means the registering document is gone. `??` would replace that
// null with `window`. Remove the fallback when Chrome 160 reaches Stable
// (5 January 2027).
function toolSource(tool) {
  return tool.source !== undefined ? tool.source : tool.window;
}

async function report() {
  if (!('modelContext' in document)) return;
  try {
    const tools = await document.modelContext.getTools();
    chrome.runtime.sendMessage({
      type: 'tools',
      origin: location.origin,
      tools: tools
        .filter((t) => toolSource(t) === window)
        .map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema ?? null,
          annotations: t.annotations ?? null,
        })),
    });
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'tools', origin: location.origin, error: err.name });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== 'execute') return;
  (async () => {
    const tools = await document.modelContext.getTools();
    const tool = tools.find((t) => t.name === msg.name && toolSource(t) === window);
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
