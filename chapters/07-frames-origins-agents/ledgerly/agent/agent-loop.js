// A minimal in-page agent loop. The planner (a model) chooses; this code acts.
import { discoverTools } from './discover.js';
import { runTool } from './run-tool.js';

export function toFunctionDeclarations(catalog) {
  return [...catalog].map(([alias, tool]) => ({
    name: alias,
    description: `${tool.description} (provided by ${tool.origin})`,
    parameters: tool.inputSchema ?? { type: 'object', properties: {} },
  }));
}

export async function runAgent(goal, planner, { stop, maxSteps = 6, onStep = () => {} }) {
  const history = [{ role: 'user', text: goal }];
  for (let step = 0; step < maxSteps && !stop.aborted; step++) {
    const catalog = await discoverTools();          // tools can change between steps
    const decision = await planner.next({ history, tools: toFunctionDeclarations(catalog) });

    if (decision.answer !== undefined) {
      history.push({ role: 'agent', text: decision.answer });
      onStep({ type: 'answer', text: decision.answer });
      return history;
    }

    const tool = catalog.get(decision.call);
    const result = tool
      ? await runTool(tool, decision.args ?? {}, { stop })
      : { ok: false, reason: `no tool called ${decision.call}`, retryable: false };
    history.push({ role: 'tool', name: decision.call, result });
    onStep({ type: 'tool', name: decision.call, result });
  }
  return history;
}
