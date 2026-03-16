// background.js — Service worker
// Handles Gemini API calls from content scripts.

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an expert at analyzing AI conversations and distilling their essence into reusable system prompts.

Given the conversation below, generate a structured system prompt that a user can paste into a new AI chat session to immediately resume with full context. The system prompt should capture:

1. **Main Topic & Context** — What this conversation is fundamentally about.
2. **Key Decisions & Conclusions** — What was decided, chosen, or resolved, and why.
3. **User's Thinking Style & Preferences** — How the user approaches problems, communicates, and what they seem to value.
4. **Established Facts & Constraints** — Any important information, rules, or constraints that were set.
5. **Open Questions & Next Steps** — Unresolved issues, pending decisions, or the logical next things to tackle.

Output the system prompt directly — no preamble, no explanation. Start with "You are continuing a conversation with a user. Here is the full context:" and then provide the structured content. Use clear headers. Be thorough but concise.`;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_PROMPT') {
    handleGeneratePrompt(message.conversation)
      .then((result) => sendResponse({ success: true, prompt: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

async function handleGeneratePrompt(conversation) {
  const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
  if (!geminiApiKey) {
    throw new Error('No Gemini API key found. Please set it in the Coreprompt extension settings.');
  }

  const conversationText = conversation
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n\n---\n\n');

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
      maxOutputTokens: 2048,
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
