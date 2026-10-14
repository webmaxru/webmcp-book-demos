// attribution.ts: remember which tools helped, attach it to the order.
const KEY = 'trailhead.agentAssist';

export function noteAgentAssist(toolName: string): void {
  const used = new Set<string>(JSON.parse(sessionStorage.getItem(KEY) ?? '[]'));
  used.add(toolName);
  sessionStorage.setItem(KEY, JSON.stringify([...used]));
}

// Called by the checkout page when the customer clicks "Place order".
export function orderAttribution(): { agentAssisted: boolean; toolsUsed: string[] } {
  const toolsUsed: string[] = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
  return { agentAssisted: toolsUsed.length > 0, toolsUsed };
}
