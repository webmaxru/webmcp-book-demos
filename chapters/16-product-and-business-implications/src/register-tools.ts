// register-tools.ts: the catalog decides what agents see; code supplies behaviour.
import { toolCatalog, type ToolName } from './tool-catalog.js';
import { withMeasurement, type ToolCallRecord } from './measure.js';
import { noteAgentAssist } from './attribution.js';
import { schemas, handlers } from './trailhead-tools.js';   // the store's own code
import { analytics } from './analytics.js';

function report(record: ToolCallRecord) {
  analytics.send('webmcp_tool_call', record);
  if (record.outcome === 'ok') noteAgentAssist(record.tool);
}

export async function registerTrailheadTools(signal: AbortSignal): Promise<void> {
  const modelContext = document.modelContext;
  if (!modelContext) return;                 // progressive enhancement: no WebMCP, no tools
  for (const entry of toolCatalog) {
    const name: ToolName = entry.name;
    const tool: WebMCP.ModelContextTool = {
      name,
      title: entry.title,
      description: entry.description,
      inputSchema: schemas[name],
      annotations: entry.annotations,
      // Delegate, so the store can swap a handler without re-registering.
      execute: (input, options) => handlers[name](input, options),
    };
    await modelContext.registerTool(withMeasurement(tool, report), { signal });
  }
}
