// measure.ts: one wrapper, every outcome, no change to the tool itself.
// Chapter 11's four statuses for a call that fell short, plus two for a call that never returned.
export type Outcome =
  | 'ok' | 'error' | 'needs_input' | 'refused' | 'cancelled_by_user'
  | 'threw' | 'aborted';

const FELL_SHORT = new Set(['error', 'needs_input', 'refused', 'cancelled_by_user']);

export interface ToolCallRecord {
  tool: string;
  outcome: Outcome;
  code?: string;   // the result's stable code, e.g. 'OUT_OF_STOCK'
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
        // Chapter 11's convention: a call that falls short says so in `status`, with a `code`.
        const { status, code } = (result ?? {}) as { status?: string; code?: string };
        if (options.signal.aborted) done('aborted');
        else if (status && FELL_SHORT.has(status)) done(status as Outcome, code);
        else done('ok');
        return result;
      } catch (err) {
        done(options.signal.aborted ? 'aborted' : 'threw');
        throw err;
      }
    },
  };
}
