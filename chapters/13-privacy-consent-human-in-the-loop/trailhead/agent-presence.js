// Tell everyone, including screen-reader users, when an agent is acting on this page.
export function showAgentPresence() {
  if (!('modelContext' in document)) return;
  const banner = document.querySelector('#agent-presence');   // role="status" in the HTML
  const titles = new Map();

  async function refreshTitles() {
    for (const t of await document.modelContext.getTools()) titles.set(t.name, t.title ?? t.name);
  }
  document.modelContext.addEventListener('toolchange', refreshTitles);
  refreshTitles();

  document.modelContext.addEventListener('toolactivated', (e) => {
    banner.textContent = `An assistant is using Trailhead: ${titles.get(e.toolName) ?? e.toolName}.`;
    banner.hidden = false;
  });
  document.modelContext.addEventListener('toolcancel', (e) => {
    banner.textContent = `The assistant stopped: ${titles.get(e.toolName) ?? e.toolName}.`;
  });
}
