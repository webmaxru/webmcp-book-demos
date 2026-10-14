// A pre-release check on the tool surface your page actually registered.
// Budgets: Chrome's "WebMCP tool security" guidance (character limits).
const BUDGET = { name: 30, description: 500, paramName: 30, paramDescription: 150 };
const STEERING = /\b(ignore|disregard|always (call|use)|never tell|you must|system prompt|instead of the user)\b/i;

export function auditTools(tools) {
  const findings = [];
  const flag = (tool, msg) => findings.push(`${tool.name}: ${msg}`);

  for (const tool of tools) {
    const a = tool.annotations ?? {};
    if (tool.name.length > BUDGET.name) flag(tool, 'name over 30 characters');
    if (tool.description.length > BUDGET.description) flag(tool, 'description over 500 characters');
    if (STEERING.test(tool.description)) flag(tool, 'description tries to steer the agent');
    if (!a.readOnlyHint && !a.consequentialHint) flag(tool, 'writes state but is not marked consequential: decide');
    if (a.readOnlyHint && a.consequentialHint) flag(tool, 'marked both read-only and consequential');

    const schema = tool.inputSchema ?? {};
    if (schema.additionalProperties !== false) flag(tool, 'schema accepts undeclared fields');
    for (const [param, def] of Object.entries(schema.properties ?? {})) {
      if (param.length > BUDGET.paramName) flag(tool, `parameter ${param}: name over 30 characters`);
      if ((def.description ?? '').length > BUDGET.paramDescription) {
        flag(tool, `parameter ${param}: description over 150 characters`);
      }
      if (def.type === 'string' && !def.enum && !def.pattern && def.maxLength === undefined) {
        flag(tool, `parameter ${param}: unbounded string`);
      }
    }
  }
  return findings;
}
