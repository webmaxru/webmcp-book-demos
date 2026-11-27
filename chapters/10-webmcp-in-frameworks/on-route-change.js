let controller;

export function onRouteChange(route) {
  // Unregister the previous route's tools.
  controller?.abort();
  controller = new AbortController();

  // allSettled, not all: one rejection must not end the wait early.
  const toolsUpdated = Promise.allSettled(route.tools.map((tool) =>
    document.modelContext.registerTool(tool, { signal: controller.signal })
  ));

  document.modelContext.waitForToolsUntil?.(toolsUpdated);
}
