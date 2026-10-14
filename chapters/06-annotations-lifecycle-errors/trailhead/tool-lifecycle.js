import { activityLog, agentBanner } from './ui.js';

// Page-wide observers. They see every tool on this document, including ones
// registered by other modules, but only two moments of each call.
export function watchToolLifecycle({ signal }) {
  const mc = document.modelContext;
  mc.addEventListener('toolactivated', (e) => {                       // ①
    activityLog.add(`▶ ${e.toolName}`);
  }, { signal });
  mc.addEventListener('toolcancel', (e) => {                          // ②
    activityLog.add(`■ ${e.toolName} cancelled`);
  }, { signal });
}

// There is no "tool finished" event, so a tool that wants the page to show
// "agent working…" until it settles wraps its own execute callback.
export function tracked(name, execute) {                               // ③
  return async (input, options) => {
    agentBanner.start(name);
    try {
      return await execute(input, options);
    } finally {
      agentBanner.end(name);           // runs on success, failure and cancellation
    }
  };
}
