class HintFlowSidebar {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.shadowRoot = container.attachShadow({ mode: 'open' });

    // UI state
    this.isOpen = false;
    this.activeTab = 'interviewer'; // 'interviewer' | 'hints' | 'analysis'
    this.currentCode = "";
    this.currentLanguage = "";
    this.isResponding = false;
    this.activeAcceptedData = null;
    this.sheetMode = 'existing';

    // Logo Asset URL
    this.logoUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('assets/logo.png')
      : 'assets/logo.png';

    // Conversation histories
    this.histories = {
      interviewer: [],
      hints: []
    };

    // Settings configuration
    this.settings = {
      provider: 'gemini', // 'gemini' | 'groq'
      geminiApiKey: '',
      geminiModel: 'gemini-3.6-flash',
      groqApiKey: '',
      groqModel: 'llama-3.3-70b-versatile',
      persona: 'interviewer'
    };

    // Default widget state
    this.widgetState = {
      progress: 0,
      currentApproach: 'None',
      betterApproach: 'Not analyzed yet',
      timeComplexity: 'N/A',
      spaceComplexity: 'N/A',
      canImprove: false,
      hintLevel: 0,
      hintText: 'Click "Next Hint" or write a message to get a step-by-step nudge.'
    };

    this.init();
  }

  async init() {
    // Load settings from chrome storage
    await this.loadSettings();

    // Inject CSS & HTML
    this.render();

    // Setup event listeners
    this.setupListeners();

    // Setup message listener from inject.js (MAIN world)
    window.addEventListener("hintflow:code-changed", (event) => {
      const { code, language } = event.detail;
      this.currentCode = code;
      this.currentLanguage = language;
    });

    // Request initial code
    window.dispatchEvent(new CustomEvent("hintflow:request-code"));
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['hf_settings'], (result) => {
        if (result.hf_settings) {
          this.settings = { ...this.settings, ...result.hf_settings };
        }
        resolve();
      });
    });
  }

  async saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    return new Promise((resolve) => {
      chrome.storage.local.set({ hf_settings: this.settings }, () => {
        resolve();
      });
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    const sidebarEl = this.shadowRoot.querySelector('.hf-sidebar-wrapper');
    const toggleBtn = this.shadowRoot.querySelector('.hf-floating-toggle');

    if (this.isOpen) {
      sidebarEl.classList.add('open');
      toggleBtn.classList.add('hidden');
      document.body.classList.add('hintflow-sidebar-open');

      // Request latest code on open
      window.dispatchEvent(new CustomEvent("hintflow:request-code"));

      // Initial welcome message if history is empty
      const history = this.histories[this.activeTab === 'analysis' ? 'hints' : this.activeTab];
      if (history && history.length === 0) {
        this.addWelcomeMessage();
      }
    } else {
      sidebarEl.classList.remove('open');
      toggleBtn.classList.remove('hidden');
      document.body.classList.remove('hintflow-sidebar-open');
    }
  }

  open() {
    if (!this.isOpen) {
      this.toggle();
    }
  }

  addWelcomeMessage() {
    let welcome = "";
    if (this.activeTab === 'interviewer') {
      welcome = "Ready for your mock technical interview? Describe your initial thought process or approach below. I'll ask crisp, intuition-striking questions and give slight direct hints to nudge you forward!";
    } else if (this.activeTab === 'hints') {
      welcome = "Welcome to **Hint Mode**! Click \"Next Hint\" above or ask any question to receive progressive, step-by-step conceptual nudges.";
    }

    const targetTab = this.activeTab === 'analysis' ? 'hints' : this.activeTab;
    this.histories[targetTab].push({
      role: 'model',
      text: welcome,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();
    this.updateWidgets();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        
        :host {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #eff1f6;
          box-sizing: border-box;
          pointer-events: auto;
        }

        * {
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: #3d3d3d #1a1a1a;
        }

        /* Webkit Scrollbar styling */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #141414;
        }
        ::-webkit-scrollbar-thumb {
          background: #333333;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #4a4a4a;
        }

        /* 3D Levitation floating keyframes */
        @keyframes hf-float {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-5px) scale(1.02);
          }
        }

        /* Pulse glowing beacon animation */
        @keyframes hf-pulse-glow {
          0%, 100% {
            box-shadow: 0 0 6px rgba(0, 184, 163, 0.8), 0 0 12px rgba(0, 184, 163, 0.4);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 10px rgba(0, 184, 163, 1), 0 0 20px rgba(0, 184, 163, 0.7);
            transform: scale(1.15);
          }
        }

        /* 3D Floating Toggle Button featuring the custom HintFlow Circuit Logo */
        .hf-floating-toggle {
          position: fixed;
          bottom: 28px;
          right: 28px;
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #2a2a2a 0%, #1c1c1c 70%, #121212 100%);
          border: 1.5px solid rgba(255, 161, 22, 0.5);
          cursor: pointer;
          pointer-events: auto !important;
          box-shadow: 
            0 12px 30px rgba(0, 0, 0, 0.7), 
            inset 0 1.5px 2px rgba(255, 255, 255, 0.35),
            inset 0 -3px 6px rgba(0, 0, 0, 0.8),
            0 0 24px rgba(255, 161, 22, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 2147483647;
          animation: hf-float 4s ease-in-out infinite;
          padding: 10px;
        }
        
        .hf-floating-toggle:hover {
          transform: scale(1.12) translateY(-4px);
          border-color: #ffb84d;
          box-shadow: 
            0 16px 36px rgba(0, 0, 0, 0.8), 
            inset 0 2px 3px rgba(255, 255, 255, 0.5),
            inset 0 -3px 6px rgba(0, 0, 0, 0.9),
            0 0 32px rgba(255, 161, 22, 0.55);
          animation-play-state: paused;
        }

        .hf-floating-toggle.hidden {
          transform: scale(0) rotate(-45deg);
          opacity: 0;
          pointer-events: none !important;
        }

        .hf-toggle-img {
          width: 40px;
          height: 40px;
          object-fit: contain;
          filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.7));
        }

        /* Sidebar Wrapper */
        .hf-sidebar-wrapper {
          position: fixed;
          top: 0;
          right: -480px;
          width: 480px;
          height: 100vh;
          background: #1a1a1a;
          border-left: 1px solid #2e2e2e;
          box-shadow: -20px 0 50px rgba(0, 0, 0, 0.85);
          transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483646;
          display: flex;
          flex-direction: column;
          pointer-events: auto !important;
        }

        .hf-sidebar-wrapper.open {
          right: 0;
        }

        /* Inner Layout */
        .hf-sidebar-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: calc(100vh - 56px - 44px);
          background: #141414;
        }

        /* 3D Sidebar Header */
        .hf-sidebar-header {
          height: 56px;
          background: linear-gradient(180deg, #282828 0%, #202020 100%);
          border-bottom: 1px solid #333333;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          z-index: 10;
        }

        .hf-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 16px;
          color: #eff1f6;
          letter-spacing: -0.2px;
        }
        
        .hf-header-logo-img {
          width: 32px;
          height: 32px;
          object-fit: contain;
          filter: drop-shadow(0 2px 6px rgba(255, 161, 22, 0.5));
        }

        .hf-header-title .hf-logo-accent {
          color: #ffa116;
          font-weight: 800;
          letter-spacing: 0.2px;
        }

        .hf-header-status-beacon {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 184, 163, 0.1);
          border: 1px solid rgba(0, 184, 163, 0.3);
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          color: #00b8a3;
          font-weight: 600;
        }

        .hf-status-dot {
          width: 7px;
          height: 7px;
          background: #00b8a3;
          border-radius: 50%;
          animation: hf-pulse-glow 2s infinite ease-in-out;
        }

        .hf-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hf-btn-close {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #9ca3af;
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.3);
        }

        .hf-btn-close:hover {
          color: #ffffff;
          background: #383838;
          border-color: #4c4c4c;
          transform: scale(1.05);
        }

        /* 3D Segmented Control 3-Tab Switcher */
        .hf-tabs-container {
          padding: 8px 14px;
          background: #202020;
          border-bottom: 1px solid #333333;
          flex-shrink: 0;
          z-index: 9;
        }

        .hf-tabs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          background: #141414;
          padding: 3px;
          border-radius: 8px;
          border: 1px solid #2e2e2e;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.6);
          height: 38px;
          gap: 2px;
        }

        .hf-tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #9ca3af;
          font-family: inherit;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          gap: 5px;
          position: relative;
        }

        .hf-tab-icon-svg {
          width: 14px;
          height: 14px;
          fill: currentColor;
        }

        .hf-tab-btn.active {
          background: linear-gradient(180deg, #323232 0%, #242424 100%);
          color: #ffa116;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 
            0 3px 8px rgba(0, 0, 0, 0.5), 
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .hf-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: 2px;
          width: 18px;
          height: 2px;
          background-color: #ffa116;
          border-radius: 2px;
          box-shadow: 0 0 6px rgba(255, 161, 22, 0.8);
        }

        .hf-tab-btn:hover:not(.active) {
          color: #eff1f6;
          background: rgba(255, 255, 255, 0.04);
        }

        /* Tab Content Panes */
        .hf-tab-content {
          display: none;
          flex: 1;
          flex-direction: column;
          overflow: hidden;
          background: #141414;
        }

        .hf-tab-content.active {
          display: flex;
        }

        /* Persona Selector Card inside Interviewer Tab */
        .hf-behavior-selector-card {
          background: linear-gradient(180deg, #242424 0%, #1e1e1e 100%);
          border-bottom: 1px solid #333333;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
        }

        .hf-behavior-label {
          font-size: 11.5px;
          font-weight: 600;
          color: #9ca3af;
        }

        .hf-behavior-options {
          display: flex;
          background: #141414;
          border: 1px solid #2e2e2e;
          border-radius: 7px;
          padding: 3px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
        }

        .hf-behavior-btn {
          background: transparent;
          border: none;
          color: #8a8a8a;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          border-radius: 5px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hf-behavior-btn.active {
          background: linear-gradient(180deg, #383838 0%, #2a2a2a 100%);
          color: #ffa116;
          font-weight: 700;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.12);
        }

        .hf-behavior-btn:hover:not(.active) {
          color: #ffffff;
        }

        /* Full Height Chat Stream */
        .hf-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #141414;
        }

        .hf-msg {
          display: flex;
          flex-direction: column;
          max-width: 88%;
          animation: hf-fadeIn 0.25s ease-out;
        }

        @keyframes hf-fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hf-msg.model {
          align-self: flex-start;
        }

        .hf-msg.user {
          align-self: flex-end;
        }

        .hf-msg-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #8a8a8a;
          margin-bottom: 5px;
          padding: 0 4px;
        }

        .hf-msg.user .hf-msg-header {
          justify-content: flex-end;
        }

        .hf-msg-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #242424;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffa116;
          font-size: 10px;
          border: 1px solid #383838;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .hf-msg-avatar svg {
          width: 12px;
          height: 12px;
          fill: currentColor;
        }

        .hf-msg.user .hf-msg-avatar {
          background: #2a2a2a;
          color: #00b8a3;
          border: 1px solid #3c3c3c;
          order: 2;
        }

        /* 3D Glassmorphic Chat Bubbles */
        .hf-msg-bubble {
          padding: 13px 16px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.6;
          word-break: break-word;
          background: #222222;
          color: #eff1f6;
          border: 1px solid #303030;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }

        .hf-msg.model .hf-msg-bubble {
          border-left: 3px solid #ffa116;
          background: linear-gradient(135deg, #242424 0%, #1e1e1e 100%);
        }

        .hf-msg.user .hf-msg-bubble {
          background: linear-gradient(135deg, #2e2617 0%, #221d12 100%);
          color: #eff1f6;
          border: 1px solid #524223;
          border-top: 1px solid rgba(255, 161, 22, 0.3);
          box-shadow: 0 4px 14px rgba(255, 161, 22, 0.08);
          border-top-right-radius: 2px;
        }

        /* Monaco Code Blocks */
        .hf-inline-code {
          background: #1e1e1e !important;
          color: #ffa116 !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          font-family: 'JetBrains Mono', Menlo, Monaco, Consolas, monospace !important;
          font-size: 12px !important;
          border: 1px solid #333333 !important;
        }

        .hf-code-block-container {
          position: relative;
          margin: 10px 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #333333;
          box-shadow: 0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .hf-code-header {
          background: #1e1e1e;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #2e2e2e;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #8a8a8a;
        }

        .hf-btn-copy-code {
          background: #2a2a2a;
          border: 1px solid #3a3a3a;
          color: #9ca3af;
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 10.5px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .hf-btn-copy-code:hover {
          background: #363636;
          color: #ffa116;
          border-color: #ffa116;
        }

        .hf-code-block {
          background: #141414;
          padding: 12px 14px;
          overflow-x: auto;
          margin: 0;
        }

        .hf-code-block code {
          background: transparent !important;
          color: #eff1f6 !important;
          padding: 0 !important;
          border: none !important;
          font-family: 'JetBrains Mono', Menlo, Monaco, Consolas, monospace !important;
          font-size: 12px !important;
          line-height: 1.55 !important;
        }

        .hf-typing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: #222222;
          border-radius: 8px;
          align-self: flex-start;
          margin-bottom: 8px;
          border: 1px solid #303030;
          border-left: 3px solid #ffa116;
          margin-left: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }

        .hf-typing-dot {
          width: 7px;
          height: 7px;
          background: #ffa116;
          border-radius: 50%;
          animation: hf-bounce 1.4s infinite ease-in-out both;
        }

        .hf-typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .hf-typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes hf-bounce {
          0%, 80%, 100% { transform: scale(0.3); opacity: 0.4; }
          40% { transform: scale(1.1); opacity: 1; }
        }

        /* Chat Input Area */
        .hf-chat-input-area {
          padding: 14px;
          border-top: 1px solid #333333;
          background: linear-gradient(180deg, #222222 0%, #1a1a1a 100%);
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.3);
        }

        .hf-input-field {
          flex: 1;
          background: #141414;
          border: 1px solid #303030;
          border-radius: 8px;
          padding: 10px 14px;
          color: #eff1f6;
          font-family: inherit;
          font-size: 13px;
          resize: none;
          height: 40px;
          outline: none;
          transition: all 0.25s ease;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
        }

        .hf-input-field:focus {
          border-color: #ffa116;
          background: #181818;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5), 0 0 0 2px rgba(255, 161, 22, 0.2);
        }

        .hf-btn-send {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: linear-gradient(180deg, #323232 0%, #242424 100%);
          color: #ffa116;
          border: 1px solid #3a3a3a;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15);
        }

        .hf-btn-send svg {
          width: 18px;
          height: 18px;
          fill: currentColor;
          transition: transform 0.2s ease;
        }

        .hf-btn-send:hover:not(:disabled) {
          background: linear-gradient(180deg, #ffa116 0%, #e08b00 100%);
          color: #141414;
          border-color: #ffa116;
          transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(255, 161, 22, 0.35);
        }

        .hf-btn-send:hover:not(:disabled) svg {
          transform: translateX(1px);
        }

        .hf-btn-send:disabled {
          color: #4a4a4a;
          background: #1c1c1c;
          border-color: #2a2a2a;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Hint Mode Specific Top Header */
        .hf-hint-header-strip {
          background: linear-gradient(180deg, #242424 0%, #1e1e1e 100%);
          border-bottom: 1px solid #333333;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        }

        .hf-hint-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .hf-hint-level-badge {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .hf-widget-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #9ca3af;
          font-weight: 700;
        }

        .hf-hint-dots-row {
          display: flex;
          gap: 7px;
        }

        .hf-hint-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #2a2a2a 0%, #141414 100%);
          border: 1px solid #383838;
          box-shadow: inset 0 -1px 2px rgba(0,0,0,0.8);
          transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .hf-hint-dot.active {
          background: radial-gradient(circle at 35% 35%, #ffd485 0%, #ffa116 60%, #cc7a00 100%);
          border-color: #ffb84d;
          box-shadow: 
            0 0 12px rgba(255, 161, 22, 0.9), 
            inset 0 1px 2px rgba(255, 255, 255, 0.8),
            inset 0 -2px 4px rgba(0, 0, 0, 0.4);
          transform: scale(1.1);
        }

        .hf-btn-next-hint {
          background: linear-gradient(180deg, #ffa116 0%, #e08b00 100%);
          color: #141414;
          border: 1px solid #ffb84d;
          border-top: 1px solid rgba(255, 255, 255, 0.4);
          padding: 8px 16px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(255, 161, 22, 0.3), inset 0 1px 0 rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hf-btn-next-hint:hover {
          background: linear-gradient(180deg, #ffb84d 0%, #ffa116 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(255, 161, 22, 0.45);
        }

        .hf-hint-active-card {
          font-size: 12px;
          color: #d1d5db;
          line-height: 1.55;
          background: #181818;
          border: 1px solid #2e2e2e;
          border-radius: 8px;
          padding: 10px 14px;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
        }

        /* Tab 3: Analysis Section Dedicated Styling */
        .hf-analysis-wrapper {
          flex: 1;
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #141414;
        }

        .hf-analysis-card {
          background: linear-gradient(180deg, #242424 0%, #1c1c1c 100%);
          border: 1px solid #303030;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        /* Interactive Hover Animation on Analysis Cards */
        .hf-analysis-card:hover {
          transform: translateY(-3px) scale(1.01);
          border-color: #ffa116;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(255, 161, 22, 0.2);
        }

        .hf-analysis-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #2e2e2e;
          padding-bottom: 8px;
        }

        .hf-analysis-card-heading {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hf-analysis-card-heading span {
          color: #ffa116;
        }

        .hf-stats-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12.5px;
          padding: 4px 0;
        }

        .hf-stats-label {
          color: #9ca3af;
          font-weight: 500;
        }

        .hf-stats-value {
          font-weight: 700;
          color: #eff1f6;
        }

        .hf-complexity-badge {
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 9px;
          border-radius: 6px;
          letter-spacing: 0.3px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .hf-badge-red { 
          background: rgba(255, 55, 95, 0.15); 
          color: #ff375f; 
          border: 1px solid rgba(255, 55, 95, 0.3); 
        }
        .hf-badge-green { 
          background: rgba(0, 184, 163, 0.15); 
          color: #00b8a3; 
          border: 1px solid rgba(0, 184, 163, 0.3); 
        }
        .hf-badge-grey { 
          background: rgba(156, 163, 175, 0.15); 
          color: #9ca3af; 
          border: 1px solid rgba(156, 163, 175, 0.3); 
        }

        /* Progress Bar Animation inside Analysis */
        .hf-progress-bar-container {
          width: 100%;
          height: 6px;
          background: #141414;
          border-radius: 3px;
          overflow: hidden;
          border: 1px solid #2e2e2e;
          margin-top: 4px;
        }

        .hf-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff375f, #ffa116, #00b8a3);
          border-radius: 3px;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          width: 0%;
        }

        /* Quick Assistance Grid inside Analysis Tab */
        .hf-advices-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hf-advices-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .hf-action-btn {
          background: linear-gradient(180deg, #242424 0%, #1c1c1c 100%);
          border: 1px solid #303030;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: #eff1f6;
          padding: 12px 10px;
          border-radius: 9px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          text-align: center;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        .hf-action-btn:hover {
          background: linear-gradient(180deg, #323232 0%, #262626 100%);
          border-color: #ffa116;
          color: #ffffff;
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 16px rgba(0,0,0,0.4), 0 0 12px rgba(255, 161, 22, 0.25);
        }

        .hf-action-btn:active {
          transform: translateY(1px) scale(0.98);
        }

        /* Bottom Menu Footer */
        .hf-sidebar-footer {
          height: 44px;
          border-top: 1px solid #333333;
          background: #1c1c1c;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 0 16px;
          flex-shrink: 0;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
        }

        .hf-footer-item {
          font-size: 11.5px;
          color: #9ca3af;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .hf-footer-item:hover {
          color: #ffa116;
        }

        /* 3D Glassmorphic Settings Modal */
        .hf-settings-overlay {
          position: absolute;
          inset: 0;
          background: rgba(20, 20, 20, 0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 100;
          display: flex;
          flex-direction: column;
          padding: 24px;
          transform: translateY(100%);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hf-settings-overlay.open {
          transform: translateY(0);
        }

        .hf-settings-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 18px;
          color: #ffffff;
          border-bottom: 1px solid #333333;
          padding-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .hf-settings-form {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .hf-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hf-form-label {
          font-size: 11.5px;
          font-weight: 700;
          color: #9ca3af;
          letter-spacing: 0.3px;
        }

        .hf-form-input, .hf-form-select {
          background: #181818;
          border: 1px solid #303030;
          border-radius: 7px;
          padding: 10px 14px;
          color: #eff1f6;
          font-family: inherit;
          font-size: 12.5px;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .hf-form-input:focus, .hf-form-select:focus {
          border-color: #ffa116;
          background: #1e1e1e;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(255, 161, 22, 0.2);
        }

        .hf-settings-footer {
          margin-top: 18px;
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .hf-btn-save {
          flex: 1;
          background: linear-gradient(180deg, #ffa116 0%, #e08b00 100%);
          border: 1px solid #ffb84d;
          color: #141414;
          padding: 11px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(255, 161, 22, 0.3), inset 0 1px 0 rgba(255,255,255,0.3);
        }

        .hf-btn-save:hover {
          background: linear-gradient(180deg, #ffb84d 0%, #ffa116 100%);
          transform: translateY(-1px);
        }

        .hf-btn-test {
          background: linear-gradient(180deg, #2c2c2c 0%, #202020 100%);
          border: 1px solid #3a3a3a;
          color: #eff1f6;
          padding: 11px 16px;
          border-radius: 7px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
        }

        .hf-btn-test:hover {
          background: #363636;
          color: white;
          border-color: #4a4a4a;
        }

        .hf-settings-status {
          font-size: 12px;
          text-align: center;
          margin-top: 8px;
          font-weight: 600;
          padding: 8px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
        }

        /* LeetCode Themed Accepted Solution Modal Overlay */
        .hf-accepted-overlay {
          position: absolute;
          inset: 0;
          background: rgba(18, 18, 18, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          z-index: 120;
          display: flex;
          flex-direction: column;
          padding: 24px;
          transform: translateY(100%);
          transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hf-accepted-overlay.open {
          transform: translateY(0);
        }

        .hf-accepted-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid #2e2e2e;
          margin-bottom: 14px;
        }

        .hf-accepted-title-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 700;
          color: #2cbb5d;
        }

        .hf-accepted-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          padding-right: 2px;
        }

        .hf-accepted-problem-card {
          background: #262626;
          border: 1px solid #383838;
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hf-accepted-problem-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .hf-accepted-problem-name {
          font-size: 14px;
          font-weight: 700;
          color: #eff1f6;
          line-height: 1.3;
        }

        .hf-diff-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .hf-diff-badge.easy {
          background: rgba(0, 184, 163, 0.15);
          color: #00b8a3;
          border: 1px solid rgba(0, 184, 163, 0.35);
        }

        .hf-diff-badge.medium {
          background: rgba(255, 161, 22, 0.15);
          color: #ffa116;
          border: 1px solid rgba(255, 161, 22, 0.35);
        }

        .hf-diff-badge.hard {
          background: rgba(255, 55, 95, 0.15);
          color: #ff375f;
          border: 1px solid rgba(255, 55, 95, 0.35);
        }

        .hf-metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .hf-metric-card {
          background: #1e1e1e;
          border: 1px solid #333333;
          border-radius: 8px;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .hf-metric-label {
          font-size: 10px;
          font-weight: 600;
          color: #8c8c8c;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .hf-metric-value {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }

        .hf-metric-beats {
          font-size: 10.5px;
          font-weight: 600;
          color: #2cbb5d;
        }

        .hf-accepted-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hf-accepted-label {
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .hf-accepted-input {
          background: #181818;
          border: 1px solid #303030;
          border-radius: 7px;
          padding: 10px 14px;
          color: #eff1f6;
          font-family: inherit;
          font-size: 12.5px;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .hf-accepted-input:focus {
          border-color: #2cbb5d;
          background: #1e1e1e;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(44, 187, 93, 0.2);
        }

        .hf-accepted-textarea {
          background: #181818;
          border: 1px solid #303030;
          border-radius: 7px;
          padding: 10px 14px;
          color: #eff1f6;
          font-family: inherit;
          font-size: 12.5px;
          outline: none;
          resize: vertical;
          min-height: 64px;
          transition: all 0.2s ease;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
        }

        .hf-accepted-textarea:focus {
          border-color: #2cbb5d;
          background: #1e1e1e;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4), 0 0 0 2px rgba(44, 187, 93, 0.2);
        }

        .hf-sheet-dest-card {
          background: #232323;
          border: 1px solid #363636;
          border-radius: 9px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hf-sheet-dest-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .hf-sheet-mode-segmented {
          display: flex;
          background: #141414;
          padding: 2px;
          border-radius: 6px;
          border: 1px solid #333333;
          gap: 2px;
        }

        .hf-sheet-mode-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hf-sheet-mode-btn.active {
          background: #333333;
          color: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }

        .hf-sheet-select-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hf-accepted-select {
          flex: 1;
          background: #181818;
          border: 1px solid #383838;
          border-radius: 6px;
          padding: 8px 10px;
          color: #eff1f6;
          font-size: 12px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
        }

        .hf-accepted-select:focus {
          border-color: #2cbb5d;
        }

        .hf-sheet-open-link-btn {
          background: rgba(44, 187, 93, 0.12);
          border: 1px solid rgba(44, 187, 93, 0.35);
          color: #2cbb5d;
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .hf-sheet-open-link-btn:hover {
          background: rgba(44, 187, 93, 0.22);
          border-color: #2cbb5d;
          color: #34d368;
        }

        .hf-previous-sheets-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 4px;
          padding-top: 8px;
          border-top: 1px solid #303030;
        }

        .hf-previous-sheets-title {
          font-size: 10px;
          font-weight: 700;
          color: #888888;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .hf-previous-sheets-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          max-height: 80px;
          overflow-y: auto;
        }

        .hf-sheet-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #181818;
          border: 1px solid #333333;
          border-radius: 5px;
          padding: 3px 8px;
          font-size: 11px;
          color: #cccccc;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
        }

        .hf-sheet-pill:hover {
          border-color: #2cbb5d;
          color: #2cbb5d;
          background: rgba(44, 187, 93, 0.08);
        }

        .hf-sheet-pill-active {
          border-color: #2cbb5d;
          color: #2cbb5d;
          background: rgba(44, 187, 93, 0.12);
        }

        .hf-accepted-sublabel {
          font-size: 10.5px;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          margin-bottom: 2px;
          display: block;
        }

        .hf-sheet-help-text {
          font-size: 11px;
          color: #888888;
          line-height: 1.4;
          margin-top: 4px;
        }

        .hf-accepted-footer {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }

        .hf-accepted-btn-push {
          background: linear-gradient(180deg, #2cbb5d 0%, #22994b 100%);
          border: 1px solid #34d368;
          color: #ffffff;
          padding: 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(44, 187, 93, 0.35);
        }

        .hf-accepted-btn-push:hover:not(:disabled) {
          background: linear-gradient(180deg, #34d368 0%, #2cbb5d 100%);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(44, 187, 93, 0.45);
        }

        .hf-accepted-btn-push:disabled {
          background: #252525;
          border-color: #353535;
          color: #666666;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .hf-accepted-status {
          font-size: 12px;
          text-align: center;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .hf-accepted-status-success { color: #2cbb5d; }
        .hf-accepted-status-error { color: #ff375f; }
      </style>

      <!-- 3D Floating Toggle Button featuring the custom HintFlow Circuit Logo -->
      <button class="hf-floating-toggle" title="Open HintFlow AI Mentor">
        <img src="${this.logoUrl}" alt="HintFlow Logo" class="hf-toggle-img" />
      </button>

      <!-- Sidebar Main Container -->
      <div class="hf-sidebar-wrapper">
        <!-- 3D Sidebar Header -->
        <div class="hf-sidebar-header">
          <div class="hf-header-title">
            <img src="${this.logoUrl}" alt="HintFlow Logo" class="hf-header-logo-img" />
            <span><span class="hf-logo-accent">HintFlow</span></span>
          </div>
          
          <div class="hf-header-status-beacon" title="AI Service Online">
            <span class="hf-status-dot"></span>
            <span>Online</span>
          </div>

          <div class="hf-header-actions">
            <button class="hf-btn-close" id="close-sidebar-btn" title="Close Sidebar">✕</button>
          </div>
        </div>

        <!-- 3D Segmented Control 3-Tab Switcher -->
        <div class="hf-tabs-container">
          <div class="hf-tabs">
            <button class="hf-tab-btn active" data-tab="interviewer">
              <svg class="hf-tab-icon-svg" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
              <span>Interviewer</span>
            </button>
            <button class="hf-tab-btn" data-tab="hints">
              <svg class="hf-tab-icon-svg" viewBox="0 0 24 24">
                <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
              </svg>
              <span>Hint Mode</span>
            </button>
            <button class="hf-tab-btn" data-tab="analysis">
              <svg class="hf-tab-icon-svg" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-4h5v4zm0-6H7V7h5v4zm6 6h-4V7h4v10z"/>
              </svg>
              <span>Analysis</span>
            </button>
          </div>
        </div>

        <!-- Sidebar Body -->
        <div class="hf-sidebar-main">
          <!-- Tab 1: Interviewer Section -->
          <div class="hf-tab-content active" id="tab-content-interviewer">
            <!-- Persona Selector Card -->
            <div class="hf-behavior-selector-card">
              <span class="hf-behavior-label">Persona:</span>
              <div class="hf-behavior-options">
                <button class="hf-behavior-btn active" data-persona="interviewer">Challenger</button>
                <button class="hf-behavior-btn" data-persona="mentor">Coach</button>
                <button class="hf-behavior-btn" data-persona="socratic">Socratic</button>
              </div>
            </div>

            <!-- Full-Height Messages Log -->
            <div class="hf-chat-messages" id="chat-messages-log-interviewer">
              <!-- Messages rendered dynamically -->
            </div>

            <!-- Typing indicator -->
            <div class="hf-typing-indicator" style="display: none;" id="typing-indicator-interviewer">
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
            </div>

            <!-- Input area -->
            <div class="hf-chat-input-area">
              <textarea class="hf-input-field" placeholder="Describe your approach or answer the interviewer..." id="chat-textarea-input-interviewer"></textarea>
              <button class="hf-btn-send" id="btn-send-message-interviewer" title="Send Message">
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Tab 2: Hint Mode Section -->
          <div class="hf-tab-content" id="tab-content-hints">
            <!-- Hint Level Top Strip -->
            <div class="hf-hint-header-strip">
              <div class="hf-hint-top-row">
                <div class="hf-hint-level-badge">
                  <span class="hf-widget-label" id="hint-level-title-label">Hint Level: 0/5</span>
                  <div class="hf-hint-dots-row" id="hint-level-dots-container">
                    <span class="hf-hint-dot"></span>
                    <span class="hf-hint-dot"></span>
                    <span class="hf-hint-dot"></span>
                    <span class="hf-hint-dot"></span>
                    <span class="hf-hint-dot"></span>
                  </div>
                </div>
                <button class="hf-btn-next-hint" id="btn-request-next-hint">
                  <span>Next Hint</span>
                  <svg style="width:14px; height:14px; fill:currentColor;" viewBox="0 0 24 24"><path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42L16.86 11H5v2z"/></svg>
                </button>
              </div>

              <!-- Active Hint Card -->
              <div class="hf-hint-active-card" id="hint-level-desc-text">
                Click "Next Hint" or write a question below to get started.
              </div>
            </div>

            <!-- Full-Height Messages Log under Hint Section -->
            <div class="hf-chat-messages" id="chat-messages-log-hints">
              <!-- Messages rendered dynamically -->
            </div>

            <!-- Typing indicator -->
            <div class="hf-typing-indicator" style="display: none;" id="typing-indicator-hints">
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
            </div>

            <!-- Input area -->
            <div class="hf-chat-input-area">
              <textarea class="hf-input-field" placeholder="Ask HintFlow tutor anything about the problem..." id="chat-textarea-input-hints"></textarea>
              <button class="hf-btn-send" id="btn-send-message-hints" title="Send Message">
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Tab 3: Dedicated Analysis Section -->
          <div class="hf-tab-content" id="tab-content-analysis">
            <div class="hf-analysis-wrapper">
              <!-- Approach Analysis Card -->
              <div class="hf-analysis-card">
                <div class="hf-analysis-title-row">
                  <div class="hf-analysis-card-heading">
                    💡 Approach <span>Evaluation</span>
                  </div>
                  <span class="hf-complexity-badge hf-badge-grey" id="analysis-progress-badge">0% Optimal</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Current Approach:</span>
                  <span class="hf-stats-value" id="approach-current-val">None</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Optimal / Target:</span>
                  <span class="hf-stats-value" id="approach-better-val">Not analyzed</span>
                </div>
                <div class="hf-progress-bar-container">
                  <div class="hf-progress-bar-fill" id="analysis-progress-fill"></div>
                </div>
              </div>

              <!-- Time & Space Complexity Card -->
              <div class="hf-analysis-card">
                <div class="hf-analysis-title-row">
                  <div class="hf-analysis-card-heading">
                    ⚡ Complexity <span>Breakdown</span>
                  </div>
                  <span id="complexity-improvable-badge" class="hf-complexity-badge hf-badge-grey">N/A</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Time Complexity:</span>
                  <span class="hf-stats-value" id="complexity-time-val">-</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Space Complexity:</span>
                  <span class="hf-stats-value" id="complexity-space-val">-</span>
                </div>
              </div>

              <!-- Quick AI Assistance Action Card Grid -->
              <div class="hf-analysis-card">
                <div class="hf-analysis-title-row">
                  <div class="hf-analysis-card-heading">
                    🚀 Quick AI <span>Assistance</span>
                  </div>
                </div>
                <div class="hf-advices-section">
                  <div class="hf-advices-grid">
                    <button class="hf-action-btn" data-action="stuck">😢 Stuck</button>
                    <button class="hf-action-btn" data-action="wrong">🐞 Wrong Code</button>
                    <button class="hf-action-btn" data-action="optimize">🚀 Optimize</button>
                    <button class="hf-action-btn" data-action="error">⚠️ Error Help</button>
                    <button class="hf-action-btn" data-action="edge">🛡️ Edge Cases</button>
                    <button class="hf-action-btn" data-action="dryrun">🎬 Dry Run</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Menu -->
        <div class="hf-sidebar-footer">
          <span class="hf-footer-item" id="footer-menu-settings">⚙️ Settings</span>
          <span class="hf-footer-item" id="footer-menu-sheet" style="display: none;">📊 Push to Sheet</span>
          <span class="hf-footer-item" id="footer-menu-tips">💡 Interview Tips</span>
          <span class="hf-footer-item" id="footer-menu-notes">📝 Notes</span>
        </div>

        <!-- Settings Slide-up Overlay Modal -->
        <div class="hf-settings-overlay" id="settings-overlay-modal">
          <div class="hf-settings-title">
            <span>⚙️ Settings & API Configuration</span>
            <button class="hf-btn-close" id="close-settings-btn">✕</button>
          </div>
          <div class="hf-settings-form">
            <div class="hf-form-group">
              <label class="hf-form-label">API Provider</label>
              <select class="hf-form-select" id="settings-provider-select">
                <option value="gemini">Google AI Studio (Gemini)</option>
                <option value="groq">Groq Cloud (Llama / Gemma)</option>
              </select>
            </div>

            <div class="hf-form-group" id="settings-gemini-key-group">
              <label class="hf-form-label">Google AI Studio API Key</label>
              <input type="password" class="hf-form-input" placeholder="AIzaSy..." id="settings-gemini-key-input" />
            </div>

            <div class="hf-form-group" id="settings-gemini-model-group">
              <label class="hf-form-label">Gemini Model</label>
              <select class="hf-form-select" id="settings-gemini-model-select">
                <option value="gemini-3.6-flash">Gemini 3.6 Flash (Recommended)</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Advanced)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thorough)</option>
              </select>
            </div>

            <div class="hf-form-group" id="settings-groq-key-group">
              <label class="hf-form-label">Groq API Key</label>
              <input type="password" class="hf-form-input" placeholder="gsk_..." id="settings-groq-key-input" />
            </div>

            <div class="hf-form-group" id="settings-groq-model-group">
              <label class="hf-form-label">Groq Model</label>
              <select class="hf-form-select" id="settings-groq-model-select">
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recommended)</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B (Super Fast)</option>
                <option value="gemma2-9b-it">Gemma 2 9B (Google)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
              </select>
            </div>

            <div class="hf-form-group">
              <label class="hf-form-label">Default Persona</label>
              <select class="hf-form-select" id="settings-persona-select">
                <option value="interviewer">FAANG Interviewer (Intuition Questions)</option>
                <option value="mentor">Helpful Coding Coach (Supportive)</option>
                <option value="socratic">Socratic Tutor (Questions Only)</option>
              </select>
            </div>
          </div>
          <div class="hf-settings-status" id="settings-status-msg" style="display: none;"></div>
          <div class="hf-settings-footer">
            <button class="hf-btn-test" id="btn-test-settings-connection">Test Connection</button>
            <button class="hf-btn-save" id="btn-save-settings-form">Save & Close</button>
          </div>
        </div>

        <!-- Solution Accepted Push to Google Sheets Modal Overlay -->
        <div class="hf-accepted-overlay" id="accepted-modal-overlay">
          <div class="hf-accepted-header">
            <div class="hf-accepted-title-badge">
              <span>🎉 Solution Accepted!</span>
            </div>
            <button class="hf-btn-close" id="close-accepted-btn" title="Dismiss">✕</button>
          </div>

          <div class="hf-accepted-body">
            <!-- Problem Details & Metrics -->
            <div class="hf-accepted-problem-card">
              <div class="hf-accepted-problem-top">
                <span class="hf-accepted-problem-name" id="accepted-problem-title">Problem Title</span>
                <span class="hf-diff-badge medium" id="accepted-problem-diff">Medium</span>
              </div>
              <div class="hf-metrics-grid" id="accepted-metrics-grid">
                <div class="hf-metric-card" id="accepted-runtime-card">
                  <span class="hf-metric-label">Runtime</span>
                  <span class="hf-metric-value" id="accepted-runtime-val">-</span>
                  <span class="hf-metric-beats" id="accepted-runtime-beats"></span>
                </div>
                <div class="hf-metric-card" id="accepted-memory-card">
                  <span class="hf-metric-label">Memory</span>
                  <span class="hf-metric-value" id="accepted-memory-val">-</span>
                  <span class="hf-metric-beats" id="accepted-memory-beats"></span>
                </div>
              </div>
            </div>

            <!-- Form Fields -->
            <div class="hf-accepted-field">
              <label class="hf-accepted-label">Time Taken (minutes)</label>
              <input type="number" class="hf-accepted-input" id="accepted-time-input" min="1" value="1" />
            </div>

            <div class="hf-accepted-field">
              <label class="hf-accepted-label">Short Note (optional)</label>
              <textarea class="hf-accepted-textarea" id="accepted-note-input" placeholder="Key approach, complexity, patterns, hints used..."></textarea>
            </div>

            <!-- Destination Sheet Selection Card -->
            <div class="hf-sheet-dest-card">
              <div class="hf-sheet-dest-header">
                <span class="hf-accepted-label">📊 Destination Spreadsheet</span>
                <!-- Segmented Mode Control -->
                <div class="hf-sheet-mode-segmented">
                  <button type="button" class="hf-sheet-mode-btn active" id="btn-mode-existing-sheet" data-mode="existing">
                    Existing Sheet
                  </button>
                  <button type="button" class="hf-sheet-mode-btn" id="btn-mode-new-sheet" data-mode="new">
                    + New Sheet
                  </button>
                </div>
              </div>

              <!-- Option A: Existing Sheet Section -->
              <div class="hf-sheet-section" id="section-existing-sheet">
                <div class="hf-sheet-select-row">
                  <select class="hf-accepted-select" id="accepted-sheet-select">
                    <option value="">Loading sheets...</option>
                  </select>
                  <a class="hf-sheet-open-link-btn" id="accepted-sheet-open-link" href="#" target="_blank" title="Open this sheet in Google Drive">
                    Open ↗
                  </a>
                </div>

                <!-- Previous Sheets Links List -->
                <div class="hf-previous-sheets-wrapper" id="previous-sheets-wrapper" style="display: none;">
                  <div class="hf-previous-sheets-title">Previous Sheets:</div>
                  <div class="hf-previous-sheets-list" id="previous-sheets-list">
                    <!-- Populated dynamically -->
                  </div>
                </div>
              </div>

              <!-- Option B: New Sheet with Custom Name Section -->
              <div class="hf-sheet-section" id="section-new-sheet" style="display: none;">
                <div class="hf-accepted-field" style="margin-bottom: 4px;">
                  <label class="hf-accepted-sublabel">Sheet Name</label>
                  <input type="text" class="hf-accepted-input" id="accepted-new-sheet-name-input" placeholder="e.g. Blind 75 Tracker, LeetCode 2026" value="HintFlow — LeetCode Tracker" />
                </div>
                <div class="hf-sheet-help-text">
                  ✨ A new formatted spreadsheet with this name will be created in your Google Drive and remembered for future solves.
                </div>
              </div>
            </div>
          </div>

          <!-- Status indicator -->
          <div class="hf-accepted-status" id="accepted-status-msg" style="display: none;"></div>

          <!-- Actions -->
          <div class="hf-accepted-footer">
            <button class="hf-accepted-btn-push" id="btn-push-google-sheet">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-4h5v4zm0-6H7V7h5v4zm6 6h-4V7h4v10z"/>
              </svg>
              <span>Push to Google Sheet</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  setupListeners() {
    const shadow = this.shadowRoot;

    // Toggle sidebar
    shadow.querySelector('.hf-floating-toggle').addEventListener('click', () => this.toggle());
    shadow.querySelector('#close-sidebar-btn').addEventListener('click', () => this.toggle());

    // 3 Tab switching
    shadow.querySelectorAll('.hf-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Send message for Interviewer tab
    const textInputInterviewer = shadow.querySelector('#chat-textarea-input-interviewer');
    const sendBtnInterviewer = shadow.querySelector('#btn-send-message-interviewer');

    sendBtnInterviewer.addEventListener('click', () => this.handleUserSendMessage());
    textInputInterviewer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSendMessage();
      }
    });

    // Send message for Hints tab
    const textInputHints = shadow.querySelector('#chat-textarea-input-hints');
    const sendBtnHints = shadow.querySelector('#btn-send-message-hints');

    sendBtnHints.addEventListener('click', () => this.handleUserSendMessage());
    textInputHints.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSendMessage();
      }
    });

    // Request Next Hint with fixed single-increment logic
    shadow.querySelector('#btn-request-next-hint').addEventListener('click', () => {
      let currentLevel = this.widgetState.hintLevel || 0;
      let nextLevel = Math.min(5, currentLevel + 1);
      this.triggerQuickAction('stuck', `Please provide Hint Level ${nextLevel}/5.`);
    });

    // Quick Actions Click
    shadow.querySelectorAll('.hf-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        let promptText = "";
        if (action === 'stuck') promptText = "I'm stuck. Can you give me a conceptual hint?";
        else if (action === 'wrong') promptText = "My code is failing. Can you help me find the bug without revealing the solution?";
        else if (action === 'optimize') promptText = "Can you explain how I can optimize my approach?";
        else if (action === 'error') promptText = "I'm encountering an error. Can you explain what is wrong?";
        else if (action === 'edge') promptText = "What edge cases should I test my current code against?";
        else if (action === 'dryrun') promptText = "Can you dry run my code step-by-step with a test case?";

        if (promptText) {
          // Switch to Hints tab if in Analysis
          if (this.activeTab === 'analysis') {
            this.switchTab('hints');
          }
          this.triggerQuickAction(action, promptText);
        }
      });
    });

    // Interviewer Persona selector buttons
    shadow.querySelectorAll('.hf-behavior-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const persona = e.currentTarget.dataset.persona;
        await this.saveSettings({ persona });
        this.updateBehaviorSelector();

        this.histories.interviewer.push({
          role: 'model',
          text: `*System: Persona switched to **${persona === 'interviewer' ? 'FAANG Interviewer' : persona === 'mentor' ? 'Helpful Coach' : 'Socratic Tutor'}**.*`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        this.renderMessages();
      });
    });

    // Settings modal
    shadow.querySelector('#footer-menu-settings').addEventListener('click', () => this.openSettings());
    shadow.querySelector('#close-settings-btn').addEventListener('click', () => this.closeSettings());
    shadow.querySelector('#btn-save-settings-form').addEventListener('click', () => this.saveSettingsForm());
    shadow.querySelector('#btn-test-settings-connection').addEventListener('click', () => this.testSettingsConnection());
    shadow.querySelector('#settings-provider-select').addEventListener('change', (e) => {
      this.toggleSettingsFormFields(e.target.value);
    });

    // Solution Accepted Push to Google Sheets modal
    shadow.querySelector('#close-accepted-btn')?.addEventListener('click', () => this.closeAcceptedModal());
    shadow.querySelector('#btn-push-google-sheet')?.addEventListener('click', () => this.handlePushToSheet());
    shadow.querySelector('#footer-menu-sheet')?.addEventListener('click', () => this.reopenAcceptedModal());
    shadow.querySelector('#btn-mode-existing-sheet')?.addEventListener('click', () => this.setSheetMode('existing'));
    shadow.querySelector('#btn-mode-new-sheet')?.addEventListener('click', () => this.setSheetMode('new'));

    // Simple alerts
    shadow.querySelector('#footer-menu-tips').addEventListener('click', () => {
      alert("💡 Interview Tips:\n1. Clarify requirements before coding.\n2. State time/space complexity upfront.\n3. Identify edge cases early.\n4. Walk through a dry run out loud.");
    });
    shadow.querySelector('#footer-menu-notes').addEventListener('click', () => {
      alert("📝 Notes:\nKeep track of key problem patterns and key takeaways here!");
    });

    // Code copy delegation
    shadow.addEventListener('click', (e) => {
      if (e.target && e.target.classList.contains('hf-btn-copy-code')) {
        const codeContainer = e.target.closest('.hf-code-block-container');
        if (codeContainer) {
          const codeEl = codeContainer.querySelector('code');
          if (codeEl) {
            navigator.clipboard.writeText(codeEl.textContent || '');
            const originalText = e.target.textContent;
            e.target.textContent = 'Copied! ✓';
            e.target.style.color = '#00b8a3';
            e.target.style.borderColor = '#00b8a3';
            setTimeout(() => {
              e.target.textContent = originalText;
              e.target.style.color = '';
              e.target.style.borderColor = '';
            }, 2000);
          }
        }
      }
    });

    this.updateBehaviorSelector();
  }

  updateBehaviorSelector() {
    const persona = this.settings.persona;
    this.shadowRoot.querySelectorAll('.hf-behavior-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.persona === persona);
    });
    const modalSelect = this.shadowRoot.querySelector('#settings-persona-select');
    if (modalSelect) modalSelect.value = persona;
  }

  switchTab(tab) {
    if (this.activeTab === tab) return;

    this.shadowRoot.querySelectorAll('.hf-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    this.shadowRoot.querySelectorAll('.hf-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-content-${tab}`);
    });

    this.activeTab = tab;

    const targetHistory = tab === 'analysis' ? 'hints' : tab;
    if (this.histories[targetHistory] && this.histories[targetHistory].length === 0) {
      this.addWelcomeMessage();
    } else {
      this.renderMessages();
      this.updateWidgets();
    }
  }

  openSettings() {
    const shadow = this.shadowRoot;
    shadow.querySelector('#settings-provider-select').value = this.settings.provider;
    shadow.querySelector('#settings-gemini-key-input').value = this.settings.geminiApiKey || '';
    shadow.querySelector('#settings-gemini-model-select').value = this.settings.geminiModel;
    shadow.querySelector('#settings-groq-key-input').value = this.settings.groqApiKey || '';
    shadow.querySelector('#settings-groq-model-select').value = this.settings.groqModel;
    shadow.querySelector('#settings-persona-select').value = this.settings.persona;

    this.toggleSettingsFormFields(this.settings.provider);
    shadow.querySelector('#settings-overlay-modal').classList.add('open');
    shadow.querySelector('#settings-status-msg').style.display = 'none';
  }

  closeSettings() {
    this.shadowRoot.querySelector('#settings-overlay-modal').classList.remove('open');
  }

  toggleSettingsFormFields(provider) {
    const shadow = this.shadowRoot;
    shadow.querySelector('#settings-gemini-key-group').style.display = provider === 'gemini' ? 'flex' : 'none';
    shadow.querySelector('#settings-gemini-model-group').style.display = provider === 'gemini' ? 'flex' : 'none';
    shadow.querySelector('#settings-groq-key-group').style.display = provider === 'groq' ? 'flex' : 'none';
    shadow.querySelector('#settings-groq-model-group').style.display = provider === 'groq' ? 'flex' : 'none';
  }

  async saveSettingsForm() {
    const shadow = this.shadowRoot;
    const provider = shadow.querySelector('#settings-provider-select').value;
    const geminiApiKey = shadow.querySelector('#settings-gemini-key-input').value.trim();
    const geminiModel = shadow.querySelector('#settings-gemini-model-select').value;
    const groqApiKey = shadow.querySelector('#settings-groq-key-input').value.trim();
    const groqModel = shadow.querySelector('#settings-groq-model-select').value;
    const persona = shadow.querySelector('#settings-persona-select').value;

    if (provider === 'gemini' && !geminiApiKey) {
      this.showSettingsStatus("Please enter a Google AI Studio API Key.", "red");
      return;
    }
    if (provider === 'groq' && !groqApiKey) {
      this.showSettingsStatus("Please enter a Groq API Key.", "red");
      return;
    }

    await this.saveSettings({ provider, geminiApiKey, geminiModel, groqApiKey, groqModel, persona });
    this.showSettingsStatus("Settings saved successfully!", "green");
    this.updateBehaviorSelector();

    setTimeout(() => this.closeSettings(), 1000);
  }

  showSettingsStatus(msg, color) {
    const el = this.shadowRoot.querySelector('#settings-status-msg');
    el.style.display = 'block';
    el.innerText = msg;
    el.style.color = color === 'green' ? '#34d399' : color === 'red' ? '#f87171' : '#fbbf24';
  }

  async testSettingsConnection() {
    const shadow = this.shadowRoot;
    const provider = shadow.querySelector('#settings-provider-select').value;
    const geminiApiKey = shadow.querySelector('#settings-gemini-key-input').value.trim();
    const geminiModel = shadow.querySelector('#settings-gemini-model-select').value;
    const groqApiKey = shadow.querySelector('#settings-groq-key-input').value.trim();
    const groqModel = shadow.querySelector('#settings-groq-model-select').value;

    this.showSettingsStatus("Testing connection...", "yellow");

    if (provider === 'gemini') {
      if (!geminiApiKey) {
        this.showSettingsStatus("Enter a Google AI Studio API Key to test.", "red");
        return;
      }
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Hello. Respond in 2 words." }] }] })
        });
        if (response.ok) {
          this.showSettingsStatus("Gemini connection successful!", "green");
        } else {
          const errData = await response.json().catch(() => ({}));
          this.showSettingsStatus(`Gemini failed: ${errData.error?.message || response.statusText || response.status}`, "red");
        }
      } catch (e) {
        this.showSettingsStatus(`Network Error: ${e.message}`, "red");
      }
    } else if (provider === 'groq') {
      if (!groqApiKey) {
        this.showSettingsStatus("Enter a Groq API Key to test.", "red");
        return;
      }
      try {
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqApiKey}` },
          body: JSON.stringify({ model: groqModel, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 10 })
        });
        if (response.ok) {
          this.showSettingsStatus("Groq connection successful!", "green");
        } else {
          const errData = await response.json().catch(() => ({}));
          this.showSettingsStatus(`Groq failed: ${errData.error?.message || response.statusText || response.status}`, "red");
        }
      } catch (e) {
        this.showSettingsStatus(`Network Error: ${e.message}`, "red");
      }
    }
  }

  formatMarkdown(text) {
    if (!text) return "";

    const codeBlocks = [];
    let tempText = text.replace(/```([a-zA-Z0-9-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const blockHtml = `
        <div class="hf-code-block-container">
          <div class="hf-code-header">
            <span>${lang || 'code'}</span>
            <button class="hf-btn-copy-code">Copy</button>
          </div>
          <pre class="hf-code-block"><code class="language-${lang}">${escapedCode}</code></pre>
        </div>
      `;
      codeBlocks.push(blockHtml);
      return placeholder;
    });

    tempText = tempText
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="hf-inline-code">$1</code>')
      .replace(/\n/g, '<br/>');

    codeBlocks.forEach((blockHtml, index) => {
      tempText = tempText.replace(`__CODE_BLOCK_${index}__`, blockHtml);
    });

    return tempText;
  }

  renderMessages() {
    const currentTab = this.activeTab === 'analysis' ? 'hints' : this.activeTab;
    const logId = `#chat-messages-log-${currentTab}`;
    const log = this.shadowRoot.querySelector(logId);
    if (!log) return;
    log.innerHTML = '';

    const messages = (this.histories[currentTab] || []).filter(msg => msg && msg.text && msg.text.trim());
    messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `hf-msg ${msg.role === 'model' ? 'model' : 'user'}`;

      const isModel = msg.role === 'model';
      const isSystem = msg.text.startsWith('*System:');
      const name = isModel ? (currentTab === 'interviewer' ? 'Interviewer' : 'AI Tutor') : 'You';

      let formattedText = this.formatMarkdown(msg.text);

      if (isSystem) {
        msgEl.style.alignSelf = 'center';
        msgEl.style.maxWidth = '95%';
        msgEl.style.opacity = '0.9';
        msgEl.innerHTML = `<div style="font-size: 11.5px; font-weight: 500; background: #1c1c1c; padding: 8px 16px; border-radius: 8px; border: 1px solid #303030; color: #ffa116; text-align: center;">${formattedText.replace(/\*System:\s*/i, '')}</div>`;
      } else {
        msgEl.innerHTML = `
          <div class="hf-msg-header">
            <span class="hf-msg-avatar">${isModel ? '🤖' : '👤'}</span>
            <span class="hf-msg-name">${name}</span>
            <span class="hf-msg-time" style="font-weight: 400; opacity: 0.7; font-size: 10px; margin-left: 4px;">${msg.time}</span>
          </div>
          <div class="hf-msg-bubble">${formattedText}</div>
        `;
      }
      log.appendChild(msgEl);
    });

    setTimeout(() => {
      log.scrollTop = log.scrollHeight;
    }, 50);
  }

  updateWidgets() {
    const shadow = this.shadowRoot;

    // 1. Hint Level Dots
    const dotsContainer = shadow.querySelector('#hint-level-dots-container');
    const activeLevel = Math.min(5, Math.max(0, this.widgetState.hintLevel || 0));

    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      const titleLabel = shadow.querySelector('#hint-level-title-label');
      if (titleLabel) {
        titleLabel.textContent = `Hint Level: ${activeLevel}/5`;
      }

      for (let i = 1; i <= 5; i++) {
        const dot = document.createElement('span');
        dot.className = `hf-hint-dot ${i <= activeLevel ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
      }
    }

    const hintDesc = shadow.querySelector('#hint-level-desc-text');
    if (hintDesc) hintDesc.textContent = this.widgetState.hintText || 'Click "Next Hint" to get started.';

    // 2. Approach list / stats in Analysis section
    const curVal = shadow.querySelector('#approach-current-val');
    if (curVal) curVal.textContent = this.widgetState.currentApproach || 'None';

    const betVal = shadow.querySelector('#approach-better-val');
    if (betVal) betVal.textContent = this.widgetState.betterApproach || 'Not analyzed';

    const progressFill = shadow.querySelector('#analysis-progress-fill');
    if (progressFill) progressFill.style.width = `${Math.min(100, Math.max(0, this.widgetState.progress || 0))}%`;

    const progressBadge = shadow.querySelector('#analysis-progress-badge');
    if (progressBadge) progressBadge.textContent = `${this.widgetState.progress || 0}% Optimal`;

    // 3. Complexity boxes
    const timeVal = shadow.querySelector('#complexity-time-val');
    if (timeVal) timeVal.textContent = this.widgetState.timeComplexity || '-';

    const spaceVal = shadow.querySelector('#complexity-space-val');
    if (spaceVal) spaceVal.textContent = this.widgetState.spaceComplexity || '-';

    const improvBadge = shadow.querySelector('#complexity-improvable-badge');
    if (improvBadge) {
      if (this.widgetState.canImprove) {
        improvBadge.textContent = "Yes ▲";
        improvBadge.className = "hf-complexity-badge hf-badge-red";
      } else {
        improvBadge.textContent = "Optimal ✓";
        improvBadge.className = "hf-complexity-badge hf-badge-green";
      }
    }
  }

  async handleUserSendMessage() {
    const activeTabKey = this.activeTab === 'analysis' ? 'hints' : this.activeTab;
    const textInput = this.shadowRoot.querySelector(`#chat-textarea-input-${activeTabKey}`);
    if (!textInput) return;

    const userText = textInput.value.trim();
    if (!userText || this.isResponding) return;

    textInput.value = '';

    this.histories[activeTabKey].push({
      role: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();

    await this.callAI(userText);
  }

  async triggerQuickAction(actionType, placeholderMessage) {
    if (this.isResponding) return;

    const targetTab = this.activeTab === 'analysis' ? 'hints' : this.activeTab;
    this.histories[targetTab].push({
      role: 'user',
      text: placeholderMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();

    await this.callAI(placeholderMessage, actionType);
  }

  setResponding(state) {
    this.isResponding = state;
    const activeTabKey = this.activeTab === 'analysis' ? 'hints' : this.activeTab;

    const sendBtn = this.shadowRoot.querySelector(`#btn-send-message-${activeTabKey}`);
    const indicator = this.shadowRoot.querySelector(`#typing-indicator-${activeTabKey}`);

    if (sendBtn) sendBtn.disabled = state;
    if (indicator) indicator.style.display = state ? 'flex' : 'none';

    if (state) {
      const log = this.shadowRoot.querySelector(`#chat-messages-log-${activeTabKey}`);
      if (log) setTimeout(() => { log.scrollTop = log.scrollHeight; }, 50);
    }
  }

  async callAI(userPrompt, action = '') {
    this.setResponding(true);

    const problemInfo = this.parser.getProblemInfo();
    const problemContext = {
      title: problemInfo.title || document.title,
      difficulty: this.parser.getDifficulty(),
      description: this.parser.getDescription(),
      examples: this.parser.getExamples(),
      constraints: this.parser.getConstraints()
    };

    const codeState = {
      code: this.currentCode,
      language: this.currentLanguage
    };

    const activeTabKey = this.activeTab === 'analysis' ? 'hints' : this.activeTab;
    const activeHistory = this.histories[activeTabKey];
    const historyContext = [];
    let expectedRole = 'user';
    for (const msg of activeHistory.slice(0, -1)) {
      if (historyContext.length === 0 && msg.role === 'model') continue;
      const role = msg.role === 'model' ? 'model' : 'user';
      if (role === expectedRole) {
        historyContext.push({ role, parts: [{ text: msg.text }] });
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
    }

    if (this.settings.provider === 'gemini' && !this.settings.geminiApiKey) {
      this.addModelResponse("⚠️ **Google AI Studio API Key not configured!**\n\nPlease click on **⚙️ Settings** at the bottom of the sidebar and enter your API Key to start.");
      this.setResponding(false);
      return;
    }

    if (this.settings.provider === 'groq' && !this.settings.groqApiKey) {
      this.addModelResponse("⚠️ **Groq API Key not configured!**\n\nPlease click on **⚙️ Settings** at the bottom of the sidebar and enter your Groq API Key.");
      this.setResponding(false);
      return;
    }

    try {
      let result = null;
      if (this.settings.provider === 'groq') {
        result = await this.callGroqDirect(problemContext, codeState, userPrompt, historyContext, action);
      } else {
        result = await this.callGeminiDirect(problemContext, codeState, userPrompt, historyContext, action);
      }

      if (result) {
        // STRICT RULE: hintLevel ONLY increments when Next Hint button (action === 'stuck') is clicked!
        let calculatedHintLevel = this.widgetState.hintLevel || 0;
        if (action === 'stuck') {
          calculatedHintLevel = Math.min(5, calculatedHintLevel + 1);
        }

        this.widgetState = {
          progress: result.progress || 0,
          progressDesc: result.progressDesc || "You're making progress!",
          currentApproach: result.currentApproach || 'None',
          betterApproach: result.betterApproach || 'Not analyzed',
          timeComplexity: result.userCodeTimeComplexity || 'N/A',
          spaceComplexity: result.userCodeSpaceComplexity || 'N/A',
          canImprove: result.canImproveComplexity || false,
          hintLevel: calculatedHintLevel,
          hintText: result.hintText || result.chatMessage || 'Step-by-step guidance updated.'
        };

        this.addModelResponse(result.chatMessage);
      } else {
        this.addModelResponse("⚠️ Failed to parse response from AI.");
      }
    } catch (error) {
      console.error(error);
      this.addModelResponse(`❌ **Error generating response:** ${error.message}`);
    } finally {
      this.setResponding(false);
    }
  }

  addModelResponse(text) {
    if (!text || !text.trim()) return;
    const targetTab = this.activeTab === 'analysis' ? 'hints' : this.activeTab;
    this.histories[targetTab].push({
      role: 'model',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();
    this.updateWidgets();
  }

  setSheetMode(mode) {
    this.sheetMode = mode; // 'existing' | 'new'
    const shadow = this.shadowRoot;
    const btnExisting = shadow.querySelector('#btn-mode-existing-sheet');
    const btnNew = shadow.querySelector('#btn-mode-new-sheet');
    const secExisting = shadow.querySelector('#section-existing-sheet');
    const secNew = shadow.querySelector('#section-new-sheet');

    if (mode === 'existing') {
      btnExisting?.classList.add('active');
      btnNew?.classList.remove('active');
      if (secExisting) secExisting.style.display = 'block';
      if (secNew) secNew.style.display = 'none';
    } else {
      btnNew?.classList.add('active');
      btnExisting?.classList.remove('active');
      if (secNew) secNew.style.display = 'block';
      if (secExisting) secExisting.style.display = 'none';
    }
  }

  loadSheetsForModal() {
    const shadow = this.shadowRoot;
    const selectEl = shadow.querySelector('#accepted-sheet-select');
    const openLinkEl = shadow.querySelector('#accepted-sheet-open-link');
    const prevWrapper = shadow.querySelector('#previous-sheets-wrapper');
    const prevList = shadow.querySelector('#previous-sheets-list');

    chrome.runtime.sendMessage({ action: 'GET_SHEETS_LIST' }, (response) => {
      const list = response?.list || [];
      const activeId = response?.activeId || (list[0]?.id || null);

      if (!selectEl) return;
      selectEl.innerHTML = '';

      if (list.length === 0) {
        // No sheets yet -> switch to new sheet mode automatically
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No previous sheets found';
        selectEl.appendChild(opt);
        if (openLinkEl) openLinkEl.style.display = 'none';
        if (prevWrapper) prevWrapper.style.display = 'none';
        this.setSheetMode('new');
        return;
      }

      if (openLinkEl) openLinkEl.style.display = 'inline-flex';

      list.forEach((sheet) => {
        const opt = document.createElement('option');
        opt.value = sheet.id;
        opt.textContent = sheet.name || 'LeetCode Tracker';
        if (sheet.id === activeId) opt.selected = true;
        selectEl.appendChild(opt);
      });

      // Update link to selected sheet
      const updateLink = () => {
        const selectedId = selectEl.value;
        const found = list.find((s) => s.id === selectedId) || list[0];
        if (found && openLinkEl) {
          openLinkEl.href = found.url;
        }
      };
      updateLink();

      selectEl.onchange = () => {
        updateLink();
        // Highlight active pill
        prevList?.querySelectorAll('.hf-sheet-pill').forEach(pill => {
          pill.classList.toggle('hf-sheet-pill-active', pill.dataset.sheetId === selectEl.value);
        });
      };

      // Populate previous sheets pill list with clickable links
      if (prevWrapper && prevList) {
        prevList.innerHTML = '';
        if (list.length > 0) {
          prevWrapper.style.display = 'flex';
          list.forEach((sheet) => {
            const pill = document.createElement('div');
            pill.className = `hf-sheet-pill ${sheet.id === activeId ? 'hf-sheet-pill-active' : ''}`;
            pill.dataset.sheetId = sheet.id;
            pill.title = `Click to select "${sheet.name}". Or click ↗ to open in Google Drive.`;
            pill.innerHTML = `
              <span class="hf-sheet-pill-name" style="cursor: pointer;">📄 ${sheet.name}</span>
              <a href="${sheet.url}" target="_blank" class="hf-sheet-pill-open" title="Open sheet in new tab" style="color: inherit; opacity: 0.7; text-decoration: none; padding: 0 2px;">↗</a>
            `;

            // Clicking the pill name selects it
            pill.querySelector('.hf-sheet-pill-name')?.addEventListener('click', () => {
              selectEl.value = sheet.id;
              updateLink();
              this.setSheetMode('existing');
              prevList.querySelectorAll('.hf-sheet-pill').forEach(p => p.classList.remove('hf-sheet-pill-active'));
              pill.classList.add('hf-sheet-pill-active');
            });

            prevList.appendChild(pill);
          });
        } else {
          prevWrapper.style.display = 'none';
        }
      }

      this.setSheetMode('existing');
    });
  }

  openAcceptedModal(problemData) {
    if (!problemData) return;
    this.activeAcceptedData = { ...problemData };

    const shadow = this.shadowRoot;

    // 1. Problem title & difficulty
    const titleEl = shadow.querySelector('#accepted-problem-title');
    if (titleEl) titleEl.textContent = problemData.title || problemData.slug || 'Problem Solved';

    const diffEl = shadow.querySelector('#accepted-problem-diff');
    if (diffEl) {
      const diff = problemData.difficulty || 'Medium';
      diffEl.textContent = diff;
      diffEl.className = `hf-diff-badge ${(diff).toLowerCase()}`;
    }

    // 2. Metrics (Runtime, Memory)
    const runtimeVal = shadow.querySelector('#accepted-runtime-val');
    const runtimeBeats = shadow.querySelector('#accepted-runtime-beats');
    if (runtimeVal) runtimeVal.textContent = problemData.runtime || '-';
    if (runtimeBeats) runtimeBeats.textContent = problemData.runtimeBeats ? `Beats ${problemData.runtimeBeats}` : '';

    const memoryVal = shadow.querySelector('#accepted-memory-val');
    const memoryBeats = shadow.querySelector('#accepted-memory-beats');
    if (memoryVal) memoryVal.textContent = problemData.memory || '-';
    if (memoryBeats) memoryBeats.textContent = problemData.memoryBeats ? `Beats ${problemData.memoryBeats}` : '';

    // 3. Form fields
    const timeInput = shadow.querySelector('#accepted-time-input');
    if (timeInput) timeInput.value = problemData.timeTakenMin || 1;

    const noteInput = shadow.querySelector('#accepted-note-input');
    if (noteInput) noteInput.value = problemData.note || '';

    const newSheetNameInput = shadow.querySelector('#accepted-new-sheet-name-input');
    if (newSheetNameInput) newSheetNameInput.value = 'HintFlow — LeetCode Tracker';

    // 4. Load Sheets destination options
    this.loadSheetsForModal();

    // 5. Reset Push Button & Status
    const pushBtn = shadow.querySelector('#btn-push-google-sheet');
    if (pushBtn) {
      pushBtn.disabled = false;
      pushBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-4h5v4zm0-6H7V7h5v4zm6 6h-4V7h4v10z"/>
        </svg>
        <span>Push to Google Sheet</span>
      `;
    }

    const statusMsg = shadow.querySelector('#accepted-status-msg');
    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.innerHTML = '';
    }

    // 6. Show footer menu item so user can reopen if closed
    const footerSheet = shadow.querySelector('#footer-menu-sheet');
    if (footerSheet) footerSheet.style.display = 'inline-flex';

    // 7. Open sidebar & slide in modal overlay
    this.open();
    shadow.querySelector('#accepted-modal-overlay')?.classList.add('open');
  }

  closeAcceptedModal() {
    this.shadowRoot.querySelector('#accepted-modal-overlay')?.classList.remove('open');
  }

  reopenAcceptedModal() {
    if (this.activeAcceptedData) {
      this.openAcceptedModal(this.activeAcceptedData);
    }
  }

  handlePushToSheet() {
    if (!this.activeAcceptedData) return;

    const shadow = this.shadowRoot;
    const pushBtn = shadow.querySelector('#btn-push-google-sheet');
    const statusMsg = shadow.querySelector('#accepted-status-msg');
    const timeInput = shadow.querySelector('#accepted-time-input');
    const noteInput = shadow.querySelector('#accepted-note-input');
    const selectSheet = shadow.querySelector('#accepted-sheet-select');
    const newSheetNameInput = shadow.querySelector('#accepted-new-sheet-name-input');

    const isNewSheet = this.sheetMode === 'new';
    const targetSpreadsheetId = isNewSheet ? null : (selectSheet?.value || null);
    const newSheetTitle = isNewSheet ? (newSheetNameInput?.value || '').trim() || 'HintFlow — LeetCode Tracker' : null;

    const timeTaken = Number(timeInput?.value) || 1;
    const note = (noteInput?.value || '').trim();

    if (pushBtn) {
      pushBtn.disabled = true;
      pushBtn.innerHTML = `<span>Saving to Google Sheet...</span>`;
    }
    if (statusMsg) {
      statusMsg.style.display = 'none';
      statusMsg.innerHTML = '';
    }

    const today = new Date().toISOString().split('T')[0];
    const payload = {
      date: today,
      problem: this.activeAcceptedData.title,
      difficulty: this.activeAcceptedData.difficulty || 'Medium',
      language: this.activeAcceptedData.language || this.currentLanguage || '',
      timeTaken: timeTaken,
      note: note,
      createNewSheet: isNewSheet,
      newSheetTitle: newSheetTitle,
      targetSpreadsheetId: targetSpreadsheetId
    };

    chrome.runtime.sendMessage({ action: 'SAVE_TO_SHEET', payload }, (response) => {
      if (chrome.runtime.lastError) {
        if (pushBtn) {
          pushBtn.disabled = false;
          pushBtn.innerHTML = `<span>Retry Push to Google Sheet</span>`;
        }
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.className = 'hf-accepted-status hf-accepted-status-error';
          statusMsg.textContent = `Error: ${chrome.runtime.lastError.message}`;
        }
        return;
      }

      if (response && response.success) {
        if (pushBtn) {
          pushBtn.disabled = true;
          pushBtn.innerHTML = `<span>Saved to Google Sheet ✓</span>`;
        }
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.className = 'hf-accepted-status hf-accepted-status-success';
          statusMsg.innerHTML = `🎉 Successfully pushed! <a href="${response.spreadsheetUrl}" target="_blank" style="color: #2cbb5d; font-weight: 700; text-decoration: underline; margin-left: 6px;">Open Sheet ↗</a>`;
        }
        // Refresh sheet list in background
        this.loadSheetsForModal();
      } else {
        if (pushBtn) {
          pushBtn.disabled = false;
          pushBtn.innerHTML = `<span>Retry Push to Google Sheet</span>`;
        }
        if (statusMsg) {
          statusMsg.style.display = 'block';
          statusMsg.className = 'hf-accepted-status hf-accepted-status-error';
          statusMsg.textContent = `Error: ${response?.error || 'Failed to save to Google Sheet.'}`;
        }
      }
    });
  }

  // Backwards compatibility alias
  addPushToExcelCard(problemData) {
    this.openAcceptedModal(problemData);
  }

  getSystemInstruction(mode, persona) {
    let personaDirective = "";

    if (persona === 'interviewer') {
      personaDirective = `PERSONA: CHALLENGER (FAANG Senior Technical Interviewer)
- Tone: Strict, sharp, analytical, demanding, professional.
- Rule: NEVER give away the hint or algorithm! Do NOT reveal solution data structures like "use a HashMap" or "use Two Pointers".
- Action: Ask 1 CRISP, INTUITION-STRIKING QUESTION questioning the bottleneck of their code or logic (e.g. "What is the time complexity of your inner loop? What property of numbers could eliminate that extra search?").`;
    } else if (persona === 'mentor') {
      personaDirective = `PERSONA: COACH (Supportive Coding Mentor)
- Tone: Encouraging, structured, supportive.
- Rule: Do NOT dump complete solutions. Guide the user through problem-solving steps.
- Action: Ask gentle guiding questions that help the user break down the problem logically (e.g. "Good start! If you could store values as you iterate, what lookup time would you want?").`;
    } else if (persona === 'socratic') {
      personaDirective = `PERSONA: SOCRATIC (Pure Socratic Tutor)
- Tone: Purely inquisitive, question-driven.
- Rule: YOU MUST RESPOND ONLY WITH A GUIDING SOCRATIC QUESTION! Never state hints, answers, or code blocks.
- Action: Ask a thought-provoking counter-question that forces the candidate to deduce the idea themselves (e.g. "If you know the target sum and the current element x, what exact value are you looking for?").`;
    }

    const modeDirective = mode === 'interviewer'
      ? `MODE: INTERVIEW MODE
CRITICAL INTERVIEW RULE: DO NOT GIVE HINTS OR SOLUTION STEPS IN INTERVIEW MODE! Hints belong strictly in the separate "Hint Mode" tab. Your sole role here is to act as a real tech interviewer—ask intuition-striking questions, challenge their time/space complexity, and probe their logic without spoiling the answer. If the candidate asks for a hint in Interviewer Mode, say: "I can't provide hints in Interviewer Mode—switch to the 'Hint Mode' tab for step-by-step nudges! What logic are you contemplating?"`
      : `MODE: HINT MODE
Provide step-by-step conceptual nudges for the user's current progress stage. Do not output complete code blocks for the full solution.`;

    const conversationalRule = `CONVERSATIONAL & GREETING HANDLING:
- If the user's message is a greeting or casual remark (e.g., "hlo", "hi", "hello", "hey", "how are you"):
  - DO NOT dump problem analysis, complexity stats, or technical questions!
  - Reply naturally in 1 short sentence:
    - If in Interviewer Mode: "Hello! I'm your interviewer today. Tell me your initial thoughts or proposed approach when you're ready."
    - If in Hint Mode: "Hello! Let me know what part of the problem you'd like a hint on, or click 'Next Hint' above."
- If the user's message is an acknowledgment (e.g., "ok", "okay", "got it", "thanks", "sure", "cool", "yes"):
  - Reply in 1 short friendly sentence: "Great! Let me know what logic or code you plan to write next."`;

    return `You are HintFlow, a top-tier AI coding mentor for LeetCode.

${modeDirective}

${personaDirective}

${conversationalRule}

STRICT RESPONSE FORMAT:
Return strictly a JSON object matching this schema (do not wrap in markdown blocks):
{
  "chatMessage": "Your message to the user.",
  "progress": 75,
  "progressDesc": "Progress summary",
  "currentApproach": "User's current approach, e.g. Two Pointers with sorting",
  "betterApproach": "Target optimal approach, e.g. Hash Map (40% Optimal)",
  "userCodeTimeComplexity": "Time complexity estimate, e.g. O(n log n)",
  "userCodeSpaceComplexity": "Space complexity estimate, e.g. O(n)",
  "canImproveComplexity": true,
  "hintLevel": 1,
  "hintText": "Short conceptual hint"
}`;
  }

  async callGeminiDirect(problem, codeState, userPrompt, history, action) {
    const key = this.settings.geminiApiKey;
    const model = this.settings.geminiModel;
    const persona = this.settings.persona;
    const mode = this.activeTab;

    const systemInstruction = this.getSystemInstruction(mode, persona);

    const promptText = `
PROBLEM CONTEXT:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description: ${problem.description}

USER CODE CONTEXT:
Language: ${codeState.language}
Current Code:
\`\`\`
${codeState.code}
\`\`\`

USER MESSAGE: ${userPrompt}
Respond with JSON payload.`;

    const contents = [...history, { role: 'user', parts: [{ text: promptText }] }];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: [{ text: systemInstruction }] },
        generation_config: {
          response_mime_type: 'application/json',
          response_schema: {
            type: 'OBJECT',
            properties: {
              chatMessage: { type: 'STRING' },
              progress: { type: 'INTEGER' },
              progressDesc: { type: 'STRING' },
              currentApproach: { type: 'STRING' },
              betterApproach: { type: 'STRING' },
              userCodeTimeComplexity: { type: 'STRING' },
              userCodeSpaceComplexity: { type: 'STRING' },
              canImproveComplexity: { type: 'BOOLEAN' },
              hintLevel: { type: 'INTEGER' },
              hintText: { type: 'STRING' }
            },
            required: ['chatMessage', 'progress', 'currentApproach', 'betterApproach', 'userCodeTimeComplexity', 'userCodeSpaceComplexity', 'canImproveComplexity', 'hintLevel', 'hintText']
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || response.statusText);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(responseText);
  }

  async callGroqDirect(problem, codeState, userPrompt, history, action) {
    const key = this.settings.groqApiKey;
    const model = this.settings.groqModel;
    const persona = this.settings.persona;
    const mode = this.activeTab;

    const systemInstruction = this.getSystemInstruction(mode, persona);

    const promptText = `PROBLEM: ${problem.title}\nCODE:\n\`\`\`\n${codeState.code}\n\`\`\`\nUSER MESSAGE: ${userPrompt}`;

    const messages = [{ role: 'system', content: systemInstruction }];
    for (const msg of history) {
      messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.parts[0].text });
    }
    messages.push({ role: 'user', content: promptText });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || response.statusText);
    }

    const data = await response.json();
    return JSON.parse(data.choices?.[0]?.message?.content);
  }
}

// Expose class globally
window.HintFlowSidebar = HintFlowSidebar;
