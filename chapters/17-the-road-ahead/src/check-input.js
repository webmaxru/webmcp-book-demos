// check-input.js (filler, not a listing): a deliberately small JSON Schema
// checker for the subset Trailhead's schemas use (object, required, string,
// number, integer, boolean, enum, minimum, maximum, array, minItems, maxItems).
// In production use a full validator such as Ajv; Chapter 5 explains why the
// page must validate at all.
export function checkInput(schema, value, path = 'input') {
  const problems = [];
  if (!schema) return problems;
  const type = schema.type;
  if (type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [`${path} must be an object`];
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) problems.push(`${path}.${key} is required`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (key in value) problems.push(...checkInput(sub, value[key], `${path}.${key}`));
    }
    return problems;
  }
  if (type === 'array') {
    if (!Array.isArray(value)) return [`${path} must be an array`];
    if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${path} needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) problems.push(`${path} allows at most ${schema.maxItems} items`);
    value.forEach((item, i) => problems.push(...checkInput(schema.items, item, `${path}[${i}]`)));
    return problems;
  }
  if (type === 'string' && typeof value !== 'string') return [`${path} must be a string`];
  if (type === 'boolean' && typeof value !== 'boolean') return [`${path} must be a boolean`];
  if ((type === 'number' || type === 'integer') && (typeof value !== 'number' || Number.isNaN(value))) {
    return [`${path} must be a number`];
  }
  if (type === 'integer' && !Number.isInteger(value)) return [`${path} must be an integer`];
  if (schema.enum && !schema.enum.includes(value)) problems.push(`${path} must be one of ${schema.enum.join(', ')}`);
  if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${path} must be at least ${schema.minimum}`);
  if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${path} must be at most ${schema.maximum}`);
  return problems;
}
