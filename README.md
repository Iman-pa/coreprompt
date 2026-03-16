# Coreprompt

**Coreprompt** is a Chrome extension that analyzes your current AI conversation and generates a structured system prompt — so you can continue seamlessly in a new chat session or switch between AI platforms without losing context.

---

## The Problem

AI conversations have limits. When you hit a token cap, start a new session, or want to move from one AI platform to another, you lose all the context you've built up — the decisions you've made, the constraints you've established, the direction you were heading.

Coreprompt solves this by extracting your conversation and using Gemini to distill it into a reusable system prompt that captures what actually matters.

---

## How It Works

1. Open any supported AI platform with an active conversation
2. Click the floating **Coreprompt** button (bottom-right of the page)
3. Gemini analyzes the conversation and generates a structured prompt covering:
   - **Main topic & context**
   - **Key decisions & conclusions**
   - **Your thinking style & preferences**
   - **Established facts & constraints**
   - **Open questions & next steps**
4. Copy the generated prompt and paste it into any new chat

---

## Supported Platforms

| Platform | URL |
|---|---|
| ChatGPT | chatgpt.com / chat.openai.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| Grok | grok.com |
| Perplexity | perplexity.ai |

---

## Setup

### 1. Get a Gemini API Key

Go to [aistudio.google.com](https://aistudio.google.com) and create a free API key.

### 2. Install the Extension

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder

### 3. Configure Your API Key

1. Click the Coreprompt icon in the Chrome toolbar
2. Paste your Gemini API key into the settings field
3. Click **Save**

You're ready to go.

---

## Tech Stack

- **Vanilla JavaScript** — no frameworks, no build step
- **Chrome Extensions Manifest V3** — service worker, content scripts, sync storage
- **Google Gemini API** — `gemini-2.0-flash` model for conversation analysis
- **Vanilla CSS3** — dark theme, flexbox, animations

---

## Project Structure

```
coreprompt/
├── manifest.json         # Extension configuration and permissions
├── background.js         # Service worker — handles Gemini API requests
├── content.js            # Injected into AI pages — button & orchestration
├── extractors.js         # Platform-specific conversation DOM extractors
├── modal.js              # In-page modal UI for displaying results
├── content.css           # Styles for button and modal
├── popup/
│   ├── popup.html        # Settings page
│   ├── popup.js          # API key management logic
│   └── popup.css         # Settings page styles
└── icons/                # Extension icons (16, 48, 128px + SVG)
```

---

## Privacy

- Your conversation text is sent to the **Gemini API** for analysis — no other external services.
- Your API key is stored in **Chrome's encrypted sync storage** and never transmitted elsewhere.
- No analytics, no tracking, no servers of our own.

---

## License

[MIT](LICENSE)
