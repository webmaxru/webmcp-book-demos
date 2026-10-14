// tool-catalog.ts: Trailhead's agent-facing surface, owned like product copy.
export type Journey = 'discover' | 'decide' | 'buy' | 'support';

export interface CatalogEntry {
  name: string;
  title: string;
  description: string;
  journey: Journey;              // which user journey this tool serves
  owner: string;                 // the team that answers for its behaviour
  evalSuite: string;             // the task suite that must pass before it ships
  annotations: WebMCP.ToolAnnotations;
}

export const toolCatalog = [
  {
    name: 'search_products',
    title: 'Search products',
    description:
      'Search Trailhead outdoor gear by keyword, with optional category, ' +
      'maximum price in NOK and an in-stock filter. Shows the results on ' +
      'the page and returns up to 10 products with SKU, name, price and rating.',
    journey: 'discover', owner: 'search', evalSuite: 'evals/search.jsonl',
    annotations: { readOnlyHint: true },
  },
  {
    name: 'compare_products',
    title: 'Compare products',
    description:
      'Compare 2 to 4 products side by side by SKU. Opens the comparison ' +
      'table on the page and returns the same rows: price, weight, rating, stock.',
    journey: 'decide', owner: 'search', evalSuite: 'evals/compare.jsonl',
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_to_cart',
    title: 'Add to cart',
    description:
      'Add a product to the shopping cart by SKU, quantity 1 to 10. ' +
      'Updates the cart badge and returns the new cart total in NOK.',
    journey: 'buy', owner: 'checkout', evalSuite: 'evals/cart.jsonl',
    annotations: {},
  },
  {
    name: 'get_cart',
    title: 'Show cart',
    description: 'Return the items in the cart with quantities and the total in NOK.',
    journey: 'buy', owner: 'checkout', evalSuite: 'evals/cart.jsonl',
    annotations: { readOnlyHint: true },
  },
  {
    name: 'checkout',
    title: 'Go to checkout',
    description:
      'Open the checkout summary for the current cart. The customer reviews ' +
      'the order and places it with their own click; this tool never pays.',
    journey: 'buy', owner: 'checkout', evalSuite: 'evals/checkout.jsonl',
    annotations: { consequentialHint: true },
  },
] as const satisfies readonly CatalogEntry[];

export type ToolName = (typeof toolCatalog)[number]['name'];
