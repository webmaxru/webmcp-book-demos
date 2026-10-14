import { McpServer } from '@modelcontextprotocol/server';
import { registerTools } from './tools.js';
import { registerContext } from './context.js';

// One factory builds a fully configured server instance.
// The stdio and HTTP entry points both call it.
export function createTrailheadServer() {
  const server = new McpServer({ name: 'trailhead', version: '1.0.0' });
  registerTools(server);
  registerContext(server);
  return server;
}
