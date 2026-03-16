// extractors.js
// Per-platform conversation extractors.
// Each extractor returns an array of { role: 'User' | 'Assistant', content: string }.
// Selectors are based on current DOM structures and may need updating as platforms change.

const PLATFORM_EXTRACTORS = {
  chatgpt: {
    matches: (host) => host.includes('chatgpt.com') || host.includes('chat.openai.com'),
    extract() {
      const messages = [];
      // ChatGPT uses data-message-author-role attribute on message containers
      const turns = document.querySelectorAll('[data-message-author-role]');
      turns.forEach((turn) => {
        const role = turn.getAttribute('data-message-author-role');
        // Content lives in a .markdown div or directly as whitespace-pre-wrap text
        const contentEl = turn.querySelector('.markdown, .whitespace-pre-wrap, [class*="prose"]');
        const content = (contentEl || turn).innerText.trim();
        if (content) {
          messages.push({ role: role === 'user' ? 'User' : 'Assistant', content });
        }
      });
      return messages;
    },
  },

  claude: {
    matches: (host) => host.includes('claude.ai'),
    extract() {
      const messages = [];
      // Claude uses data-testid on turn containers
      const turns = document.querySelectorAll('[data-testid="human-turn"], [data-testid="ai-turn"]');
      turns.forEach((turn) => {
        const isHuman = turn.getAttribute('data-testid') === 'human-turn';
        const content = turn.innerText.trim();
        if (content) {
          messages.push({ role: isHuman ? 'User' : 'Assistant', content });
        }
      });
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
