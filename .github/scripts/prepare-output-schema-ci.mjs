import { readFile, writeFile } from 'node:fs/promises';

async function edit(path, transform) {
  const original = await readFile(path, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const source = original.replace(/\r\n/g, '\n');
  const next = transform(source);
  if (next !== source) await writeFile(path, next.replace(/\n/g, eol));
}
function replaceOnce(source, before, after, path) {
  if (!source.includes(before)) throw new Error(`Expected text not found in ${path}: ${before.slice(0, 100)}`);
  return source.replace(before, after);
}
function replaceRegex(source, pattern, replacement, path) {
  if (!pattern.test(source)) throw new Error(`Expected pattern not found in ${path}: ${pattern}`);
  return source.replace(pattern, replacement);
}
for (const path of ['chapters/09-first-webmcp-app/tests/run-tests.mjs','chapters/17-the-road-ahead/tests/run-tests.mjs','appendices/a-api-reference/tests/run-tests.mjs']) {
  await edit(path, source => {
    if (!source.includes('--enable-features=WebMCPTesting')) throw new Error(`Expected WebMCPTesting flag not found in ${path}`);
    return source.replaceAll('--enable-features=WebMCPTesting', '--enable-features=WebMCP,WebMCPTesting');
  });
}
await edit('chapters/17-the-road-ahead/dev/model-context-mock.js', source => {
  let next = replaceRegex(source, /([ \t]*)const schemaJSON = tool\.inputSchema === undefined \? '' : JSON\.stringify\(tool\.inputSchema\);\n\1tools\.set\(tool\.name, \{ tool, schemaJSON \}\);/, (_m, i) => `${i}const schemaJSON = tool.inputSchema === undefined ? '' : JSON.stringify(tool.inputSchema);\n${i}const outputSchemaJSON = tool.outputSchema === undefined ? '' : JSON.stringify(tool.outputSchema);\n${i}tools.set(tool.name, { tool, schemaJSON, outputSchemaJSON });`, 'chapters/17-the-road-ahead/dev/model-context-mock.js');
  next = replaceOnce(next, 'return [...tools.values()].map(({ tool, schemaJSON }) => ({', 'return [...tools.values()].map(({ tool, schemaJSON, outputSchemaJSON }) => ({', 'chapters/17-the-road-ahead/dev/model-context-mock.js');
  return replaceRegex(next, /([ \t]*)\.\.\.\(schemaJSON \? \{ inputSchema: JSON\.parse\(schemaJSON\) \} : \{\}\),\n([ \t]*)window,/, (_m, i, j) => `${i}...(schemaJSON ? { inputSchema: JSON.parse(schemaJSON) } : {}),\n${i}...(outputSchemaJSON ? { outputSchema: JSON.parse(outputSchemaJSON) } : {}),\n${j}window,`, 'chapters/17-the-road-ahead/dev/model-context-mock.js');
});
await edit('chapters/17-the-road-ahead/tests/run-tests.mjs', source => replaceOnce(source, 'assert.equal(report.outputSchemaReflected, false);', 'assert.equal(report.outputSchemaReflected, true);', 'chapters/17-the-road-ahead/tests/run-tests.mjs'));
await edit('appendices/a-api-reference/webmcp.idl', source => {
  const re = /^([ \t]*)object inputSchema;$/gm;
  if (!re.test(source)) throw new Error('No inputSchema members found in Appendix A IDL');
  re.lastIndex = 0;
  return source.replace(re, '$1object inputSchema;\n$1object outputSchema;');
});
await edit('appendices/a-api-reference/tests/run-tests.mjs', source => {
  let next = replaceOnce(source, "r.regValue = await err(mc.registerTool(ok('echo', (i) => ({ got: i }))));", "r.regValue = await err(mc.registerTool(ok('echo', (i) => ({ got: i }), { outputSchema: { type: 'object', properties: { got: { type: 'object' } }, required: ['got'] } })));", 'Appendix A tests');
  next = replaceOnce(next, "r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();", "r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();\n    r.outputSchema = tools.find((t) => t.name === 'echo').outputSchema;", 'Appendix A tests');
  return replaceOnce(next, "assert.deepEqual(b.toolShape, ['description', 'name', 'origin', 'title', 'window']);", "assert.deepEqual(b.toolShape, ['description', 'name', 'origin', 'outputSchema', 'title', 'window']);\n    assert.deepEqual(b.outputSchema, { type: 'object', properties: { got: { type: 'object' } }, required: ['got'] });", 'Appendix A tests');
});
await edit('chapters/09-first-webmcp-app/test-agent.js', source => replaceOnce(source, "      const safePath = typeof path === 'string' && /^#[A-Za-z0-9_./~%-]{0,120}$/.test(path) ? ` at ${path}` : '';\n      throw new Error(`Tool output does not match its outputSchema${safePath}`);", "      const safePath = typeof path === 'string' && /^#[A-Za-z0-9_./~%-]{0,120}$/.test(path) ? ` at ${path}` : '';\n      const keyword = typeof path === 'string' ? path.split('/').at(-1) : '';\n      const safeReason = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(keyword) ? ` (${keyword} keyword)` : '';\n      throw new Error(`Tool output does not match its outputSchema${safePath}${safeReason}`);", 'Chapter 9 Test Agent'));
await edit('chapters/09-first-webmcp-app/tests/output-schema.test.mjs', source => replaceOnce(source, "      await assert.rejects(agent.call('weather'), /does not match its outputSchema/);\n      assert.equal(agent.transcript[0].raw, undefined);", "      await assert.rejects(agent.call('weather'), /does not match its outputSchema/);\n      if (result.temperature === 'SECRET_PAYLOAD') {\n        assert.match(agent.transcript[0].error, /at #\\/properties\\/temperature\\/type \\(type keyword\\)/);\n      }\n      assert.equal(agent.transcript[0].raw, undefined);", 'Chapter 9 output-schema tests'));
console.log('Prepared WebMCP outputSchema changes for verification');
