// Listing 5.3 (Chapter 5): a defensive registration helper. Unchanged from the book.
// agent-tools.js, loaded with <script type="module">
export const webmcpAvailable = 'modelContext' in document;

if (!webmcpAvailable && !window.isSecureContext) {
  console.info('WebMCP needs a secure context (HTTPS or localhost).');
}

// Registers one tool. Resolves to true if it was registered, false otherwise.
export async function registerAgentTool(tool, options = {}) {
  if (!webmcpAvailable) return false;
  try {
    await document.modelContext.registerTool(tool, options);
    return true;
  } catch (err) {
    // The view closed (signal aborted) before registration finished: not an error.
    if (options.signal?.aborted) return false;
    // NotAllowedError   – the "tools" permissions policy blocks this frame
    // InvalidStateError – duplicate or malformed name, empty description,
    //                     or a document that is no longer fully active
    // TypeError         – a required member is missing, or the schema
    //                     can't be serialized to JSON
    // SecurityError     – an exposedTo entry isn't a secure origin (Chapter 7)
    console.warn(`WebMCP: "${tool.name}" was not registered`, err.name, err.message);
    return false;
  }
}
