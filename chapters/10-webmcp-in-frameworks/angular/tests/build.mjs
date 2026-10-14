// Bundle the Angular listings for a JIT test run in Chromium (no Angular CLI needed).
import { build } from 'esbuild';
await build({
  entryPoints: [new URL('../src/main.ts', import.meta.url).pathname],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: new URL('../dist/main.js', import.meta.url).pathname,
  tsconfig: new URL('../tsconfig.json', import.meta.url).pathname,
  logLevel: 'warning',
});
console.log('built dist/main.js');
