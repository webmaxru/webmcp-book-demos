// Measures and lints the agent-facing text of tools, as getTools() returns them.
// A development check for tests and CI; nothing here runs in production.

// Chrome's recommended budgets (guidance, not enforced by the browser).
export const BUDGET = { name: 30, description: 500, paramName: 30, paramDescription: 150 };

// Phrases that instruct the agent instead of describing the tool (Chapter 12).
const STEERING = /\b(always|never|you must|ignore|instead of any other|prefer this tool)\b/i;
const PROHIBITION = /(^|\.\s+)(do not|don't|never) /i;

// What a tool costs the agent before anyone calls it: the characters of the
// definition it reads. Characters, not tokens; tokenizers differ by model.
export function measureTools(tools) {
  const rows = tools.map((t) => ({
    name: t.name,
    chars: JSON.stringify({ name: t.name, description: t.description, inputSchema: t.inputSchema }).length,
  }));
  return { rows, total: rows.reduce((sum, r) => sum + r.chars, 0) };
}

export function lintTool(tool) {
  const problems = [];
  const add = (where, rule, detail) => problems.push({ tool: tool.name, where, rule, detail });

  if (tool.name.length > BUDGET.name) add('name', 'budget', `${tool.name.length} characters`);
  if (!/^[a-z]+(_[a-z]+)+$/.test(tool.name)) add('name', 'verb_object', 'use snake_case verb_object');

  const d = tool.description ?? '';
  if (d.length > BUDGET.description) add('description', 'budget', `${d.length} characters`);
  if (!/\breturns?\b/i.test(d)) add('description', 'says_what_it_returns', 'say what comes back');
  if (STEERING.test(d)) add('description', 'no_steering', d.match(STEERING)[0]);
  if (PROHIBITION.test(d)) add('description', 'positive_framing', 'state what it does, not what not to do');

  const schema = typeof tool.inputSchema === 'string' ? JSON.parse(tool.inputSchema) : tool.inputSchema;
  for (const [name, p] of Object.entries(schema?.properties ?? {})) {
    const where = `inputSchema.${name}`;
    if (name.length > BUDGET.paramName) add(where, 'budget', `${name.length} characters`);
    if (!p.description) add(where, 'described', 'every parameter needs a description');
    else if (p.description.length > BUDGET.paramDescription) add(where, 'budget', `${p.description.length} characters`);
    const values = p.enum ?? p.oneOf?.map((o) => o.const) ?? [];
    if (values.includes('')) add(where, 'no_empty_enum', 'make the parameter optional instead');
    if (values.some((v) => /^\d+$/.test(String(v)))) add(where, 'readable_enum', 'use words, not IDs');
  }
  return problems;
}
