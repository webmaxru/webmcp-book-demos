// Shape what goes back to the agent. Everything here is data, never instructions.
export const OUTPUT_BUDGET = 1500;            // characters per tool result

export function clip(text, max) {
  const s = String(text ?? '');
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function shapeArticles(articles) {
  const results = [];
  let used = 0;
  for (const a of articles) {
    const item = {
      id: a.id,
      title: clip(a.title, 120),
      source: a.authorType === 'staff' ? 'supportly-staff' : 'community',
      excerpt: clip(a.body, 300),
      url: a.url
    };
    used += JSON.stringify(item).length;
    if (used > OUTPUT_BUDGET) break;          // stop before the budget, never mid-item
    results.push(item);
  }
  return { results, truncated: results.length < articles.length };
}
