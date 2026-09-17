# HintFlow 💡

> **Learn how to think, not what to type.**

HintFlow is a modern, privacy-focused, **100% client-side** Chrome extension that transforms LeetCode into an interactive technical interview and coaching experience. 

Instead of dumping full solutions or giving away answers, HintFlow inspects your current code and the problem context in real-time to provide **progressive hints**, **Socratic probing questions**, and **1-click tracking to Google Sheets**.

---

## ✨ Features

- 🧠 **Code-Aware Adaptive Hints**: 5-tier progressive nudges (from broad intuition to targeted logic checks) without spoiling the answer.
- 🎯 **FAANG Interviewer Mode**: Realistic senior interviewer persona that challenges your time/space complexity, edge cases, and algorithmic trade-offs.
- ⚡ **100% Client-Side Architecture**: **No backend server required!** All AI calls (Google Gemini or Groq) and OAuth operations run directly and securely inside your browser.
- 📊 **1-Click Google Sheets Sync**: Automatically detects accepted submissions on LeetCode and formats your tracker spreadsheet with color-coded difficulty badges, runtimes, and notes.
- 🤖 **Multi-Provider AI**:
  - **Google AI Studio**: Powered by Gemini 3.6 Flash, Gemini 3.5 Flash, and Gemini 2.0 Flash.
  - **Groq Cloud**: Ultra-fast inference with Llama 3.3 70B, Llama 3.1 8B, and Gemma 2.
- 🛡️ **Privacy & Security**: Your API keys and code never touch third-party servers. All data is saved exclusively in your browser's encrypted local storage (`chrome.storage.local`).

---

## 🏗️ Project Architecture

```
hintflow/
├── extension/             # Standalone Chrome Extension (Manifest V3)
│   ├── assets/            # Icons and branding
│   ├── parser/            # LeetCode DOM & Monaco editor parsers
│   ├── popup/             # Extension toolbar popup (Google Sheets status)
│   ├── ui/                # Sidebar interface, chat view & settings
│   ├── background.js      # Service worker for Google OAuth & Sheets API
│   ├── content.js         # Injects sidebar into LeetCode problems
│   ├── inject.js          # Monaco editor & network submission interceptor
│   ├── manifest.json      # Extension configuration & permissions
│   └── styles.css         # Clean, LeetCode-matching dark theme styles
├── frontend/              # Official HintFlow landing page & product showcase
│   ├── src/               # React + Tailwind CSS web interface
│   └── package.json       # Landing page dependencies & Vite build
└── README.md              # Project documentation
```

---

## 🚀 Quick Start Guide

### 1. Install the Extension in Chrome

1. Clone this repository:
   ```bash
   git clone https://github.com/mukul1421/hintflow.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `extension` folder inside this repository.
5. HintFlow is now installed!

---

### 2. Configure Your AI Provider

1. Open any LeetCode problem (e.g. [Two Sum](https://leetcode.com/problems/two-sum/)).
2. Click the floating **HintFlow** icon on the right side of your screen to open the sidebar.
3. Click **⚙️ Settings** at the bottom:
   - **Google AI Studio (Recommended)**: Get a free API key from [aistudio.google.com](https://aistudio.google.com/), paste it in, and select `Gemini 3.6 Flash (Recommended)`.
   - **Groq Cloud (Ultra Fast)**: Get a free key from [console.groq.com](https://console.groq.com/), paste it in, and select `Llama 3.3 70B` or `Llama 3.1 8B`.
4. Click **Test Connection** to confirm connectivity, then click **Save & Close**.

---

### 3. (Optional) Connect Google Sheets Tracker

1. Click the HintFlow extension icon in your Chrome toolbar.
2. Click **🔑 Connect Google Account**.
3. Authorize Google Drive/Sheets permission.
4. Whenever your submission is marked **Accepted** on LeetCode, HintFlow will offer to record the problem, difficulty, runtime, time spent, and notes into your personalized spreadsheet automatically!

---

## 🎮 How to Use HintFlow

| Action | Description |
| :--- | :--- |
| **Hint Mode** | Click **Next Hint** to receive level-by-level guidance tailored to your current code. |
| **Interviewer Mode** | Chat with an analytical FAANG interviewer who challenges your logic and complexity without giving the answer away. |
| **Analysis Tab** | View estimated time complexity, space complexity, and optimal solution progress. |
| **Quick Action Buttons** | Instantly request help when you are `😢 Stuck`, have `🐞 Wrong Code`, need `🛡️ Edge Cases`, or want an `🚀 Optimize` check. |

---

## 📜 License

This project is licensed under the MIT License.