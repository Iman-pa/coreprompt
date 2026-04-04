// background.js — Service worker
// Handles Gemini API calls from content scripts.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an expert at analyzing AI conversations and distilling their essence into reusable system prompts.

Given the conversation below, generate a structured system prompt that a user can paste into a new AI chat session to immediately resume with full context.

RULES:
- Output the system prompt directly — no preamble, no explanation, no meta-commentary.
- Every sentence must be complete. Never truncate a point mid-thought.
- Be concise — 1 to 3 sentences per section is enough.
- Use clear markdown headers for each section.

The system prompt must contain exactly these seven sections:

1. **User Profile** — Who the user appears to be: their role, domain, experience level, and goals as inferred from the conversation.
2. **Tone & Style** — How the user communicates: formal or casual, preferred response length, use of bullet points vs prose, technical depth expected, and any stylistic patterns observed.
3. **Main Topic & Context** — What this conversation is fundamentally about and the situation that prompted it.
4. **Key Decisions & Conclusions** — What was decided, chosen, or resolved, and the reasoning behind each decision.
5. **Established Facts & Constraints** — All important information, rules, requirements, or constraints that were set and must be respected.
6. **Open Questions & Next Steps** — Every unresolved issue, pending decision, and the logical next things to tackle, in priority order.
7. **Behavioral Directive** — A direct instruction to the new AI instance: its exact role in this conversation, what it should and should not do, and how to pick up exactly where this conversation left off.

Start the output with: "You are continuing a conversation with a user. Here is the full context:"`;


async function logAvailableModels() {
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
  if (!geminiApiKey) {
    console.log('[Coreprompt] logAvailableModels: no API key set, skipping.');
    return;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`
    );
    const data = await res.json();
    if (!res.ok) {
      console.error('[Coreprompt] ListModels error:', data?.error?.message || res.status);
      return;
    }
    const names = (data.models || []).map((m) => m.name);
    console.log(`[Coreprompt] Available models (${names.length}):`);
    names.forEach((n) => console.log(' ', n));
  } catch (err) {
    console.error('[Coreprompt] ListModels fetch failed:', err.message);
  }
}

logAvailableModels();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_PROMPT') {
    handleGeneratePrompt(message.conversation)
      .then((result) => sendResponse({ success: true, prompt: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

// Compress the conversation to fit within ~2000 input tokens (~8000 chars).
// Strategy: keep the first 2 turns (establishes topic) and the last 10 turns
// (captures recent context and next steps), truncate each message to 300 chars,
// then hard-cap the total to 6000 chars as a final safety net.
function compressConversation(conversation) {
  const MAX_MSG_CHARS = 300;
  const CHAR_BUDGET = 6000;

  let head, tail, omittedCount;
  if (conversation.length <= 12) {
    head = conversation;
    tail = [];
    omittedCount = 0;
  } else {
    head = conversation.slice(0, 2);
    tail = conversation.slice(-10);
    omittedCount = conversation.length - 12;
  }

  const truncate = (msg) => ({
    ...msg,
    content: msg.content.length > MAX_MSG_CHARS
      ? msg.content.slice(0, MAX_MSG_CHARS) + '…'
      : msg.content,
  });

  const fmt = (msg) => `${msg.role}: ${msg.content}`;

  const parts = [];
  head.forEach((msg) => parts.push(fmt(truncate(msg))));
  if (omittedCount > 0) {
    parts.push(`[${omittedCount} turn(s) omitted]`);
  }
  tail.forEach((msg) => parts.push(fmt(truncate(msg))));

  const text = parts.join('\n\n---\n\n');
  return text.length > CHAR_BUDGET ? text.slice(0, CHAR_BUDGET) + '\n\n[Truncated]' : text;
}

async function handleGeneratePrompt(conversation) {
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
  if (!geminiApiKey) {
    throw new Error('No Gemini API key found. Please set it in the Coreprompt extension settings.');
  }

  const conversationText = compressConversation(conversation);

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${SYSTEM_PROMPT}\n\n<conversation>\n${conversationText}\n</conversation>`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API error (${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}
