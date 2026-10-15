// Real-user measurement for WebMCP tools: wrap execute() to record how each
// call ended and how long it took. No inputs or outputs leave the page.

// Chapter 11's statuses for a call that returned without doing what was asked.
const FELL_SHORT = ['error', 'refused', 'needs_input', 'cancelled_by_user'];

export function instrumentTool(tool, report) {
  const execute = tool.execute;
  return {
    ...tool,
    async execute(input, options) {
      const started = performance.now();
      const event = { tool: tool.name, outcome: 'ok', page: location.pathname };
      try {
        const result = await execute.call(tool, input, options);
        if (FELL_SHORT.includes(result?.status))           // a failure returned as a value
          Object.assign(event, { outcome: result.status, code: result.code ?? null });
        return result;
      } catch (err) {
        event.outcome = options.signal.aborted ? 'aborted' : 'threw';
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
