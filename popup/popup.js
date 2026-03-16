// popup.js — Settings popup logic

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');
  const toggleBtn = document.getElementById('toggle-visibility');

  // Load saved key
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
  if (geminiApiKey) {
    apiKeyInput.value = geminiApiKey;
  }

  // Toggle visibility
  toggleBtn.addEventListener('click', () => {
    const isHidden = apiKeyInput.type === 'password';
    apiKeyInput.type = isHidden ? 'text' : 'password';
    toggleBtn.title = isHidden ? 'Hide key' : 'Show key';
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      showStatus('Please enter an API key.', 'error');
      return;
    }
    if (!key.startsWith('AIza')) {
      showStatus('This doesn\'t look like a valid Google API key.', 'error');
      return;
    }

    await chrome.storage.sync.set({ geminiApiKey: key });
    showStatus('Saved!', 'success');
  });

  // Allow saving with Enter
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });

  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    clearTimeout(statusEl._timeout);
    statusEl._timeout = setTimeout(() => {
      statusEl.className = 'status hidden';
    }, 3000);
  }
});
