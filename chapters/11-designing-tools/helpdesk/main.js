// Widget demo page wiring (not printed in the book). Single origin here;
// Chapter 7's demo runs the same widget cross-origin inside Ledgerly.
import { renderTicketForm } from './widget-form.js';
import { registerWidgetTools } from './widget-tools.js';

renderTicketForm(document.getElementById('widget'));
if ('modelContext' in document) {
  await registerWidgetTools({ signal: new AbortController().signal });
}
window.__ready = true;
