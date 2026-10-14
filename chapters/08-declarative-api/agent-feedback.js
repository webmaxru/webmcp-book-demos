// agent-feedback.js: tell the person what the agent just did to a form.
const banner = document.querySelector('#agent-banner');

if ('modelContext' in document) {
  document.modelContext.addEventListener('toolactivated', ({ toolName }) => {
    if (toolName !== 'book_table') return;
    banner.textContent = 'Your assistant filled in this booking. ' +
      'Check the details, then press “Book table” to confirm.';
    banner.hidden = false;
    banner.scrollIntoView({ block: 'nearest' });
  });

  document.modelContext.addEventListener('toolcancel', ({ toolName }) => {
    if (toolName !== 'book_table') return;
    banner.textContent = 'Your assistant stopped this booking. Nothing was booked.';
  });
}
