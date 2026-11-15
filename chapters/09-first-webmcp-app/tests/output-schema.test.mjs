import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestAgent } from '../test-agent.js';
import { Validator } from '@cfworker/json-schema';
import { searchAvailability, bookTable } from '../webmcp/tools.js';
import { bookTable as chapter5BookTable } from '../../../fjord-table/booking-tools.js';

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
    if (result.temperature === 'SECRET_PAYLOAD') {
      assert.match(agent.transcript[0].error, /at #\/properties\/temperature\/type \(type keyword\)/);
    }
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

test('Fjord Table outputSchema covers every documented return branch', () => {
  const valid = (outputSchema, value) => new Validator(outputSchema, '2020-12').validate(value);
  const search = valid(searchAvailability.outputSchema, {
    date: '2026-11-20', partySize: 2, slots: [{ time: '19:00', seating: ['window'] }]
  });
  assert.equal(search.valid, true, JSON.stringify(search.errors));

  const bookingResults = [
    { status: 'error', code: 'INVALID_INPUT', message: 'Correct the date and time.' },
    { status: 'refused', code: 'SLOT_UNAVAILABLE', message: 'Search current slots.' },
    { status: 'booked', reference: 'FT-1042', date: '2026-11-20', time: '19:00' },
    { status: 'cancelled_by_user', message: 'Nothing was booked.' },
  ];
  for (const value of bookingResults) {
    const result = valid(bookTable.outputSchema, value);
    assert.equal(result.valid, true, `${JSON.stringify(value)}: ${JSON.stringify(result.errors)}`);
  }
  assert.equal(valid(bookTable.outputSchema, { status: 'booked', date: '2026-11-20', time: '19:00' }).valid, false);

  const chapter5Results = [
    { status: 'error', code: 'INVALID_INPUT', message: 'Correct the date and time.' },
    { status: 'refused', code: 'SLOT_UNAVAILABLE', message: 'Search current slots.' },
    { status: 'booked', reference: 'FT-1042', date: '2026-11-20', time: '19:00', partySize: 2 },
    { status: 'cancelled_by_user', message: 'Nothing was booked.' },
  ];
  for (const value of chapter5Results) {
    const result = valid(chapter5BookTable.outputSchema, value);
    assert.equal(result.valid, true, `${JSON.stringify(value)}: ${JSON.stringify(result.errors)}`);
  }
});
