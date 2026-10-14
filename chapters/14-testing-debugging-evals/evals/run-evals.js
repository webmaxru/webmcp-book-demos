// Run an evals.json suite against a live page: an agent proposes tool calls,
// the page executes them over CDP, and the trajectory is scored.
import { matchesArgument } from './matcher.js';

export async function runSuite({ suite, openPage, agent, runs = 5, maxSteps = 6 }) {
  const report = [];
  for (const testCase of suite) {
    const result = { name: testCase.name, runs, passed: 0, failures: [] };
    for (let run = 0; run < runs; run++) {
      const { page, webmcp, close } = await openPage();    // a fresh page every run
      const trajectory = [];
      let verdict;
      try {
        const messages = [...testCase.messages];
        for (let step = 0; step < maxSteps; step++) {
          const tools = [...webmcp.tools.values()];
          const { call } = await agent.next({ messages, tools });
          if (!call) break;                                 // the agent has answered
          const reply = await webmcp.invoke(call.functionName, call.arguments);
          trajectory.push({ ...call, status: reply.status, output: reply.output });
          messages.push({ role: 'tool', name: call.functionName, call,
                          content: JSON.stringify(reply.output ?? reply.errorText ?? null) });
        }
        verdict = scoreTrajectory(testCase.expectedCall, trajectory);
        if (verdict.ok) verdict = await checkPage(page, testCase.assertions ?? []);
      } finally {
        await close();
      }
      if (verdict.ok) result.passed++; else result.failures.push(verdict.reason);
    }
    report.push({ ...result, passRate: result.passed / runs });
  }
  return report;
}

// Expected calls must appear in order. Optional ones may be missing.
// Extra calls in between are allowed: agents often look before they leap.
export function scoreTrajectory(expected, actual) {
  let from = 0;
  for (const exp of expected) {
    const at = actual.findIndex((a, i) => i >= from &&
      a.functionName === exp.functionName && matchesArgument(exp.arguments, a.arguments));
    if (at === -1) {
      if (exp.optional) continue;
      const got = actual.map((a) => `${a.functionName}(${JSON.stringify(a.arguments)})`);
      return { ok: false,
               reason: `expected ${exp.functionName}; got ${got.join(' → ') || 'no calls'}` };
    }
    from = at + 1;
  }
  return { ok: true };
}

// The right calls are not enough: did the page end up where the user wanted?
// Same shape as webmcp-evals' DOM assertions: one expectation per assertion.
async function checkPage(page, assertions) {
  for (const { selector, expect } of assertions) {
    const [key, want] = Object.entries(expect)[0];
    const seen = await page.$$eval(selector, (els) => ({
      exists: els.length > 0, count: els.length, text: els[0]?.textContent.trim() ?? null }));
    if (!matchesArgument(want, seen[key]))
      return { ok: false, reason: `${selector}: expected ${key} ${JSON.stringify(want)}, saw ${JSON.stringify(seen[key])}` };
  }
  return { ok: true };
}
