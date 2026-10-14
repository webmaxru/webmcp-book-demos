// Service worker: keeps the latest tool list per frame, runs tools on request.
const frames = new Map();   // "tabId:frameId" -> { origin, tools }

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'tools') return;
  frames.set(`${sender.tab.id}:${sender.frameId}`, {
    origin: msg.origin, tools: msg.tools ?? [], error: msg.error,
  });
});

// Called by the extension's own UI (a side panel, say) with a user's request.
async function runTool(tabId, frameId, name, args) {
  return chrome.tabs.sendMessage(tabId, { type: 'execute', name, args }, { frameId });
}

self.toolInspector = { frames, runTool };
