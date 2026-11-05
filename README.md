# AutoPOM - Selenium QA Copilot (VS Code & Antigravity Extension)

AutoPOM is an intelligent IDE extension for **VS Code** and **Antigravity IDE** designed to eliminate the most tedious parts of QA test automation:
- **Bulk DOM Scanning:** Scans interactive buttons, inputs, links, and forms at once without manual inspection.
- **Resilience-Ranked Locators:** Automatically selects and scores locators (`data-testid` > clean `id` > accessible `name`/`aria-label` > semantic CSS > relative XPath).
- **Instant Page Object Models:** Generates production-ready Page Object Model (POM) classes in **Python** and **Java** with fluent action methods and `WebDriverWait`.
- **In-Browser Visual Heatmap:** Injects numbered badges directly over interactive elements on live web pages.
- **Action Recorder & Smart Waits:** Records user interactions and correlates CDP network requests to synthesize dynamic explicit waits instead of brittle `sleep()` statements.
- **AI-Powered Refactoring:** Supports **Google Gemini**, **OpenAI**, and **Local Ollama** (`qwen2.5-coder`, `llama3.3`) for semantic element naming and component grouping with built-in PII sanitization.

---

## Architecture Overview

```
AutoPOM Extension Architecture
┌────────────────────────────────────────────────────────┐
│ VS Code / Antigravity IDE Host                         │
│                                                        │
│  ├── Sidebar Webview (UI Controls & Element List)     │
│  ├── Chrome CDP Controller (Port 9222 via puppeteer)  │
│  ├── Deterministic Locator Ranker                      │
│  ├── POM Generators (Python & Java Selenium)          │
│  ├── Action Recorder & Network Latency Monitor        │
│  └── AI Semantic Engine (Gemini / OpenAI / Ollama)     │
└───────────────────────────┬────────────────────────────┘
                            │ Chrome DevTools Protocol
┌───────────────────────────▼────────────────────────────┐
│ Target Chrome / Chromium Instance                      │
│                                                        │
│  ├── Injected DOM Scanner (Tree Walker & Visibility)   │
│  ├── Visual Badge & Heatmap Overlay (Shadow DOM)      │
│  └── Interaction Tracker (Clicks, Inputs, Changes)     │
└────────────────────────────────────────────────────────┘
```

---

## Getting Started & Development

### 1. Requirements
- Node.js 18+ (tested on Node v24)
- Google Chrome or Microsoft Edge installed

### 2. Install & Build
```bash
# Install dependencies
npm install

# Run TypeScript typecheck
npm run typecheck

# Run unit tests
npm test

# Build extension bundle
npm run build

# Watch mode for development
npm run watch
```

### 3. Running & Debugging in Antigravity / VS Code
1. Press `F5` in the IDE to open the **Extension Development Host**.
2. Click the **AutoPOM** target icon on the Activity Bar.
3. Click **"Launch & Connect Chrome"** to spawn a fresh, isolated Chrome session with CDP enabled.
4. Navigate to any test web page (e.g. `https://the-internet.herokuapp.com/login`).
5. Click **"Scan Page"** to view element badges in Chrome and inspect them in your IDE sidebar.
6. Click **"Export Page Object Model"** to generate the class file directly into your workspace.

---

## Extension Settings

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `autopom.chromePath` | string | `""` | Optional custom path to Chrome or Edge binary. |
| `autopom.cdpPort` | number | `9222` | Chrome remote debugging port. |
| `autopom.defaultLanguage` | string | `"python"` | Default generator language (`python` or `java`). |
| `autopom.aiProvider` | string | `"gemini"` | AI provider (`gemini`, `openai`, `anthropic`, `ollama`). |
| `autopom.aiApiKey` | string | `""` | API key for cloud LLMs (Gemini / OpenAI). |
| `autopom.ollamaEndpoint` | string | `"http://localhost:11434"` | Endpoint for local on-premise Ollama instances. |
| `autopom.ollamaModel` | string | `"qwen2.5-coder:latest"` | Model tag for local inference. |

