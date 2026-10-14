import { useEffect, useLayoutEffect, useRef } from 'react';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: WebMCP.ToolAnnotations;
  execute: (input: Record<string, unknown>, options: { signal: AbortSignal }) => unknown;
}

// What a WebMCP hook has to do, in about thirty lines.
export function useAgentTool(tool: AgentTool, enabled = true): void {
  // ① Keep the latest render's tool, so calls see current props and state.
  const latest = useRef(tool);
  useLayoutEffect(() => { latest.current = tool; });

  // ② Re-register only when what the agent reads changes.
  const metadata = JSON.stringify([tool.name, tool.description, tool.inputSchema, tool.annotations]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!enabled || !modelContext) return;          // ③ progressive enhancement
    const { name, description, inputSchema, annotations } = latest.current;
    const controller = new AbortController();
    modelContext
      .registerTool(
        { name, description, inputSchema, annotations,
          execute: (input, options) => latest.current.execute(input as Record<string, unknown>, options) },
        { signal: controller.signal },
      )
      .catch((error: unknown) => {
        if (!controller.signal.aborted) console.warn(`registerTool("${name}") failed`, error);
      });
    return () => controller.abort();                // ④ unmount or change: unregister
  }, [metadata, enabled]);
}
