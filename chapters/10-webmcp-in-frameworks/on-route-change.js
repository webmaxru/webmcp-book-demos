let controller;

export function onRouteChange(route) {
  // Unregister the previous route's tools.
  controller?.abort();
  controller = new AbortController();

  // allSettled, not all: one rejection must not end the wait early.
  // A rejected registerTool() leaves the tools that succeeded.
  const toolsUpdated = Promise.allSettled(route.tools.map((tool) =>
    document.modelContext.registerTool(tool, { signal: controller.signal })
  ));

  // A synchronous InvalidStateError or NotAllowedError must not skip the return.
  try {
    document.modelContext.waitForToolsUntil?.(toolsUpdated);
  } catch (err) {
    if (err?.name !== 'InvalidStateError' && err?.name !== 'NotAllowedError') throw err;
  }
  return toolsUpdated;
}
