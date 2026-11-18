// webmcp/enable.js: decide once, at start-up, how this page can talk to agents.
const POLYFILL = {
  src: 'https://cdn.jsdelivr.net/npm/@w3c/webmcp-polyfill@0.1.1/dist/polyfill.js',
  integrity: 'sha256-qMH/jOVlACK6Z8tBBAsrXkzDga2qXWJKAXR7J+20Kok='
};

export async function enableWebMCP({ polyfill = false } = {}) {
  if (!window.isSecureContext) return { mode: 'off', reason: 'insecure-context' };
  if ('modelContext' in document) return { mode: 'native' };
  if (!polyfill) return { mode: 'off', reason: 'not-supported' };
  try {
    await loadScript(POLYFILL);          // the script bundle installs itself
  } catch {
    return { mode: 'off', reason: 'polyfill-failed' };
  }
  return 'modelContext' in document
    ? { mode: 'polyfill' }
    : { mode: 'off', reason: 'polyfill-declined' };
}

function loadScript({ src, integrity }) {
  return new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'),
      { src, integrity, crossOrigin: 'anonymous' });
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
  });
}
