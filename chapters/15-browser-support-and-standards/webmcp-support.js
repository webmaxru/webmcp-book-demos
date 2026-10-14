// webmcp-support.js: detect WebMCP without assuming which build you are on.
export function detectWebMCP(win = globalThis) {
  const doc = win.document;
  const mc = doc && 'modelContext' in doc ? doc.modelContext : null;
  const policy = doc?.permissionsPolicy ?? doc?.featurePolicy;
  const knowsTools = !!policy && policy.features().includes('tools');
  return {
    available: !!mc && typeof mc.registerTool === 'function',
    secureContext: !!win.isSecureContext,
    methods: mc
      ? ['registerTool', 'getTools', 'executeTool'].filter((m) => typeof mc[m] === 'function')
      : [],
    events: mc
      ? ['toolchange', 'toolactivated', 'toolcancel'].filter((e) => `on${e}` in mc)
      : [],
    // true or false when the browser knows the "tools" policy; null when it doesn't.
    policyAllows: knowsTools ? policy.allowsFeature('tools') : null,
    // A pre-May-2026 build exposed navigator.modelContext; see Appendix D.
    legacyNavigator: 'modelContext' in (win.navigator ?? {}),
  };
}

// Register tools only where the platform supports them; the page works either way.
export async function registerIfSupported(tools, { signal } = {}, win = globalThis) {
  const support = detectWebMCP(win);
  const registered = [];
  if (!support.available || support.policyAllows === false) return { registered, support };
  for (const tool of tools) {
    try {
      await win.document.modelContext.registerTool(tool, { signal });
      registered.push(tool.name);
    } catch (err) {
      console.warn(`WebMCP: "${tool.name}" was not registered (${err.name}: ${err.message})`);
    }
  }
  return { registered, support };
}
