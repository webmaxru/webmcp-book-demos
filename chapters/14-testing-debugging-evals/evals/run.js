// Command line: run the Fjord Table suite with a scripted or a real agent.
//   node evals/run.js --agent=careful|sloppy|chat --runs=5
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { runSuite } from './run-evals.js';
import { fjordTablePage } from './fjord-table-page.js';
import { chatAgent } from './chat-agent.js';
import { scriptedAgent } from '../tests/fixtures/scripted-agents.js';
import { serve } from '../tests/fixtures/serve.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const runs = Number(args.runs ?? 3);
const agent = args.agent === 'chat' ? chatAgent() : scriptedAgent(args.agent ?? 'careful');
const suite = JSON.parse(await readFile(new URL('./fjord-table.evals.json', import.meta.url)));

const site = await serve(new URL('../../../fjord-table/', import.meta.url));
const browser = await chromium.launch({ args: ['--enable-features=WebMCPTesting'] });
try {
  const report = await runSuite({ suite, runs, agent, openPage: fjordTablePage(browser, site.url) });
  for (const r of report) {
    console.log(`${(r.passRate * 100).toFixed(0).padStart(4)}%  ${r.passed}/${r.runs}  ${r.name}`);
    for (const f of new Set(r.failures)) console.log(`        ✗ ${f}`);
  }
  console.log(JSON.stringify({ agent: args.agent ?? 'careful', model: process.env.EVAL_MODEL, runs,
    chromium: browser.version(), date: new Date().toISOString(), report }, null, 2));
} finally {
  await browser.close();
  await site.close();
}
