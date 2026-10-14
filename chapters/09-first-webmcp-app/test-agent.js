// test-agent.js: the Test Agent, a minimal in-page agent for development and CI.
// It lists tools with getTools(), asks a planner what to do next, runs each call
// with executeTool() and keeps a transcript. It is a harness, not a product agent.
export function createTestAgent({ planner, maxSteps = 6, log = console.info } = {}) {
  const transcript = [];

  const tools = () => document.modelContext.getTools();

  async function call(name, args = {}, { signal } = {}) {
    const tool = (await tools()).find((t) => t.name === name);
    if (!tool) throw new Error(`No tool named "${name}" on this page`);
    const entry = { name, args };
    transcript.push(entry);
    try {
      entry.raw = await document.modelContext.executeTool(tool, args, { signal });
      entry.result = parse(entry.raw);
      log('[test-agent]', name, args, '->', entry.result);
      return entry.result;
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
