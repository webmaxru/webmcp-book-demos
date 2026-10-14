// Real-user measurement for WebMCP tools: wrap execute() to record how each
// call ended and how long it took. No inputs or outputs leave the page.
export function instrumentTool(tool, report, { failureCode = (r) => r?.error } = {}) {
  const execute = tool.execute;
  return {
    ...tool,
    async execute(input, options) {
      const started = performance.now();
      const event = { tool: tool.name, outcome: 'ok', page: location.pathname };
      try {
        const result = await execute.call(tool, input, options);
        const code = failureCode(result);                  // a failure returned as a value
        if (code) Object.assign(event, { outcome: 'recoverable', code: String(code) });
        return result;
      } catch (err) {
        event.outcome = options.signal.aborted ? 'aborted' : 'thrown';
        event.code = err?.name ?? 'Error';
        throw err;
      } finally {
        event.ms = Math.round(performance.now() - started);
        report(event);
      }
    }
  };
}

// One way to report: batch events and send them when the page is hidden.
export function beaconReporter(url) {
  const queue = [];
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && queue.length)
      navigator.sendBeacon(url, JSON.stringify(queue.splice(0)));
  });
  return (event) => queue.push({ ...event, at: Date.now() });
}
