// modal.js — In-page result modal injected by the content script.

function createModal() {
  // Prevent duplicate
  if (document.getElementById('coreprompt-modal-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'coreprompt-modal-overlay';
  overlay.innerHTML = `
    <div id="coreprompt-modal">
      <div id="coreprompt-modal-header">
        <span id="coreprompt-modal-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          Coreprompt
        </span>
        <button id="coreprompt-modal-close" title="Close">✕</button>
      </div>

      <div id="coreprompt-modal-body">
        <div id="coreprompt-loading" class="coreprompt-hidden">
          <div class="coreprompt-spinner"></div>
          <span>Analyzing conversation with Gemini…</span>
        </div>

        <div id="coreprompt-error" class="coreprompt-hidden">
          <div id="coreprompt-error-text"></div>
        </div>

        <textarea id="coreprompt-output" placeholder="Your structured system prompt will appear here…" readonly></textarea>
      </div>

      <div id="coreprompt-modal-footer">
        <span id="coreprompt-char-count"></span>
        <button id="coreprompt-copy-btn" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy prompt
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close handlers
  document.getElementById('coreprompt-modal-close').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Copy handler
  document.getElementById('coreprompt-copy-btn').addEventListener('click', () => {
    const text = document.getElementById('coreprompt-output').value;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('coreprompt-copy-btn');
      btn.textContent = '✓ Copied!';
      btn.classList.add('coreprompt-copied');
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          Copy prompt`;
        btn.classList.remove('coreprompt-copied');
      }, 2000);
    });
  });
}

function showModal() {
  const overlay = document.getElementById('coreprompt-modal-overlay');
  if (overlay) overlay.classList.add('coreprompt-visible');
}

function closeModal() {
  const overlay = document.getElementById('coreprompt-modal-overlay');
  if (overlay) overlay.classList.remove('coreprompt-visible');
}

function setModalLoading(isLoading) {
  document.getElementById('coreprompt-loading').classList.toggle('coreprompt-hidden', !isLoading);
  document.getElementById('coreprompt-output').classList.toggle('coreprompt-hidden', isLoading);
  document.getElementById('coreprompt-error').classList.add('coreprompt-hidden');
  document.getElementById('coreprompt-copy-btn').disabled = isLoading;
}

function setModalResult(text) {
  const output = document.getElementById('coreprompt-output');
  const charCount = document.getElementById('coreprompt-char-count');
  output.value = text;
  charCount.textContent = `${text.length.toLocaleString()} chars`;
  document.getElementById('coreprompt-copy-btn').disabled = false;
  document.getElementById('coreprompt-loading').classList.add('coreprompt-hidden');
  output.classList.remove('coreprompt-hidden');
}

function setModalError(message) {
  document.getElementById('coreprompt-loading').classList.add('coreprompt-hidden');
  document.getElementById('coreprompt-output').classList.add('coreprompt-hidden');
  const errorEl = document.getElementById('coreprompt-error');
  document.getElementById('coreprompt-error-text').textContent = message;
  errorEl.classList.remove('coreprompt-hidden');
}
