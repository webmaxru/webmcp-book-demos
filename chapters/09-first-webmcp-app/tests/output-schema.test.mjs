import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestAgent } from '../test-agent.js';

const schema = {
  type: 'object',
  properties: { temperature: { type: 'number' }, conditions: { type: 'string' } },
  required: ['temperature', 'conditions']
};

function installTool(outputSchema, result) {
  const tool = { name: 'weather', description: 'Weather', ...(outputSchema === undefined ? {} : { outputSchema }) };
  globalThis.document = { modelContext: {
    getTools: async () => [tool],
    executeTool: async () => JSON.stringify(result)
  } };
}

test('a matching result reaches the caller', async () => {
  installTool(schema, { temperature: 21, conditions: 'cloudy' });
  const agent = createTestAgent({ log: () => {} });
  assert.deepEqual(await agent.call('weather'), { temperature: 21, conditions: 'cloudy' });
  assert.equal(agent.transcript[0].result.temperature, 21);
});

test('a wrong type or missing required property is rejected without retaining the result', async () => {
  for (const result of [{ temperature: 'SECRET_PAYLOAD', conditions: 'cloudy' }, { conditions: 'SECRET_PAYLOAD' }]) {
    installTool(schema, result);
    const agent = createTestAgent({ log: () => {} });
    await assert.rejects(agent.call('weather'), /does not match its outputSchema/);
    assert.equal(agent.transcript[0].raw, undefined);
    assert.equal(agent.transcript[0].result, undefined);
    assert.doesNotMatch(JSON.stringify(agent.transcript), /SECRET_PAYLOAD/);
  }
});

test('the planner sees an error instead of the malformed output', async () => {
  installTool(schema, { temperature: 'SECRET_PAYLOAD', conditions: 'cloudy' });
  let seen;
  const agent = createTestAgent({ log: () => {}, planner: ({ transcript }) => {
    if (!transcript.length) return { tool: 'weather', args: {} };
    seen = JSON.stringify(transcript);
    return { done: true, answer: 'validation failed' };
  } });
  const outcome = await agent.run('Check weather');
  assert.equal(outcome.done, true);
  assert.match(seen, /does not match its outputSchema/);
  assert.doesNotMatch(seen, /SECRET_PAYLOAD/);
});

test('tools with no output schema still pass their result through', async () => {
  installTool(undefined, { anything: 'allowed' });
  const agent = createTestAgent({ log: () => {} });
  assert.deepEqual(await agent.call('weather'), { anything: 'allowed' });
});
