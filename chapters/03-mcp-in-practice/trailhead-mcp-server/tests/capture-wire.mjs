// Dev-only: records the raw JSON-RPC lines used for Listings 3.1 and 3.9.
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const client = new Client({ name: 'trailhead-cli', version: '1.0.0' },
  { versionNegotiation: { mode: 'auto' } });
await client.connect(new StdioClientTransport({ command: 'node', args: ['tests/wire-tap.mjs'],
  env: { ...process.env, WIRE_LOG: process.env.WIRE_LOG ?? 'tests/wire-listings.log' } }));
await client.callTool({ name: 'get_order_status', arguments: { orderId: 'TH-100231' } });
await client.close();
