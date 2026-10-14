// Ledgerly's in-page agent: find the tools it is allowed to use.
const SUPPORTLY = 'https://widget.supportly.example';

export async function discoverTools() {
  // Same-origin tools come back by default; Supportly's only if we ask
  // for its origin AND Supportly exposed them to us.
  const tools = await document.modelContext.getTools({ fromOrigins: [SUPPORTLY] });

  // Key every tool by origin + name: two frames may both register "search".
  const catalog = new Map();
  for (const tool of tools) {
    const vendor = tool.origin === location.origin ? 'ledgerly' : 'supportly';
    catalog.set(`${vendor}__${tool.name}`, tool);
  }
  return catalog;
}

export function watchTools(onChange, signal) {
  let pending = null;
  document.modelContext.addEventListener('toolchange', () => {
    // toolchange carries no details, and frames register tools one by one,
    // so coalesce bursts and re-read the whole list.
    clearTimeout(pending);
    pending = setTimeout(async () => onChange(await discoverTools()), 50);
  }, { signal });
}
