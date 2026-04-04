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

const SIGNAL_PHRASES = [
  "here's the", "bottom line", "go with", "the right move",
  "my recommendation", "in short",
];

// Compress a group of consecutive messages into one sentence.
// Groups consecutive messages by role; takes the first sentence of
// the first message as a representative summary.
function compressGroup(msgs) {
  const role = msgs[0].role;
  const combined = msgs.map((m) => m.content).join(' ');
  // Take up to the first sentence boundary, capped at 120 chars
  const sentenceEnd = combined.search(/[.!?](\s|$)/);
  const snippet = sentenceEnd > 0
    ? combined.slice(0, sentenceEnd + 1)
    : combined.slice(0, 120);
  const suffix = msgs.length > 1 ? ` [+${msgs.length - 1} compressed]` : ' [compressed]';
  return `${role}: ${snippet}${suffix}`;
}

// Build the compressed conversation string under 1600 chars.
// Rules:
//   1. First 3 and last 3 messages are always included in full.
//   2. Middle messages containing a signal phrase are included in full.
//   3. Remaining middle messages are grouped by consecutive role and
//      each group is compressed to one sentence.
//   4. Hard cap at 1600 chars.
function compressConversation(conversation) {
  const CHAR_BUDGET = 1600;

  // Short conversations — include everything
  if (conversation.length <= 6) {
    const lines = conversation.map((m) => `${m.role}: ${m.content}`);
    const text = lines.join('\n\n---\n\n');
    return text.length > CHAR_BUDGET ? text.slice(0, CHAR_BUDGET) + '\n[Truncated]' : text;
  }

  const head = conversation.slice(0, 3);
  const tail = conversation.slice(-3);
  const middle = conversation.slice(3, -3);

  const hasSignal = (msg) =>
    SIGNAL_PHRASES.some((p) => msg.content.toLowerCase().includes(p));

  // Walk middle messages: flush non-signal groups when a signal message appears
  const middleLines = [];
  let group = [];

  const flushGroup = () => {
    if (group.length > 0) {
      middleLines.push(compressGroup(group));
      group = [];
    }
  };

  for (const msg of middle) {
    if (hasSignal(msg)) {
      flushGroup();
      middleLines.push(`${msg.role}: ${msg.content}`);
    } else {
      // Start a new group when role changes
      if (group.length > 0 && group[group.length - 1].role !== msg.role) {
        flushGroup();
      }
      group.push(msg);
    }
  }
  flushGroup();

  const lines = [
    ...head.map((m) => `${m.role}: ${m.content}`),
    ...middleLines,
    ...tail.map((m) => `${m.role}: ${m.content}`),
  ];

  const text = lines.join('\n\n---\n\n');
  return text.length > CHAR_BUDGET ? text.slice(0, CHAR_BUDGET) + '\n[Truncated]' : text;
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
