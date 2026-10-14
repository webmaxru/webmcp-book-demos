import { fail } from './results.js';

// Checks arguments against the same schema the agent was given, using only the
// core keywords this book recommends. Returns null when the arguments are valid,
// otherwise a fail() result that names the field and says what valid looks like.
export function checkArgs(schema, args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return fail('INVALID_INPUT', 'Send the arguments as one JSON object.');
  }
  const props = schema.properties ?? {};
  for (const key of schema.required ?? []) {
    if (args[key] === undefined || args[key] === '') {
      return fail('MISSING_ARGUMENT', `Provide "${key}". ${props[key]?.description ?? ''}`.trim(),
        { field: key });
    }
  }
  for (const [key, value] of Object.entries(args)) {
    if (!(key in props)) {
      return fail('UNKNOWN_ARGUMENT',
        `"${key}" is not a parameter of this tool. Parameters: ${Object.keys(props).join(', ')}.`,
        { field: key });
    }
    const problem = check(props[key], value);
    if (problem) {
      return fail('INVALID_ARGUMENT', `"${key}" ${problem} ${props[key].description ?? ''}`.trim(),
        { field: key });
    }
  }
  return null;
}

// enum, or oneOf made of { const, title } pairs (see Listing 11.4).
const allowedValues = (p) =>
  p.enum ?? (p.oneOf?.every((o) => 'const' in o) ? p.oneOf.map((o) => o.const) : null);

function check(p, v) {
  const values = allowedValues(p);
  if (values && !values.includes(v)) {
    return `must be one of ${values.map((x) => JSON.stringify(x)).join(', ')}.`;
  }
  if (p.type === 'string') {
    if (typeof v !== 'string') return 'must be a string.';
    if (p.maxLength !== undefined && v.length > p.maxLength) {
      return `is ${v.length} characters; the limit is ${p.maxLength}.`;
    }
    if (p.pattern && !new RegExp(p.pattern).test(v)) return 'is not in the expected format.';
  }
  if (p.type === 'number' || p.type === 'integer') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'must be a number.';
    if (p.type === 'integer' && !Number.isInteger(v)) return 'must be a whole number.';
    if (p.minimum !== undefined && v < p.minimum) return `must be at least ${p.minimum}.`;
    if (p.maximum !== undefined && v > p.maximum) return `must be at most ${p.maximum}.`;
  }
  if (p.type === 'boolean' && typeof v !== 'boolean') return 'must be true or false.';
  if (p.type === 'array') {
    if (!Array.isArray(v)) return 'must be a list.';
    if (p.minItems !== undefined && v.length < p.minItems) return `needs at least ${p.minItems} items.`;
    if (p.maxItems !== undefined && v.length > p.maxItems) return `takes at most ${p.maxItems} items.`;
    if (p.uniqueItems && new Set(v).size !== v.length) return 'must not repeat an item.';
    for (const item of v) {
      const problem = p.items && check(p.items, item);
      if (problem) return `has an item that ${problem}`;
    }
  }
  return null;
}
