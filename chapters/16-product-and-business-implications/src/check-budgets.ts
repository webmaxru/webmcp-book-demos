// check-budgets.ts: fail the build when agent-facing text outgrows its budget.
import type { CatalogEntry } from './tool-catalog.js';

// Chrome's provisional character budgets (WebMCP tool security guidance).
export const BUDGET = { name: 30, description: 500, parameterDescription: 150 };

export function checkBudgets(catalog: readonly CatalogEntry[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const tool of catalog) {
    if (tool.name.length > BUDGET.name) {
      problems.push(`${tool.name}: name is ${tool.name.length} characters`);
    }
    if (tool.description.length > BUDGET.description) {
      problems.push(`${tool.name}: description is ${tool.description.length} characters`);
    }
    if (seen.has(tool.name)) problems.push(`${tool.name}: duplicate name`);
    seen.add(tool.name);
    if (!tool.owner || !tool.evalSuite) problems.push(`${tool.name}: no owner or eval suite`);
  }
  return problems;
}
