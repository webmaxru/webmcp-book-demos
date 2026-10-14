// Argument matching for evals.json suites, with the semantics of
// webmcp-evals' matcher: objects match as subsets, arrays match strictly,
// and an object whose keys all start with "$" is a constraint.
export function matchesArgument(expected, actual) {
  if (isConstraint(expected)) return matchesConstraint(expected, actual);
  if (expected === actual) return true;
  if (typeof expected !== 'object' || expected === null ||
      typeof actual !== 'object' || actual === null) return false;
  if (Array.isArray(expected) !== Array.isArray(actual)) return false;
  if (Array.isArray(expected)) {
    return expected.length === actual.length &&
           expected.every((e, i) => matchesArgument(e, actual[i]));
  }
  return Object.keys(expected).every((key) =>
    Object.hasOwn(actual, key) && matchesArgument(expected[key], actual[key]));
}

const isConstraint = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) &&
  Object.keys(v).length > 0 && Object.keys(v).every((k) => k.startsWith('$'));

function matchesConstraint(c, actual) {
  const num = typeof actual === 'number';
  const str = typeof actual === 'string';
  return Object.entries(c).every(([op, value]) => {
    switch (op) {
      case '$pattern':  return str && new RegExp(value).test(actual);
      case '$contains': return str && actual.includes(value);
      case '$gt':  return num && actual > value;
      case '$gte': return num && actual >= value;
      case '$lt':  return num && actual < value;
      case '$lte': return num && actual <= value;
      case '$type':
        if (value === 'array') return Array.isArray(actual);
        if (value === 'null') return actual === null;
        if (value === 'object') return typeof actual === 'object' && actual !== null && !Array.isArray(actual);
        return typeof actual === value;
      case '$any':  return true;          // presence was checked by the caller
      default: throw new Error(`Unknown constraint ${op}`);
    }
  });
}
