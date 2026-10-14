// measure.ts: one wrapper, four outcomes, no change to the tool itself.
export type Outcome = 'ok' | 'recoverable' | 'error' | 'cancelled';

export interface ToolCallRecord {
  tool: string;
  outcome: Outcome;
  code?: string;   // the recoverable error's code, e.g. 'out_of_stock'
  ms: number;
}

export function withMeasurement(
  tool: WebMCP.ModelContextTool,
  report: (record: ToolCallRecord) => void,
): WebMCP.ModelContextTool {
  return {
    ...tool,
    async execute(input, options) {
      const started = performance.now();
      const done = (outcome: Outcome, code?: string) =>
        report({ tool: tool.name, outcome, code, ms: Math.round(performance.now() - started) });
      try {
        const result = await tool.execute(input, options);
        // Trailhead's convention: recoverable failures come back as { error: { code } }.
        const error = (result as { error?: { code?: string } } | null)?.error;
        if (options.signal.aborted) done('cancelled');
        else if (error) done('recoverable', error.code);
        else done('ok');
        return result;
      } catch (err) {
        done(options.signal.aborted ? 'cancelled' : 'error');
        throw err;
      }
    },
  };
}
