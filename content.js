// content.js — Main content script.
// Detects the platform, injects the Coreprompt button, and orchestrates the flow.

(function () {
  'use strict';

  // Inject the floating button
  function injectButton() {
    if (document.getElementById('coreprompt-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'coreprompt-btn';
    btn.title = 'Generate system prompt from this conversation';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>Coreprompt</span>
    `;

    btn.addEventListener('click', handleButtonClick);
    document.body.appendChild(btn);
  }

  async function handleButtonClick() {
    // Build modal if not present
    createModal();
    showModal();
    setModalLoading(true);

    // Extract conversation
    const conversation = detectPlatformAndExtract();

    if (!conversation || conversation.length === 0) {
      setModalError(
        'No conversation found on this page. Make sure you have an active conversation and try again.\n\n' +
          'If the conversation exists but is not detected, the page structure may have changed — please report this.'
      );
      return;
    }

    // Send to background for Gemini API call
    chrome.runtime.sendMessage(
      { type: 'GENERATE_PROMPT', conversation },
      (response) => {
        if (chrome.runtime.lastError) {
          setModalError('Extension error: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response.success) {
          setModalResult(response.prompt);
        } else {
          setModalError(response.error || 'Unknown error occurred.');
        }
      }
    );
  }

  // Wait for the page to be ready before injecting
  function init() {
    injectButton();
  }

  // Some SPA platforms load content asynchronously; retry injection if needed
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-inject on SPA navigation (URL changes without full page reload)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(init, 1000);
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
