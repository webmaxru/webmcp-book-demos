// app.js: page wiring for the Fjord Table demo (demo code, not from the book).
// - a tiny hash router with three views: home, menu, book
// - book_table is registered only while the booking view is open (Listing 5.5)
// - the human search form calls the same availability.search() the agent tool calls
import { availability } from './availability.js';
import { bookingPanel } from './booking-panel.js';
import { webmcpAvailable } from './agent-tools.js';
import { onBookingViewOpened, onBookingViewClosed, relabelBookingTools } from './booking-view.js';

const $ = (sel) => document.querySelector(sel);
let currentView = null;
let toolLocale = 'en';

// ---- views -----------------------------------------------------------------
async function showView() {
  const view = { '#/book': 'book', '#/menu': 'menu' }[location.hash] ?? 'home';
  if (view === currentView) return;
  const previous = currentView;
  currentView = view;

  for (const section of document.querySelectorAll('[data-view]')) section.hidden = section.dataset.view !== view;
  for (const link of document.querySelectorAll('nav a')) {
    link.toggleAttribute('aria-current', link.getAttribute('href') === location.hash);
  }

  if (previous === 'book') onBookingViewClosed();
  if (view === 'book') {
    await onBookingViewOpened();
    if (toolLocale !== 'en') await relabelBookingTools(toolLocale);
  }
}

// ---- the human search form ---------------------------------------------------
let searchController = null;
$('#search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  searchController?.abort();
  searchController = new AbortController();
  const query = {
    date: form.elements.date.value,
    time: form.elements.time.value || undefined,
    partySize: Number(form.elements.partySize.value),
    signal: searchController.signal
  };
  $('#slots-heading').textContent = 'Searching…';
  try {
    bookingPanel.showSlots(await availability.search(query));
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }
});

// ---- tool language (exercises relabelBookingTools from Listing 5.5) --------------
$('#tool-locale').addEventListener('change', async (e) => {
  toolLocale = e.target.value;
  await relabelBookingTools(toolLocale);
});

// ---- WebMCP status chip -------------------------------------------------------
async function updateStatus() {
  const chip = $('#webmcp-status');
  if (!webmcpAvailable) {
    chip.textContent = 'WebMCP not available in this browser: works as a normal booking page';
    chip.dataset.state = 'off';
    return;
  }
  chip.dataset.state = 'on';
  try {
    if (typeof document.modelContext.getTools !== 'function') throw new Error('no getTools');
    const tools = await document.modelContext.getTools();
    chip.textContent = `WebMCP on · tools: ${tools.map((t) => t.name).join(', ') || 'none'}`;
  } catch {
    chip.textContent = 'WebMCP on';
  }
}
if (webmcpAvailable) document.modelContext.addEventListener?.('toolchange', updateStatus);

// ---- start ----------------------------------------------------------------------
const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateInput = $('#search-form').elements.date;
dateInput.min = isoLocal(new Date());
dateInput.value = isoLocal(new Date(Date.now() + 86400000));   // tomorrow

window.addEventListener('hashchange', showView);
await showView();
await updateStatus();
