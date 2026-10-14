// Dev-only: a transparent stdio proxy that logs every JSON-RPC line to wire.log.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const log = process.env.WIRE_LOG ?? 'wire.log';
const child = spawn('node', ['src/stdio.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
createInterface({ input: process.stdin }).on('line', (line) => {
  appendFileSync(log, `>> ${line}\n`);
  child.stdin.write(line + '\n');
});
createInterface({ input: child.stdout }).on('line', (line) => {
  appendFileSync(log, `<< ${line}\n`);
  process.stdout.write(line + '\n');
});
process.stdin.on('end', () => child.stdin.end());
child.on('exit', (code) => process.exit(code ?? 0));
