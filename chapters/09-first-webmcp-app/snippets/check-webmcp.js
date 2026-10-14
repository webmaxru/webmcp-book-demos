// Paste into the DevTools console on the page you are working on.
({
  secureContext: window.isSecureContext,
  webmcp: 'modelContext' in document,
  registerTool: typeof document.modelContext?.registerTool,
  getTools: typeof document.modelContext?.getTools,
  toolsPolicy: document.featurePolicy?.allowsFeature('tools') ?? 'unknown'
})
