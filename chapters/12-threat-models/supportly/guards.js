// Validate in code: the browser does not check calls against inputSchema.
export class ToolInputError extends Error {}

export function checkArgs(input, spec) {
  const extra = Object.keys(input).filter((k) => !(k in spec));
  if (extra.length) throw new ToolInputError(`Unexpected field(s): ${extra.join(', ')}`);

  const out = {};
  for (const [key, rule] of Object.entries(spec)) {
    const value = input[key];
    if (value === undefined) {
      if (rule.required) throw new ToolInputError(`${key} is required`);
      continue;
    }
    if (typeof value !== 'string') throw new ToolInputError(`${key} must be a string`);
    if (value.length > rule.maxLength) {
      throw new ToolInputError(`${key} is longer than ${rule.maxLength} characters`);
    }
    if (rule.enum && !rule.enum.includes(value)) {
      throw new ToolInputError(`${key} must be one of: ${rule.enum.join(', ')}`);
    }
    out[key] = value;
  }
  return out;
}
