import { readFile, writeFile } from 'node:fs/promises';

const replace = async (path, before, after, { all = false } = {}) => {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) {
    if (source.includes(after)) return;
    throw new Error(`Expected source text was not found in ${path}`);
  }
  const next = all ? source.replaceAll(before, after) : source.replace(before, after);
  await writeFile(path, next);
};

const runners = [
  'chapters/09-first-webmcp-app/tests/run-tests.mjs',
  'chapters/17-the-road-ahead/tests/run-tests.mjs',
  'appendices/a-api-reference/tests/run-tests.mjs',
];
for (const path of runners) {
  await replace(path, '--enable-features=WebMCPTesting',
    '--enable-features=WebMCP,WebMCPTesting', { all: true });
}

// Keep the test mock's getTools() output aligned with the new optional IDL member.
await replace('chapters/17-the-road-ahead/dev/model-context-mock.js',
  "        const schemaJSON = tool.inputSchema === undefined ? '' : JSON.stringify(tool.inputSchema);\n        tools.set(tool.name, { tool, schemaJSON });",
  "        const schemaJSON = tool.inputSchema === undefined ? '' : JSON.stringify(tool.inputSchema);\n        const outputSchemaJSON = tool.outputSchema === undefined ? '' : JSON.stringify(tool.outputSchema);\n        tools.set(tool.name, { tool, schemaJSON, outputSchemaJSON });");
await replace('chapters/17-the-road-ahead/dev/model-context-mock.js',
  '        return [...tools.values()].map(({ tool, schemaJSON }) => ({',
  '        return [...tools.values()].map(({ tool, schemaJSON, outputSchemaJSON }) => ({');
await replace('chapters/17-the-road-ahead/dev/model-context-mock.js',
  '          ...(schemaJSON ? { inputSchema: JSON.parse(schemaJSON) } : {}),\n          window, origin: location.origin, annotations: { ...(tool.annotations ?? {}) }',
  '          ...(schemaJSON ? { inputSchema: JSON.parse(schemaJSON) } : {}),\n          ...(outputSchemaJSON ? { outputSchema: JSON.parse(outputSchemaJSON) } : {}),\n          window, origin: location.origin, annotations: { ...(tool.annotations ?? {}) }');

// Both the mock and the browser probe must preserve outputSchema through getTools().
await replace('chapters/17-the-road-ahead/tests/run-tests.mjs',
  '    assert.equal(report.outputSchemaReflected, false);',
  '    assert.equal(report.outputSchemaReflected, true);');

// The API reference fixture now verifies the optional schema on a registered tool.
await replace('appendices/a-api-reference/webmcp.idl',
  '    object inputSchema;\n',
  '    object inputSchema;\n    object outputSchema;\n', { all: true });
await replace('appendices/a-api-reference/tests/run-tests.mjs',
  "    await mc.registerTool(ok('echo', (i) => ({ got: i })));",
  "    await mc.registerTool(ok('echo', (i) => ({ got: i }), { outputSchema: { type: 'object', properties: { got: { type: 'object' } }, required: ['got'] } }));");
await replace('appendices/a-api-reference/tests/run-tests.mjs',
  "    r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();",
  "    r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();\n    r.outputSchema = T('echo').outputSchema;");
await replace('appendices/a-api-reference/tests/run-tests.mjs',
  "    assert.deepEqual(b.toolShape, ['description', 'name', 'origin', 'title', 'window']);",
  "    assert.deepEqual(b.toolShape, ['description', 'name', 'origin', 'outputSchema', 'title', 'window']);\n    assert.deepEqual(b.outputSchema, { type: 'object', properties: { got: { type: 'object' } }, required: ['got'] });");

// The Test Agent reports only a safe schema location and keyword, never the rejected value.
await replace('chapters/09-first-webmcp-app/test-agent.js',
  "      const path = validation.errors[0]?.keywordLocation;\n      const safePath = typeof path === 'string' && /^#[A-Za-z0-9_./~%-]{0,120}$/.test(path) ? ` at ${path}` : '';\n      throw new Error(`Tool output does not match its outputSchema${safePath}`);",
  "      const path = validation.errors[0]?.keywordLocation;\n      const safePath = typeof path === 'string' && /^#[A-Za-z0-9_./~%-]{0,120}$/.test(path) ? ` at ${path}` : '';\n      const keyword = typeof path === 'string' ? path.split('/').at(-1) : '';\n      const safeReason = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(keyword) ? ` (${keyword} keyword)` : '';\n      throw new Error(`Tool output does not match its outputSchema${safePath}${safeReason}`);");
await replace('chapters/09-first-webmcp-app/tests/output-schema.test.mjs',
  "      await assert.rejects(agent.call('weather'), /does not match its outputSchema/);\n      assert.equal(agent.transcript[0].raw, undefined);",
  "      await assert.rejects(agent.call('weather'), /does not match its outputSchema/);\n      if (result.temperature === 'SECRET_PAYLOAD') {\n        assert.match(agent.transcript[0].error, /at #\\/properties\\/temperature\\/type \(type keyword\)/);\n      }\n      assert.equal(agent.transcript[0].raw, undefined);");

console.log('Prepared CI test flags and outputSchema assertions');
