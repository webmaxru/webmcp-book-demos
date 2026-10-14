import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const client = new Client(
  { name: 'trailhead-cli', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } }   // try 2026-07-28, fall back if needed
);

await client.connect(new StdioClientTransport({ command: 'node', args: ['src/stdio.js'] }));
console.log('Protocol era:', client.getProtocolEra());

const { tools } = await client.listTools();
console.log('Tools:', tools.map((t) => t.name).join(', '));

const result = await client.callTool({
  name: 'search_products',
  arguments: { query: 'tent', maxPrice: 4000, inStockOnly: true }
});
console.log(JSON.stringify(result.structuredContent, null, 2));

await client.close();
