// A small driver for the WebMCP domain of the Chrome DevTools Protocol
// (experimental). Takes any CDP session with send() and on(), such as
// Playwright's CDPSession or Puppeteer's CDPSession.
export async function attachWebMCP(cdp) {
  const tools = new Map();        // name -> Tool, as DevTools reports it
  const calls = [];               // one record per invocation, for reports
  const waiting = new Map();      // invocationId -> resolve()
  const early = new Map();        // responses that beat the waiter

  cdp.on('WebMCP.toolsAdded', (e) => { for (const t of e.tools) tools.set(t.name, t); });
  cdp.on('WebMCP.toolsRemoved', (e) => { for (const t of e.tools) tools.delete(t.name); });
  cdp.on('WebMCP.toolInvoked', (e) => calls.push({ ...e, input: JSON.parse(e.input) }));
  cdp.on('WebMCP.toolResponded', (e) => {
    Object.assign(calls.find((c) => c.invocationId === e.invocationId) ?? {}, e);
    const resolve = waiting.get(e.invocationId);
    if (resolve) resolve(e); else early.set(e.invocationId, e);
  });
  await cdp.send('WebMCP.enable');  // replays toolsAdded for tools already registered

  async function start(name, input = {}, { timeout = 15_000 } = {}) {
    const tool = tools.get(name);
    if (!tool) throw new Error(`No WebMCP tool named "${name}"`);
    const { invocationId } = await cdp.send('WebMCP.invokeTool',
      { frameId: tool.frameId, toolName: name, input });
    const response = early.has(invocationId)
      ? Promise.resolve(early.get(invocationId))
      : new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`${name}: no response`)), timeout);
          waiting.set(invocationId, (e) => { clearTimeout(timer); resolve(e); });
        });
    return { invocationId, response };   // response: { status, output?, errorText?, exception? }
  }

  return {
    tools,
    calls,
    start,
    async invoke(name, input, options) {
      return (await start(name, input, options)).response;
    },
    cancel: (invocationId) => cdp.send('WebMCP.cancelInvocation', { invocationId }),
    async waitForTool(name, { timeout = 5_000 } = {}) {
      for (const end = Date.now() + timeout; !tools.has(name); ) {
        if (Date.now() > end) throw new Error(`Tool "${name}" never appeared`);
        await new Promise((r) => setTimeout(r, 50));
      }
      return tools.get(name);
    }
  };
}
