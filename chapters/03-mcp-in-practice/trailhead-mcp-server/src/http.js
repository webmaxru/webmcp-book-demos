import { createServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  toNodeHandler, localhostHostValidation, localhostOriginValidation
} from '@modelcontextprotocol/node';
import { createTrailheadServer } from './server.js';

const PORT = Number(process.env.PORT ?? 3000);

// The factory runs once per request, so the endpoint holds no state.
const handler = createMcpHandler(createTrailheadServer);
const nodeHandler = toNodeHandler(handler);
const validateHost = localhostHostValidation();     // blocks DNS rebinding
const validateOrigin = localhostOriginValidation();

createServer((req, res) => {
  if (!validateHost(req, res) || !validateOrigin(req, res)) return;
  void nodeHandler(req, res);
}).listen(PORT, '127.0.0.1', () => {
  console.error(`Trailhead MCP server on http://127.0.0.1:${PORT}/mcp`);
});
