import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createTrailheadServer } from './server.js';

const handle = serveStdio(createTrailheadServer);

// stdout carries JSON-RPC, so log to stderr.
console.error('Trailhead MCP server running on stdio');
process.on('SIGINT', () => void handle.close());
