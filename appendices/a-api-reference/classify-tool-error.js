// Listing A.2: classify an executeTool() rejection in a way that works with both
// the 14 October 2026 draft's exception names and Chromium 156's.
export function classifyToolError(err) {
  const name = err && err.name;
  switch (name) {
    case 'AbortError':
      return { kind: 'cancelled', retry: false };   // caller's signal, or (draft) target unloaded
    case 'NotAllowedError':
      return { kind: 'blocked', retry: false };     // "tools" Permissions Policy says no
    case 'SecurityError':
      return { kind: 'bad-origin', retry: false };  // exposedTo / fromOrigins not secure
    case 'NotFoundError':                           // draft: tool gone or not exposed
    case 'InvalidStateError':                       // document inactive or other tab
      return { kind: 'gone', retry: true };         // re-read getTools(), then retry
    case 'OperationError':                          // draft: the tool threw or rejected
    case 'UnknownError':                            // Chromium 156: all of the above
      return { kind: 'failed', retry: true };
    default:
      return { kind: 'error', retry: false };
  }
}
