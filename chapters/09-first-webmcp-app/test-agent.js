// test-agent.js: the Test Agent, a minimal in-page agent for development and CI.
// It lists tools with getTools(), asks a planner what to do next, runs each call
// with executeTool() and keeps a transcript. It is a harness, not a product agent.
import { Validator } from './node_modules/@cfworker/json-schema/dist/esm/index.js';

export function createTestAgent({ planner, maxSteps = 6, log = console.info } = {}) {
  const transcript = [];

  const tools = () => document.modelContext.getTools();

  async function call(name, args = {}, { signal } = {}) {
    const tool = (await tools()).find((t) => t.name === name);
    if (!tool) throw new Error(`No tool named "${name}" on this page`);
    const entry = { name, args };
    transcript.push(entry);
    try {
      const raw = await document.modelContext.executeTool(tool, args, { signal });
      const result = parse(raw);
      checkOutput(tool.outputSchema, result);
      // Keep raw output only after validation: the planner reads this transcript.
      entry.raw = tool.outputSchema === undefined ? raw : JSON.stringify(result);
      entry.result = result;
      log('[test-agent]', name, args, '->', result);
      return result;
    } catch (err) {
      entry.error = `${err.name}: ${err.message}`;
      log('[test-agent]', name, args, 'failed:', entry.error);
      throw err;
    }
  }

  async function run(task, { signal } = {}) {
    for (let step = 0; step < maxSteps; step++) {
      const next = await planner({ task, tools: await tools(), transcript });
      if (!next || next.done) return { done: true, answer: next?.answer, transcript };
      await call(next.tool, next.args, { signal }).catch(() => {});  // the planner sees the error
    }
    return { done: false, reason: 'max-steps', transcript };
  }

  return { tools, call, run, transcript };
}

// A deterministic planner for tests: each step may look at the results so far.
export const scripted = (...steps) => ({ transcript }) => {
  const step = steps[transcript.length];
  return typeof step === 'function' ? step(transcript) : step ?? { done: true };
};

function parse(raw) {
  try { return JSON.parse(raw); } catch { return raw; }   // Chromium returns plain strings as-is
}

function checkOutput(schema, result) {
  if (schema === undefined) return;                     // an output schema is optional
  let validation;
  try {
    validation = new Validator(schema, '2020-12').validate(result);
  } catch {
    // Fail closed: never pass on an output we could not check.
    throw new Error('Could not validate the tool output against its outputSchema');
  }
  if (!validation.valid) {
    // Applicator summaries such as "properties" point only to a parent schema
    // node. Prefer the most specific assertion while never including the bad value.
    const summaryKeywords = new Set([
      'properties', 'patternProperties', 'allOf', 'anyOf', 'oneOf', 'not',
      'if', 'then', 'else', '$ref', '$recursiveRef', 'dependentSchemas',
      'items', 'prefixItems', 'contains', 'propertyNames',
      'unevaluatedProperties', 'unevaluatedItems'
    ]);
    const errors = Array.isArray(validation.errors) ? validation.errors : [];
    const details = errors
      .filter((error) => typeof error.keyword === 'string' && !summaryKeywords.has(error.keyword))
      .slice()
      .sort((a, b) => (b.keywordLocation?.length ?? 0) - (a.keywordLocation?.length ?? 0));
    const unionError = errors.find((error) => error.keyword === 'oneOf' || error.keyword === 'anyOf');
    const detail = unionError ?? details[0] ?? errors[0];
    const path = detail?.keywordLocation;
    const safePath = typeof path === 'string' && /^#[A-Za-z0-9_./~%-]{0,120}$/.test(path)
      ? ` at ${path}`
      : '';
    const keyword = detail?.keyword;
    const safeKeyword = typeof keyword === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(keyword)
      ? keyword
      : '';
    const reasons = {
      type: 'value has the wrong type',
      required: 'a required property is missing',
      enum: 'value is outside the allowed set',
      const: 'value does not match the required constant',
      minimum: 'value is below the minimum',
      maximum: 'value is above the maximum',
      minLength: 'string is too short',
      maxLength: 'string is too long',
      minItems: 'array has too few items',
      maxItems: 'array has too many items',
      additionalProperties: 'an unexpected property is present'
    };
    const suffix = safeKeyword ? ` (${safeKeyword} keyword)` : '';
    const reason = safeKeyword ? (reasons[safeKeyword] ?? `the ${safeKeyword} constraint failed`) : 'validation failed';
    throw new Error(`Tool output does not match its outputSchema${safePath}${suffix}: ${reason}`);
  }
}
