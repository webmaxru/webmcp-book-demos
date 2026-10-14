// Result shapes shared by every tool on the page: Chapter 6's fail(), plus
// three siblings. `status` is what the agent reads first; it says who acts next.

// The agent can fix this itself: other arguments, or another tool first.
export const fail = (code, message, details = {}) =>
  ({ status: 'error', code, message, ...details });

// A rule says no. Other arguments won't help; the user has to decide.
export const refuse = (code, message, details = {}) =>
  ({ status: 'refused', code, message, ...details });

// Only the user knows the answer. Ask them, then call again.
export const needsInput = (missing, message, details = {}) =>
  ({ status: 'needs_input', code: 'MISSING_INFORMATION', missing, message, ...details });

// The user said no in the page's own UI. Don't retry unless they ask.
export const cancelledByUser = (message) =>
  ({ status: 'cancelled_by_user', message });
