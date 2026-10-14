// AFTER: feature detection that also spots outdated code paths.
export function webmcpStatus() {
  if ('modelContext' in document) return 'current';           // document.modelContext
  if ('modelContext' in navigator) return 'legacy-navigator'; // a pre-May-2026 build
  return 'unavailable';
}
