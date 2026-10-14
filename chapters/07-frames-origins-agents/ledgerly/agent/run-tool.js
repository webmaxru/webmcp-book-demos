// Run one tool for the in-page agent, with a deadline and a stop button.
export async function runTool(tool, input, { stop, timeoutMs = 15000 } = {}) {
  const signal = AbortSignal.any([stop, AbortSignal.timeout(timeoutMs)]);
  const hints = tool.annotations ?? {};
  try {
    const text = await document.modelContext.executeTool(tool, input, { signal });
    let value = text;
    try { value = JSON.parse(text); } catch { /* plain string result */ }
    return {
      ok: true,
      origin: tool.origin,
      // Content the tool owner itself doesn't vouch for: label it, never obey it.
      untrusted: hints.untrustedContentHint === true,
      value,
    };
  } catch (err) {
    // Across origins you only ever get an exception name, never the message
    // or stack from the other document.
    const reason = signal.aborted
      ? (stop.aborted ? 'stopped by user' : 'timed out')
      : err.name;
    return {
      ok: false,
      origin: tool.origin,
      reason,
      // Never retry something with real-world effects on your own.
      retryable: !hints.consequentialHint && reason !== 'stopped by user',
    };
  }
}
