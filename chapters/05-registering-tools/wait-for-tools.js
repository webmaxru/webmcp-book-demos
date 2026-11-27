// Pass a promise that is still pending. Promise.all() would reject on the
// first failure and end the wait while other registerTool() calls are running.
export function registerToolsWhenReady(tools, signal) {
  const batch = new AbortController();
  const batchSignal = signal ? AbortSignal.any([signal, batch.signal]) : batch.signal;
  const toolsUpdated = (async () => {
    const results = await Promise.allSettled(tools.map((tool) =>
      document.modelContext.registerTool(tool, { signal: batchSignal })
    ));
    if (results.some((result) => result.status === 'rejected')) {
      batch.abort();
    }
    return results;
  })();
  document.modelContext.waitForToolsUntil?.(toolsUpdated);
  return toolsUpdated;
}
