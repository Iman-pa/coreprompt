// extractors.js
// Per-platform conversation extractors.
// Each extractor returns an array of { role: 'User' | 'Assistant', content: string }.
// Selectors are based on current DOM structures and may need updating as platforms change.
//
// DEBUG MODE: open the browser console on a supported page and run:
//   window.__corepromptDebug = true
// Then click the Coreprompt button. Detailed selector results will be logged.

const DEBUG = () => true; // TEMP: hardcoded for debugging — revert before shipping

function dbg(...args) {
  if (DEBUG()) console.log('[Coreprompt]', ...args);
}

function probeSelector(label, selector) {
  if (!DEBUG()) return;
  const els = document.querySelectorAll(selector);
  console.log(`[Coreprompt]   ${label} ("${selector}") → ${els.length} element(s)`);
  els.forEach((el, i) => {
    console.log(`[Coreprompt]     [${i}]`, el, `| text: "${el.innerText.trim().slice(0, 80)}"`);
  });
}

const PLATFORM_EXTRACTORS = {
  chatgpt: {
    matches: (host) => host.includes('chatgpt.com') || host.includes('chat.openai.com'),
    extract() {
      const messages = [];
      dbg('--- ChatGPT extractor ---');
      probeSelector('data-message-author-role', 'div[data-message-author-role]');

      const turns = document.querySelectorAll('div[data-message-author-role]');
      turns.forEach((turn) => {
        const role = turn.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') return;
        // Prefer the markdown/prose container; fall back to the turn element itself
        const contentEl =
          turn.querySelector('.markdown') ||
          turn.querySelector('[class*="prose"]') ||
          turn.querySelector('.whitespace-pre-wrap') ||
          turn;
        const content = contentEl.innerText.trim();
        dbg(`  turn role="${role}" content="${content.slice(0, 80)}"`);
        if (content) {
          messages.push({ role: role === 'user' ? 'User' : 'Assistant', content });
        }
      });

      dbg(`extracted ${messages.length} message(s)`);
      return messages;
    },
  },

  claude: {
    matches: (host) => host.includes('claude.ai'),
    extract() {
      const messages = [];
      console.log('[Coreprompt] page HTML sample:', document.body.innerHTML.slice(0, 1000));
      dbg('--- Claude extractor ---');
      probeSelector('user-message (data-testid)', '[data-testid="user-message"]');
      probeSelector('font-claude-response (all)', '.font-claude-response');
      probeSelector('font-claude-response inside #markdown-artifact', '#markdown-artifact .font-claude-response');
      // Extra probes to help spot the real selectors if ours are wrong
      probeSelector('PROBE: data-testid="human-turn" (old)', '[data-testid="human-turn"]');
      probeSelector('PROBE: data-testid="ai-turn" (old)', '[data-testid="ai-turn"]');
      probeSelector('PROBE: any [data-testid] on page', '[data-testid]');

      const tagged = [];

      document.querySelectorAll('[data-testid="user-message"]').forEach((el) => {
        tagged.push({ el, role: 'User' });
      });

      // Exclude artifact/canvas panels which share the class
      document.querySelectorAll('.font-claude-response').forEach((el) => {
        if (!el.closest('#markdown-artifact')) {
          tagged.push({ el, role: 'Assistant' });
        }
      });

      dbg(`before sort: ${tagged.length} tagged element(s)`);

      // Sort by DOM position so messages appear in conversation order
      tagged.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      tagged.forEach(({ el, role }) => {
        const content = el.innerText.trim();
        dbg(`  role="${role}" content="${content.slice(0, 80)}"`);
        if (content) messages.push({ role, content });
      });

      dbg(`extracted ${messages.length} message(s)`);
      return messages;
    },
  },

  gemini: {
    matches: (host) => host.includes('gemini.google.com'),
    extract() {
      const messages = [];
      // Gemini uses custom elements: <user-query> and <model-response>
      const turns = document.querySelectorAll('user-query, model-response');
      if (turns.length > 0) {
        turns.forEach((turn) => {
          const isUser = turn.tagName.toLowerCase() === 'user-query';
          const content = turn.innerText.trim();
          if (content) {
            messages.push({ role: isUser ? 'User' : 'Assistant', content });
          }
        });
      } else {
        // Fallback selectors
        const userEls = document.querySelectorAll('.query-text, .user-query-text, [class*="user-query"]');
        const aiEls = document.querySelectorAll('.response-content, [class*="model-response"]');
        userEls.forEach((el) => {
          if (el.innerText.trim()) messages.push({ role: 'User', content: el.innerText.trim() });
        });
        aiEls.forEach((el) => {
          if (el.innerText.trim()) messages.push({ role: 'Assistant', content: el.innerText.trim() });
        });
      }
      return messages;
    },
  },

  grok: {
    matches: (host) => host.includes('grok.com'),
    extract() {
      const messages = [];
      // Grok renders messages in alternating containers
      // User messages tend to be right-aligned; assistant messages left-aligned
      const userMsgs = document.querySelectorAll('[class*="userMessage"], [data-testid="userMessage"]');
      const assistantMsgs = document.querySelectorAll('[class*="assistantMessage"], [data-testid="assistantMessage"], [class*="responseText"]');

      // Try to get them in document order
      const allMsgEls = document.querySelectorAll(
        '[class*="userMessage"], [data-testid="userMessage"], [class*="assistantMessage"], [data-testid="assistantMessage"]'
      );

      if (allMsgEls.length > 0) {
        allMsgEls.forEach((el) => {
          const cls = (el.className || '') + (el.getAttribute('data-testid') || '');
          const isUser = cls.toLowerCase().includes('user');
          const content = el.innerText.trim();
          if (content) messages.push({ role: isUser ? 'User' : 'Assistant', content });
        });
      } else {
        // Broader fallback — grab all .prose blocks in order
        document.querySelectorAll('.prose, [class*="prose"]').forEach((el, i) => {
          if (el.innerText.trim()) {
            messages.push({ role: i % 2 === 0 ? 'User' : 'Assistant', content: el.innerText.trim() });
          }
        });
      }
      return messages;
    },
  },

  perplexity: {
    matches: (host) => host.includes('perplexity.ai'),
    extract() {
      const messages = [];
      // Perplexity shows question + answer pairs
      const questionEls = document.querySelectorAll('[class*="query"], [data-testid*="query"], .break-words');
      const answerEls = document.querySelectorAll('.prose, [class*="answer"], [data-testid*="answer"]');

      // Try interleaved approach first
      const threadItems = document.querySelectorAll('[class*="threadItem"], [class*="thread-item"]');
      if (threadItems.length > 0) {
        threadItems.forEach((item) => {
          const question = item.querySelector('[class*="query"], .font-display');
          const answer = item.querySelector('.prose');
          if (question?.innerText.trim()) messages.push({ role: 'User', content: question.innerText.trim() });
          if (answer?.innerText.trim()) messages.push({ role: 'Assistant', content: answer.innerText.trim() });
        });
      } else {
        // Flat fallback
        questionEls.forEach((el) => {
          if (el.innerText.trim()) messages.push({ role: 'User', content: el.innerText.trim() });
        });
        answerEls.forEach((el) => {
          if (el.innerText.trim()) messages.push({ role: 'Assistant', content: el.innerText.trim() });
        });
      }
      return messages;
    },
  },
};

function detectPlatformAndExtract() {
  const host = window.location.hostname;
  for (const [, extractor] of Object.entries(PLATFORM_EXTRACTORS)) {
    if (extractor.matches(host)) {
      return extractor.extract();
    }
  }
  return [];
}
