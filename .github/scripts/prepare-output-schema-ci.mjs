import { readFile, writeFile } from 'node:fs/promises';

async function edit(path, transform) {
  const original = await readFile(path, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const source = original.replace(/\r\n/g, '\n');
  const next = transform(source);
  if (next !== source) await writeFile(path, next.replace(/\n/g, eol));
}

function replaceOnce(source, before, after, path) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Expected text or its output not found in ${path}: ${before.slice(0, 100)}`);
  return source.replace(before, after);
}

function replaceRegex(source, pattern, replacement, alreadyApplied, path) {
  pattern.lastIndex = 0;
  if (pattern.test(source)) {
    pattern.lastIndex = 0;
    return source.replace(pattern, replacement);
  }
  if (source.includes(alreadyApplied)) return source;
  throw new Error(`Expected pattern or its output not found in ${path}: ${pattern}`);
}

function versionHelper(name) {
  return `function ${name}(actual, minimum) {
  const a = String(actual).split('.').map((part) => Number(part) || 0);
  const b = minimum.split('.').map((part) => Number(part) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}`;
}

for (const path of [
  'chapters/09-first-webmcp-app/tests/run-tests.mjs',
  'chapters/17-the-road-ahead/tests/run-tests.mjs',
  'appendices/a-api-reference/tests/run-tests.mjs',
]) {
  await edit(path, (source) => {
    const oldFlag = '--enable-features=WebMCPTesting';
    const newFlag = '--enable-features=WebMCP,WebMCPTesting';
    if (source.includes(oldFlag)) return source.replaceAll(oldFlag, newFlag);
    if (source.includes(newFlag)) return source;
    throw new Error(`Expected WebMCPTesting flag or prepared flag in ${path}`);
  });
}

await edit('fjord-table/search-availability.js', (source) => replaceOnce(
  source,
  `      },\n      annotations: { readOnlyHint: true },`,
  `      },\n      outputSchema: {\n        type: 'object',\n        properties: {\n          date: { type: 'string' },\n          partySize: { type: 'integer' },\n          slots: { type: 'array', items: { type: 'string' } }\n        },\n        required: ['date', 'partySize', 'slots']\n      },\n      annotations: { readOnlyHint: true },`,
  'fjord-table/search-availability.js'
));

await edit('fjord-table/booking-tools.js', (source) => replaceOnce(
  source,
  `      required: ['date', 'time', 'partySize']\n    },\n    annotations: { consequentialHint: true },`,
  `      required: ['date', 'time', 'partySize']\n    },\n    outputSchema: {\n      type: 'object',\n      properties: {\n        status: { type: 'string', enum: ['error', 'refused', 'booked', 'cancelled_by_user'] },\n        code: { type: 'string' },\n        message: { type: 'string' },\n        reference: { type: 'string' },\n        date: { type: 'string' },\n        time: { type: 'string' },\n        partySize: { type: 'integer' }\n      },\n      required: ['status'],\n      oneOf: [\n        { properties: { status: { const: 'error' } }, required: ['code', 'message'] },\n        { properties: { status: { const: 'refused' } }, required: ['code', 'message'] },\n        { properties: { status: { const: 'booked' } }, required: ['reference', 'date', 'time', 'partySize'] },\n        { properties: { status: { const: 'cancelled_by_user' } }, required: ['message'] }\n      ]\n    },\n    annotations: { consequentialHint: true },`,
  'fjord-table/booking-tools.js'
));

await edit('chapters/09-first-webmcp-app/webmcp/tools.js', (source) => {
  let next = replaceOnce(source, 'const searchAvailability = {', 'export const searchAvailability = {', 'Chapter 9 tools');
  return replaceOnce(next, 'const bookTable = {', 'export const bookTable = {', 'Chapter 9 tools');
});

await edit('chapters/09-first-webmcp-app/tests/run-tests.mjs', (source) => {
  let next = replaceOnce(
    source,
    `const REAL = process.env.WEBMCP === 'chrome';`,
    `const REAL = process.env.WEBMCP === 'chrome';\n\n${versionHelper('versionAtLeast')}`,
    'Chapter 9 test runner'
  );
  next = replaceOnce(
    next,
    `ts.map((t) => ({ name: t.name, annotations: t.annotations, required: t.inputSchema?.required }))`,
    `ts.map((t) => ({ name: t.name, annotations: t.annotations, required: t.inputSchema?.required, outputSchema: t.outputSchema }))`,
    'Chapter 9 test runner'
  );
  return replaceOnce(
    next,
    `assert.deepEqual(byName.book_table.required, ['date', 'time', 'partySize']);`,
    `assert.deepEqual(byName.book_table.required, ['date', 'time', 'partySize']);\n    const supportsOutputSchema = versionAtLeast(webmcp.version(), '159.0.8140.0');\n    assert.equal(Boolean(byName.search_availability.outputSchema), supportsOutputSchema);\n    assert.equal(Boolean(byName.book_table.outputSchema), supportsOutputSchema);`,
    'Chapter 9 test runner'
  );
});

await edit('chapters/17-the-road-ahead/dev/model-context-mock.js', (source) => {
  let next = replaceRegex(
    source,
    /([ \t]*)const schemaJSON = tool\.inputSchema === undefined \? '' : JSON\.stringify\(tool\.inputSchema\);\n\1tools\.set\(tool\.name, \{ tool, schemaJSON \}\);/,
    (_m, indent) => `${indent}const schemaJSON = tool.inputSchema === undefined ? '' : JSON.stringify(tool.inputSchema);\n${indent}const outputSchemaJSON = tool.outputSchema === undefined ? '' : JSON.stringify(tool.outputSchema);\n${indent}tools.set(tool.name, { tool, schemaJSON, outputSchemaJSON });`,
    'const outputSchemaJSON = tool.outputSchema',
    'chapters/17-the-road-ahead/dev/model-context-mock.js'
  );
  next = replaceOnce(
    next,
    'return [...tools.values()].map(({ tool, schemaJSON }) => ({',
    'return [...tools.values()].map(({ tool, schemaJSON, outputSchemaJSON }) => ({',
    'chapters/17-the-road-ahead/dev/model-context-mock.js'
  );
  return replaceRegex(
    next,
    /([ \t]*)\.\.\.\(schemaJSON \? \{ inputSchema: JSON\.parse\(schemaJSON\) \} : \{\}\),\n([ \t]*)window,/,
    (_m, indent, nextIndent) => `${indent}...(schemaJSON ? { inputSchema: JSON.parse(schemaJSON) } : {}),\n${indent}...(outputSchemaJSON ? { outputSchema: JSON.parse(outputSchemaJSON) } : {}),\n${nextIndent}window,`,
    '...(outputSchemaJSON ? { outputSchema: JSON.parse(outputSchemaJSON) } : {}),',
    'chapters/17-the-road-ahead/dev/model-context-mock.js'
  );
});

await edit('chapters/17-the-road-ahead/tests/run-tests.mjs', (source) => {
  let next = replaceOnce(
    source,
    `const REAL = process.env.WEBMCP === 'chrome';`,
    `const REAL = process.env.WEBMCP === 'chrome';\n\n${versionHelper('versionAtLeast')}`,
    'Chapter 17 test runner'
  );
  return replaceOnce(
    next,
    'assert.equal(report.outputSchemaReflected, false);',
    `assert.equal(report.outputSchemaReflected, !REAL || versionAtLeast(plain.version(), '159.0.8140.0'));`,
    'Chapter 17 test runner'
  );
});

await edit('chapters/17-the-road-ahead/src/catalog.js', (source) => replaceOnce(
  source,
  "// Not in the draft yet (issue #9, PR #254). Browsers that don't know it ignore it.",
  '// Optional JSON Schema return contract; agents should validate results before passing them to a model.',
  'Chapter 17 catalog'
));

await edit('appendices/a-api-reference/webmcp.idl', (source) => {
  const lines = source.split('\n');
  let found = 0;
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    if (lines[i].trim() !== 'object inputSchema;') continue;
    found++;
    if (lines[i + 1]?.trim() !== 'object outputSchema;') {
      const indent = lines[i].match(/^[ \t]*/)[0];
      result.push(`${indent}object outputSchema;`);
    }
  }
  if (found === 0) throw new Error('No inputSchema members found in Appendix A IDL');
  return result.join('\n');
});

await edit('chapters/09-first-webmcp-app/tests/output-schema.test.mjs', (source) => {
  let next = replaceOnce(
    source,
    "import { createTestAgent } from '../test-agent.js';",
    "import { createTestAgent } from '../test-agent.js';\nimport { Validator } from '@cfworker/json-schema';\nimport { searchAvailability, bookTable } from '../webmcp/tools.js';\nimport { bookTable as chapter5BookTable } from '../../../fjord-table/booking-tools.js';",
    'Chapter 9 output-schema tests'
  );
  const marker = "test('Fjord Table outputSchema covers every documented return branch', () => {";
  if (next.includes(marker)) return next;
  return `${next.trimEnd()}\n\n${marker}
  const valid = (schema, value) => new Validator(schema, '2020-12').validate(value);
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
});\n`;
});

await edit('appendices/a-api-reference/tests/run-tests.mjs', (source) => {
  let next = replaceOnce(
    source,
    `const here = path.dirname(fileURLToPath(import.meta.url));`,
    `const here = path.dirname(fileURLToPath(import.meta.url));\n${versionHelper('versionAtLeast')}`,
    'Appendix A test runner'
  );
  next = replaceOnce(
    next,
    "r.regValue = await err(mc.registerTool(ok('echo', (i) => ({ got: i }))));",
    "r.regValue = await err(mc.registerTool(ok('echo', (i) => ({ got: i }), { outputSchema: { type: 'object', properties: { got: { type: 'object' } }, required: ['got'] } })));",
    'Appendix A test runner'
  );
  next = replaceOnce(
    next,
    "r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();",
    "r.toolShape = Object.keys(tools.find((t) => t.name === 'echo')).sort();\n    r.outputSchema = tools.find((t) => t.name === 'echo').outputSchema;",
    'Appendix A test runner'
  );
  return replaceOnce(
    next,
    "assert.deepEqual(b.toolShape, ['description', 'name', 'origin', 'title', 'window']);",
    `assert.deepEqual(b.toolShape, versionAtLeast(out.version, '159.0.8140.0')
      ? ['description', 'name', 'origin', 'outputSchema', 'title', 'window']
      : ['description', 'name', 'origin', 'title', 'window']);
    if (versionAtLeast(out.version, '159.0.8140.0')) {
      assert.deepEqual(b.outputSchema, { type: 'object', properties: { got: { type: 'object' } }, required: ['got'] });
    }`,
    'Appendix A test runner'
  );
});

console.log('Prepared WebMCP outputSchema changes for verification');
