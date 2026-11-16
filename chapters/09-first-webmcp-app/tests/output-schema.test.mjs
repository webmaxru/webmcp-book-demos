import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestAgent } from '../test-agent.js';
import { Validator } from '@cfworker/json-schema';

// Chapter 5's registration helper detects WebMCP at module load, so supply a
// small modelContext first and capture the Chapter 4 tool for its contract tests.
const registeredTools = new Map();
globalThis.document = { modelContext: {
  registerTool: async (tool) => { registeredTools.set(tool.name, tool); }
} };
const { searchAvailability, bookTable } = await import('../webmcp/tools.js');
const { bookTable: chapter5BookTable } = await import('../../../fjord-table/booking-tools.js');
await import('../../../fjord-table/search-availability.js');

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

function installRawTool(outputSchema, raw) {
  const tool = { name: 'weather', description: 'Weather', outputSchema };
  globalThis.document = { modelContext: {
    getTools: async () => [tool],
    executeTool: async () => raw
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

test('unquoted JSON-looking native results stay strings when the outputSchema says string', async () => {
  for (const raw of ['42', 'true', 'null']) {
    installRawTool({ type: 'string' }, raw);
    const agent = createTestAgent({ log: () => {} });
    assert.equal(await agent.call('weather'), raw);
    assert.equal(agent.transcript[0].result, raw);
    assert.equal(agent.transcript[0].raw, JSON.stringify(raw));
  }
});

test('invalid search arguments return schema-valid errors through the Test Agent', async () => {
  const inputs = [
    { date: '2026-11-20', partySize: '2' },
    { partySize: 2 },
    { date: 'not-a-date', partySize: 2 },
    { date: '2026-11-20', partySize: 0 }
  ];
  const agent = createTestAgent({ log: () => {} });
  for (const input of inputs) {
    globalThis.document = { modelContext: {
      getTools: async () => [searchAvailability],
      executeTool: async (tool, args) => JSON.stringify(await tool.execute(args, {}))
    } };
    const result = await agent.call('search_availability', input);
    assert.equal(result.status, 'error');
    assert.equal(result.code, 'INVALID_INPUT');
    assert.equal(typeof result.message, 'string');
    assert.equal('date' in result, false);
    assert.equal('partySize' in result, false);
    const validation = new Validator(searchAvailability.outputSchema, '2020-12').validate(result);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  }
});

test('Fjord Table outputSchema covers every documented return branch', () => {
  const valid = (outputSchema, value) => new Validator(outputSchema, '2020-12').validate(value);
  const search = valid(searchAvailability.outputSchema, {
    date: '2026-11-20', partySize: 2, slots: [{ time: '19:00', seating: ['window'] }]
  });
  assert.equal(search.valid, true, JSON.stringify(search.errors));
  const searchError = valid(searchAvailability.outputSchema, {
    status: 'error', code: 'INVALID_INPUT', message: 'Correct the date and party size.'
  });
  assert.equal(searchError.valid, true, JSON.stringify(searchError.errors));

  const chapter4Search = registeredTools.get('search_availability');
  assert.ok(chapter4Search, 'Chapter 4 registered its search tool');
  const chapter4Success = valid(chapter4Search.outputSchema, {
    date: '2026-11-20', partySize: 2, slots: ['19:00']
  });
  assert.equal(chapter4Success.valid, true, JSON.stringify(chapter4Success.errors));
  const chapter4Error = valid(chapter4Search.outputSchema, {
    status: 'error', code: 'INVALID_INPUT', message: 'Correct the date and party size.'
  });
  assert.equal(chapter4Error.valid, true, JSON.stringify(chapter4Error.errors));

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
