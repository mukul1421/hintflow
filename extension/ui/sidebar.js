class HintFlowSidebar {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.shadowRoot = container.attachShadow({ mode: 'open' });
    
    // UI state
    this.isOpen = false;
    this.activeTab = 'interviewer'; // 'interviewer' | 'hints'
    this.currentCode = "";
    this.currentLanguage = "";
    this.isResponding = false;
    
    // Conversation histories
    this.histories = {
      interviewer: [],
      hints: []
    };
    
    // Settings configuration
    this.settings = {
      provider: 'gemini', // 'gemini' | 'groq' | 'backend'
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      groqApiKey: '',
      groqModel: 'llama-3.3-70b-versatile',
      backendUrl: 'http://localhost:3000/api/hint',
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
      hintText: 'Click "Start Session" or write a message to begin.'
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
      const history = this.histories[this.activeTab];
      if (history.length === 0) {
        this.addWelcomeMessage();
      }
    } else {
      sidebarEl.classList.remove('open');
      toggleBtn.classList.remove('hidden');
      document.body.classList.remove('hintflow-sidebar-open');
    }
  }

  addWelcomeMessage() {
    let welcome = "";
    if (this.activeTab === 'interviewer') {
      welcome = "Hello! I am your AI interviewer. Let's practice! Open a LeetCode problem, check out the description, and when you are ready, describe your approach or type your ideas below. I'll evaluate your code and reasoning just like a real interview.";
      this.widgetState.hintText = "Describe your approach to start the interview.";
    } else if (this.activeTab === 'hints') {
      welcome = "Welcome to Hint mode! I will act as a coding tutor. I'll read the problem and your code, then guide you step-by-step. Let me know when you need a nudge.";
      this.widgetState.hintText = "Click \"Next Hint\" or ask a question to receive a step-by-step nudge.";
    }
    
    this.histories[this.activeTab].push({
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        :host {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #eff1f6;
          box-sizing: border-box;
        }

        * {
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: #3d3d3d #1a1a1a;
        }

        /* Webkit Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        ::-webkit-scrollbar-thumb {
          background: #3d3d3d;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #4d4d4d;
        }

        /* Floating Toggle Button - Premium Glow Style */
        .hf-floating-toggle {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #1a1a1a;
          color: #ffa116;
          border: 1px solid #ffa116;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4), 0 0 15px rgba(255, 161, 22, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          z-index: 2147483647;
        }
        
        .hf-floating-toggle:hover {
          transform: scale(1.08) translateY(-2px);
          background: #222222;
          border-color: #ffb84d;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 161, 22, 0.4);
        }

        .hf-floating-toggle.hidden {
          transform: scale(0);
          opacity: 0;
          pointer-events: none;
        }

        /* Sidebar Wrapper with Elegant Depth Shadow */
        .hf-sidebar-wrapper {
          position: fixed;
          top: 0;
          right: -480px;
          width: 480px;
          height: 100vh;
          background: #1a1a1a;
          border-left: 1px solid #2e2e2e;
          box-shadow: -15px 0 45px rgba(0, 0, 0, 0.7);
          transition: right 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
          z-index: 2147483646;
          display: flex;
          flex-direction: column;
        }

        .hf-sidebar-wrapper.open {
          right: 0;
        }

        /* Inner Layout: Single Column */
        .hf-sidebar-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: calc(100vh - 60px - 48px);
        }

        /* Header Styles with Drop Shadow */
        .hf-sidebar-header {
          height: 54px;
          background: #282828;
          border-bottom: 1px solid #3c3c3c;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          z-index: 10;
        }

        .hf-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          color: #eff1f6;
        }
        
        .hf-header-title .hf-logo-accent {
          color: #ffa116;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .hf-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hf-btn-close {
          background: transparent;
          border: none;
          color: #8a8a8a;
          cursor: pointer;
          font-size: 16px;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .hf-btn-close:hover {
          color: white;
          background: #333333;
        }

        /* Mode / Tab Bar (LeetCode panel tabs representation) */
        .hf-tabs {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          padding: 0;
          background: #282828;
          border-bottom: 1px solid #3c3c3c;
          height: 38px;
          flex-shrink: 0;
          z-index: 9;
        }

        .hf-tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: #8a8a8a;
          font-family: inherit;
          font-weight: 500;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          gap: 6px;
          position: relative;
          height: 100%;
        }

        .hf-tab-icon {
          font-size: 14px;
        }

        .hf-tab-btn.active {
          color: #ffffff;
          font-weight: 600;
        }

        .hf-tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: #ffa116;
        }

        .hf-tab-btn:hover:not(.active) {
          color: #eff1f6;
          background: rgba(255, 255, 255, 0.02);
        }

        /* Tab Content Panes */
        .hf-tab-content {
          display: none;
          flex: 1;
          flex-direction: column;
          overflow: hidden;
          background: #1e1e1e;
        }

        .hf-tab-content.active {
          display: flex;
        }

        /* Chat Messages List */
        .hf-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #1e1e1e;
        }

        .hf-msg {
          display: flex;
          flex-direction: column;
          max-width: 85%;
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
          font-size: 10px;
          color: #8a8a8a;
          margin-bottom: 4px;
          padding: 0 4px;
        }

        .hf-msg.user .hf-msg-header {
          justify-content: flex-end;
        }

        .hf-msg-avatar {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #2a2a2a;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffa116;
          font-size: 9px;
          border: 1px solid #3c3c3c;
        }

        .hf-msg.user .hf-msg-avatar {
          background: #333333;
          color: #00b8a3;
          border: 1px solid #4c4c4c;
          order: 2;
        }

        .hf-msg-bubble {
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.6;
          word-break: break-word;
          background: #282828;
          color: #eff1f6;
          border: 1px solid #333333;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .hf-msg.user .hf-msg-bubble {
          background: #2c2a20; /* Elegant LeetCode-matching warm tint */
          color: #eff1f6;
          border: 1px solid #524223;
          box-shadow: 0 4px 12px rgba(255, 161, 22, 0.05);
        }

        /* Monaco-like Code Blocks inside Messages */
        .hf-inline-code {
          background: #1a1a1a !important;
          color: #ffa116 !important;
          padding: 2px 5px !important;
          border-radius: 4px !important;
          font-family: Menlo, Monaco, Consolas, "Courier New", monospace !important;
          font-size: 12px !important;
          border: 1px solid #333333 !important;
        }

        .hf-code-block {
          background: #181818;
          border: 1px solid #333333;
          border-radius: 8px;
          padding: 12px;
          overflow-x: auto;
          margin: 8px 0;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }

        .hf-code-block code {
          background: transparent !important;
          color: #eff1f6 !important;
          padding: 0 !important;
          border: none !important;
          font-family: Menlo, Monaco, Consolas, "Courier New", monospace !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
        }

        .hf-typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          background: #282828;
          border-radius: 8px;
          align-self: flex-start;
          margin-bottom: 8px;
          border: 1px solid #333333;
          margin-left: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .hf-typing-dot {
          width: 6px;
          height: 6px;
          background: #ffa116;
          border-radius: 50%;
          animation: hf-bounce 1.4s infinite ease-in-out both;
        }

        .hf-typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .hf-typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes hf-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }

        /* Input Panel with subtle top border shadow */
        .hf-chat-input-area {
          padding: 12px;
          border-top: 1px solid #3c3c3c;
          background: #2a2a2a;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        }

        .hf-input-field {
          flex: 1;
          background: #1a1a1a;
          border: 1px solid #3c3c3c;
          border-radius: 6px;
          padding: 10px 12px;
          color: #eff1f6;
          font-family: inherit;
          font-size: 13px;
          resize: none;
          height: 38px;
          outline: none;
          transition: all 0.2s ease;
        }

        .hf-input-field:focus {
          border-color: #ffa116;
          background: #202020;
          box-shadow: 0 0 0 2px rgba(255, 161, 22, 0.15);
        }

        .hf-btn-send {
          width: 38px;
          height: 38px;
          border-radius: 6px;
          background: #2c2c2c;
          color: #ffa116;
          border: 1px solid #3c3c3c;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          font-size: 15px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .hf-btn-send:hover:not(:disabled) {
          background: #333333;
          color: #ffb84d;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }

        .hf-btn-send:disabled {
          color: #4c4c4c;
          cursor: not-allowed;
        }

        /* Interviewer Behavior Selector Styles */
        .hf-behavior-selector-card {
          background: #282828;
          border-bottom: 1px solid #3c3c3c;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-shrink: 0;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }

        .hf-behavior-label {
          font-size: 12px;
          font-weight: 500;
          color: #eff1f6;
        }

        .hf-behavior-options {
          display: flex;
          background: #1a1a1a;
          border: 1px solid #3c3c3c;
          border-radius: 6px;
          padding: 3px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .hf-behavior-btn {
          background: transparent;
          border: none;
          color: #8a8a8a;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hf-behavior-btn.active {
          background: #2c2c2c;
          color: #ffa116;
          font-weight: 600;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .hf-behavior-btn:hover:not(.active) {
          color: #ffffff;
        }

        /* Hint Tab Widgets Layout */
        .hf-hint-widgets-wrapper {
          background: #282828;
          border-bottom: 1px solid #3c3c3c;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
          gap: 4px;
        }

        .hf-widget-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #8a8a8a;
          font-weight: 700;
        }

        .hf-hint-dots-row {
          display: flex;
          gap: 6px;
        }

        .hf-hint-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #1a1a1a;
          border: 1px solid #3c3c3c;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hf-hint-dot.active {
          background: #ffa116;
          border-color: #ffa116;
          box-shadow: 0 0 8px rgba(255, 161, 22, 0.6);
        }

        .hf-btn-next-hint {
          background: #ffa116;
          color: #1a1a1a;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(255, 161, 22, 0.2);
        }

        .hf-btn-next-hint:hover {
          background: #ffb84d;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(255, 161, 22, 0.3);
        }

        /* Description Line for Hint Text */
        .hf-hint-desc-container {
          font-size: 11px;
          color: #b3b3b3;
          line-height: 1.5;
          border-top: 1px solid #3c3c3c;
          padding-top: 8px;
          margin-top: 4px;
        }

        /* Compact Info card inside Hint Section */
        .hf-hint-stats-card {
          background: #1a1a1a;
          border: 1px solid #3c3c3c;
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .hf-stats-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
        }

        .hf-stats-label {
          color: #8a8a8a;
        }

        .hf-stats-value {
          font-weight: 500;
          color: #eff1f6;
        }

        .hf-complexity-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.3px;
        }

        .hf-badge-red { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
        .hf-badge-green { background: rgba(0, 184, 163, 0.12); color: #00b8a3; border: 1px solid rgba(0, 184, 163, 0.2); }
        .hf-badge-grey { background: rgba(138, 138, 138, 0.12); color: #8a8a8a; border: 1px solid rgba(138, 138, 138, 0.2); }

        /* Advices Quick Actions Grid inside Hint Section */
        .hf-advices-section {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hf-advices-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .hf-action-btn {
          background: #1a1a1a;
          border: 1px solid #3c3c3c;
          color: #eff1f6;
          padding: 8px 6px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          font-weight: 500;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .hf-action-btn:hover {
          background: #242424;
          border-color: #ffa116;
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.25);
        }

        .hf-action-btn.full-width {
          grid-column: span 3;
          flex-direction: row;
          padding: 8px;
          font-size: 11px;
          font-weight: 600;
        }

        /* Bottom Menu Footer */
        .hf-sidebar-footer {
          height: 48px;
          border-top: 1px solid #3c3c3c;
          background: #282828;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 0 16px;
          flex-shrink: 0;
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.15);
        }

        .hf-footer-item {
          font-size: 11px;
          color: #8a8a8a;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .hf-footer-item:hover {
          color: #ffa116;
        }

        /* Settings Overlay Modal */
        .hf-settings-overlay {
          position: absolute;
          inset: 0;
          background: #1e1e1e;
          z-index: 100;
          display: flex;
          flex-direction: column;
          padding: 20px;
          transform: translateY(100%);
          transition: transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .hf-settings-overlay.open {
          transform: translateY(0);
        }

        .hf-settings-title {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 16px;
          color: #ffffff;
          border-bottom: 1px solid #3c3c3c;
          padding-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .hf-settings-form {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .hf-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hf-form-label {
          font-size: 11px;
          font-weight: 600;
          color: #8a8a8a;
          letter-spacing: 0.3px;
        }

        .hf-form-input, .hf-form-select {
          background: #2a2a2a;
          border: 1px solid #3c3c3c;
          border-radius: 6px;
          padding: 8px 12px;
          color: #eff1f6;
          font-family: inherit;
          font-size: 12px;
          outline: none;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .hf-form-input:focus, .hf-form-select:focus {
          border-color: #ffa116;
          background: #2d2d2d;
          box-shadow: 0 0 0 2px rgba(255, 161, 22, 0.15);
        }

        .hf-settings-footer {
          margin-top: 16px;
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .hf-btn-save {
          flex: 1;
          background: #ffa116;
          border: none;
          color: #1a1a1a;
          padding: 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }

        .hf-btn-save:hover {
          background: #ffb84d;
        }

        .hf-btn-test {
          background: #2a2a2a;
          border: 1px solid #3c3c3c;
          color: #eff1f6;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hf-btn-test:hover {
          background: #333333;
          color: white;
        }

        .hf-settings-status {
          font-size: 11px;
          text-align: center;
          margin-top: 6px;
          font-weight: 600;
        }
      </style>

      <!-- SVG gradients definitions -->
      <svg style="width:0; height:0; position:absolute;">
        <defs>
          <linearGradient id="hf-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4743" />
            <stop offset="50%" stop-color="#ffa116" />
            <stop offset="100%" stop-color="#00b8a3" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Floating Button (triggers toggle) -->
      <button class="hf-floating-toggle" title="Open HintFlow AI Mentor">🤖</button>

      <!-- Sidebar Wrapper -->
      <div class="hf-sidebar-wrapper">
        <!-- Sidebar Header -->
        <div class="hf-sidebar-header">
          <div class="hf-header-title">
            <span class="hf-logo-accent">🤖 HintFlow</span> AI Mentor
          </div>
          <div class="hf-header-actions">
            <button class="hf-btn-close" id="close-sidebar-btn" title="Close Sidebar">✕</button>
          </div>
        </div>

        <!-- Tabs Bar -->
        <div class="hf-tabs">
          <button class="hf-tab-btn active" data-tab="interviewer">
            <span class="hf-tab-icon">👤</span>
            <span>Interviewer</span>
          </button>
          <button class="hf-tab-btn" data-tab="hints">
            <span class="hf-tab-icon">💡</span>
            <span>Hint</span>
          </button>
        </div>

        <!-- Sidebar Body (Single Column Pane) -->
        <div class="hf-sidebar-main">
          <!-- Tab 1: Interviewer Section -->
          <div class="hf-tab-content active" id="tab-content-interviewer">
            <!-- Interviewer Behavior selector inside this tab -->
            <div class="hf-behavior-selector-card">
              <span class="hf-behavior-label">Interviewer Behavior:</span>
              <div class="hf-behavior-options">
                <button class="hf-behavior-btn active" data-persona="interviewer">Challenger</button>
                <button class="hf-behavior-btn" data-persona="mentor">Coach</button>
                <button class="hf-behavior-btn" data-persona="socratic">Socratic</button>
              </div>
            </div>

            <!-- Messages Log -->
            <div class="hf-chat-messages" id="chat-messages-log-interviewer">
              <!-- Messages will be rendered here dynamically -->
            </div>

            <!-- Typing indicator -->
            <div class="hf-typing-indicator" style="display: none;" id="typing-indicator-interviewer">
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
            </div>

            <!-- Input area -->
            <div class="hf-chat-input-area">
              <textarea class="hf-input-field" placeholder="Type your response to the interviewer..." id="chat-textarea-input-interviewer"></textarea>
              <button class="hf-btn-send" id="btn-send-message-interviewer" title="Send Message">➤</button>
            </div>
          </div>

          <!-- Tab 2: Hint Section -->
          <div class="hf-tab-content" id="tab-content-hints">
            <!-- Widgets wrapper at the top -->
            <div class="hf-hint-widgets-wrapper">
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
                <button class="hf-btn-next-hint" id="btn-request-next-hint">Next Hint</button>
              </div>

              <!-- Compact description line for hint text -->
              <div class="hf-hint-desc-container" id="hint-level-desc-text">
                No hints requested yet.
              </div>

              <!-- Stats & Complexity Card -->
              <div class="hf-hint-stats-card">
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Approach (Current):</span>
                  <span class="hf-stats-value" id="approach-current-val">None</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Approach (Better):</span>
                  <span class="hf-stats-value" id="approach-better-val">Not analyzed</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Time Complexity:</span>
                  <span class="hf-stats-value" id="complexity-time-val">-</span>
                </div>
                <div class="hf-stats-row">
                  <span class="hf-stats-label">Space Complexity:</span>
                  <span class="hf-stats-value" id="complexity-space-val">-</span>
                </div>
                <div class="hf-stats-row" style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 4px;">
                  <span class="hf-stats-label">Can improve?</span>
                  <span id="complexity-improvable-badge" class="hf-complexity-badge hf-badge-grey">N/A</span>
                </div>
              </div>

              <!-- Emojis & Advices Quick Actions Grid -->
              <div class="hf-advices-section">
                <span class="hf-widget-label">Get Advice On:</span>
                <div class="hf-advices-grid">
                  <button class="hf-action-btn" data-action="stuck">😢 Stuck</button>
                  <button class="hf-action-btn" data-action="wrong">🐞 Wrong Code</button>
                  <button class="hf-action-btn" data-action="optimize">🚀 Optimize</button>
                  <button class="hf-action-btn" data-action="error">⚠️ Error Help</button>
                  <button class="hf-action-btn" data-action="edge">🛡️ Edge Cases</button>
                  <button class="hf-action-btn" data-action="dryrun">🎬 Dry Run</button>
                  <button class="hf-action-btn full-width" data-action="ask">💬 Ask Anything (Type below)</button>
                </div>
              </div>
            </div>

            <!-- Messages Log -->
            <div class="hf-chat-messages" id="chat-messages-log-hints">
              <!-- Messages will be rendered here dynamically -->
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
              <button class="hf-btn-send" id="btn-send-message-hints" title="Send Message">➤</button>
            </div>
          </div>
        </div>

        <!-- Footer Menu -->
        <div class="hf-sidebar-footer">
          <span class="hf-footer-item" id="footer-menu-settings">⚙️ Settings</span>
          <span class="hf-footer-item" id="footer-menu-tips">💡 Interview Tips</span>
          <span class="hf-footer-item" id="footer-menu-notes">📝 Notes</span>
        </div>

        <!-- Settings Slide-up Modal -->
        <div class="hf-settings-overlay" id="settings-overlay-modal">
          <div class="hf-settings-title">
            <span>⚙️ Settings</span>
            <button class="hf-btn-close" id="close-settings-btn">✕</button>
          </div>
          <div class="hf-settings-form">
            <div class="hf-form-group">
              <label class="hf-form-label">API Provider</label>
              <select class="hf-form-select" id="settings-provider-select">
                <option value="gemini">Google AI Studio (Gemini)</option>
                <option value="groq">Groq Cloud (Llama/Gemma)</option>
                <option value="backend">Local Backend Server (Express)</option>
              </select>
            </div>

            <div class="hf-form-group" id="settings-gemini-key-group">
              <label class="hf-form-label">Google AI Studio API Key</label>
              <input type="password" class="hf-form-input" placeholder="AIzaSy..." id="settings-gemini-key-input" />
              <div style="font-size: 10px; color: #8a8a8a; margin-top: 2px;">
                You can get your free API key from Google AI Studio. It is stored securely in your browser.
              </div>
            </div>

            <div class="hf-form-group" id="settings-gemini-model-group">
              <label class="hf-form-label">Gemini Model</label>
              <select class="hf-form-select" id="settings-gemini-model-select">
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Advanced)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thorough)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </select>
            </div>

            <div class="hf-form-group" id="settings-groq-key-group">
              <label class="hf-form-label">Groq API Key</label>
              <input type="password" class="hf-form-input" placeholder="gsk_..." id="settings-groq-key-input" />
              <div style="font-size: 10px; color: #8a8a8a; margin-top: 2px;">
                Get your free API key from console.groq.com.
              </div>
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

            <div class="hf-form-group" id="settings-backend-url-group">
              <label class="hf-form-label">Backend URL</label>
              <input type="text" class="hf-form-input" placeholder="http://localhost:3000/api/hint" id="settings-backend-url-input" />
            </div>

            <div class="hf-form-group">
              <label class="hf-form-label">Mentor Persona</label>
              <select class="hf-form-select" id="settings-persona-select">
                <option value="interviewer">FAANG Interviewer (Challenging)</option>
                <option value="mentor">Helpful Coding Coach (Supportive)</option>
                <option value="socratic">Socratic Tutor (Asks questions only)</option>
              </select>
            </div>
          </div>
          <div class="hf-settings-status" id="settings-status-msg" style="display: none;"></div>
          <div class="hf-settings-footer">
            <button class="hf-btn-test" id="btn-test-settings-connection">Test Connection</button>
            <button class="hf-btn-save" id="btn-save-settings-form">Save & Close</button>
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
    
    // Tab switching
    shadow.querySelectorAll('.hf-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Send message on Enter or Click for Interviewer tab
    const textInputInterviewer = shadow.querySelector('#chat-textarea-input-interviewer');
    const sendBtnInterviewer = shadow.querySelector('#btn-send-message-interviewer');
    
    sendBtnInterviewer.addEventListener('click', () => this.handleUserSendMessage());
    textInputInterviewer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSendMessage();
      }
    });

    // Send message on Enter or Click for Hints tab
    const textInputHints = shadow.querySelector('#chat-textarea-input-hints');
    const sendBtnHints = shadow.querySelector('#btn-send-message-hints');
    
    sendBtnHints.addEventListener('click', () => this.handleUserSendMessage());
    textInputHints.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSendMessage();
      }
    });

    // Request Next Hint
    shadow.querySelector('#btn-request-next-hint').addEventListener('click', () => {
      this.triggerQuickAction('stuck', 'Please provide the next progressive hint.');
    });

    // Quick Actions Click
    shadow.querySelectorAll('.hf-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        if (action === 'stuck') {
          this.triggerQuickAction('stuck', "I'm stuck. Can you give me a conceptual hint?");
        } else if (action === 'wrong') {
          this.triggerQuickAction('wrong', "My code is wrong/failing. Can you help me find the bug without giving the solution?");
        } else if (action === 'optimize') {
          this.triggerQuickAction('optimize', "Can you explain how I can optimize my approach?");
        } else if (action === 'error') {
          this.triggerQuickAction('error', "I'm encountering an error. Let me share my code, can you explain what is wrong?");
        } else if (action === 'edge') {
          this.triggerQuickAction('edge', "What edge cases should I test my current code against?");
        } else if (action === 'dryrun') {
          this.triggerQuickAction('dryrun', "Can you dry run my code with a simple test case to show how it executes?");
        } else if (action === 'ask') {
          textInputHints.focus();
        }
      });
    });

    // Interviewer Behavior selector buttons
    shadow.querySelectorAll('.hf-behavior-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const persona = e.currentTarget.dataset.persona;
        await this.saveSettings({ persona });
        this.updateBehaviorSelector();
        
        // Print a small system message in the Interviewer chat
        this.histories.interviewer.push({
          role: 'model',
          text: `*System: Interviewer persona switched to **${persona === 'interviewer' ? 'FAANG Interviewer' : persona === 'mentor' ? 'Helpful Coach' : 'Socratic Tutor'}**.*`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        this.renderMessages();
      });
    });

    // Settings overlay toggle
    shadow.querySelector('#footer-menu-settings').addEventListener('click', () => {
      this.openSettings();
    });
    
    shadow.querySelector('#close-settings-btn').addEventListener('click', () => {
      this.closeSettings();
    });

    shadow.querySelector('#btn-save-settings-form').addEventListener('click', () => {
      this.saveSettingsForm();
    });

    shadow.querySelector('#btn-test-settings-connection').addEventListener('click', () => {
      this.testSettingsConnection();
    });

    // Settings provider change
    shadow.querySelector('#settings-provider-select').addEventListener('change', (e) => {
      this.toggleSettingsFormFields(e.target.value);
    });

    // Simple alerts for mock links
    shadow.querySelector('#footer-menu-tips').addEventListener('click', () => {
      alert("💡 Interview Tips:\n1. Clarify requirements before coding.\n2. State time/space complexity first.\n3. Mention edge cases (empty arrays, bounds).\n4. Walk through a dry run on paper.");
    });
    shadow.querySelector('#footer-menu-notes').addEventListener('click', () => {
      alert("📝 Notes:\nSave your session summaries here to review before real technical interviews!");
    });

    // Sync the selector button state on start
    this.updateBehaviorSelector();
  }

  updateBehaviorSelector() {
    const persona = this.settings.persona;
    this.shadowRoot.querySelectorAll('.hf-behavior-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.persona === persona);
    });
    // Also sync the settings modal dropdown
    const modalSelect = this.shadowRoot.querySelector('#settings-persona-select');
    if (modalSelect) {
      modalSelect.value = persona;
    }
  }

  switchTab(tab) {
    if (this.activeTab === tab) return;
    
    // Hide old active content pane and tab button
    this.shadowRoot.querySelectorAll('.hf-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    this.shadowRoot.querySelectorAll('.hf-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-content-${tab}`);
    });
    
    this.activeTab = tab;
    
    // Initial welcome message if history is empty
    if (this.histories[tab].length === 0) {
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
    
    shadow.querySelector('#settings-backend-url-input').value = this.settings.backendUrl || '';
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
    
    shadow.querySelector('#settings-backend-url-group').style.display = provider === 'backend' ? 'flex' : 'none';
  }

  async saveSettingsForm() {
    const shadow = this.shadowRoot;
    const provider = shadow.querySelector('#settings-provider-select').value;
    const geminiApiKey = shadow.querySelector('#settings-gemini-key-input').value.trim();
    const geminiModel = shadow.querySelector('#settings-gemini-model-select').value;
    const groqApiKey = shadow.querySelector('#settings-groq-key-input').value.trim();
    const groqModel = shadow.querySelector('#settings-groq-model-select').value;
    const backendUrl = shadow.querySelector('#settings-backend-url-input').value.trim();
    const persona = shadow.querySelector('#settings-persona-select').value;

    if (provider === 'gemini' && !geminiApiKey) {
      this.showSettingsStatus("Please enter a Google AI Studio API Key.", "red");
      return;
    }

    if (provider === 'groq' && !groqApiKey) {
      this.showSettingsStatus("Please enter a Groq API Key.", "red");
      return;
    }

    if (provider === 'backend' && !backendUrl) {
      this.showSettingsStatus("Please enter a Backend URL.", "red");
      return;
    }

    await this.saveSettings({ provider, geminiApiKey, geminiModel, groqApiKey, groqModel, backendUrl, persona });
    this.showSettingsStatus("Settings saved successfully!", "green");
    
    this.updateBehaviorSelector();
    
    setTimeout(() => {
      this.closeSettings();
    }, 1000);
  }

  showSettingsStatus(msg, color) {
    const el = this.shadowRoot.querySelector('#settings-status-msg');
    el.style.display = 'block';
    el.innerText = msg;
    if (color === 'green') {
      el.style.color = '#34d399';
    } else if (color === 'red') {
      el.style.color = '#f87171';
    } else {
      el.style.color = '#fbbf24'; // yellow
    }
  }

  async testSettingsConnection() {
    const shadow = this.shadowRoot;
    const provider = shadow.querySelector('#settings-provider-select').value;
    const geminiApiKey = shadow.querySelector('#settings-gemini-key-input').value.trim();
    const geminiModel = shadow.querySelector('#settings-gemini-model-select').value;
    const groqApiKey = shadow.querySelector('#settings-groq-key-input').value.trim();
    const groqModel = shadow.querySelector('#settings-groq-model-select').value;
    const backendUrl = shadow.querySelector('#settings-backend-url-input').value.trim();

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
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Hello. Respond in 2 words." }] }]
          })
        });

        if (response.ok) {
          this.showSettingsStatus("Gemini connection successful!", "green");
        } else {
          const err = await response.json();
          let errMessage = err.error?.message || response.statusText;
          
          try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
            const listResponse = await fetch(listUrl);
            if (listResponse.ok) {
              const listData = await listResponse.json();
              const models = listData.models?.map(m => m.name.replace('models/', '')) || [];
              console.log("[HintFlow] Available models for this key:", models);
              if (models.length > 0) {
                errMessage += ` (Available: ${models.slice(0, 3).join(', ')}...)`;
              }
            }
          } catch (listErr) {
            console.error("[HintFlow] Failed to list models:", listErr);
          }

          this.showSettingsStatus(`Failed: ${errMessage}`, "red");
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [{ role: 'user', content: 'Hello. Respond in 2 words.' }],
            max_tokens: 10
          })
        });

        if (response.ok) {
          this.showSettingsStatus("Groq connection successful!", "green");
        } else {
          const err = await response.json();
          this.showSettingsStatus(`Failed: ${err.error?.message || response.statusText}`, "red");
        }
      } catch (e) {
        this.showSettingsStatus(`Network Error: ${e.message}`, "red");
      }
    } else {
      if (!backendUrl) {
        this.showSettingsStatus("Enter Backend URL to test.", "red");
        return;
      }
      try {
        const response = await fetch(backendUrl.replace("/api/hint", "/"), {
          method: 'GET'
        });

        if (response.ok) {
          this.showSettingsStatus("Connected to backend server!", "green");
        } else {
          this.showSettingsStatus(`Backend returned status: ${response.status}`, "red");
        }
      } catch (e) {
        this.showSettingsStatus(`Could not reach backend: ${e.message}`, "red");
      }
    }
  }

  formatMarkdown(text) {
    if (!text) return "";
    
    // 1. Extract and format code blocks (to prevent formatting code contents as markdown)
    const codeBlocks = [];
    let tempText = text.replace(/```([a-zA-Z0-9-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      codeBlocks.push(`<pre class="hf-code-block"><code class="language-${lang}">${escapedCode}</code></pre>`);
      return placeholder;
    });

    // 2. Parse inline text styles (bold, italics, inline code)
    tempText = tempText
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="hf-inline-code">$1</code>');

    // Convert line breaks to <br/>
    tempText = tempText.replace(/\n/g, '<br/>');

    // 3. Put code blocks back
    codeBlocks.forEach((blockHtml, index) => {
      tempText = tempText.replace(`__CODE_BLOCK_${index}__`, blockHtml);
    });

    return tempText;
  }

  renderMessages() {
    const logId = `#chat-messages-log-${this.activeTab === 'hints' ? 'hints' : 'interviewer'}`;
    const log = this.shadowRoot.querySelector(logId);
    if (!log) return;
    log.innerHTML = '';
    
    const messages = this.histories[this.activeTab];
    messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `hf-msg ${msg.role === 'model' ? 'model' : 'user'}`;
      
      const isModel = msg.role === 'model';
      const isSystem = msg.text.startsWith('*System:');
      
      const name = isModel ? (this.activeTab === 'interviewer' ? 'Interviewer' : 'AI Tutor') : 'You';
      const avatar = isModel ? '🤖' : '👤';
      
      let formattedText = this.formatMarkdown(msg.text);

      if (isSystem) {
        msgEl.style.alignSelf = 'center';
        msgEl.style.maxWidth = '95%';
        msgEl.style.opacity = '0.8';
        msgEl.innerHTML = `<div style="font-size: 11px; font-style: italic; background: #262626; padding: 8px 14px; border-radius: 8px; border: 1px solid #3c3c3c; color: #ffa116; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">${formattedText.replace(/\*System:\s*/i, '')}</div>`;
      } else {
        msgEl.innerHTML = `
          <div class="hf-msg-header">
            <span class="hf-msg-avatar">${avatar}</span>
            <span class="hf-msg-name">${name}</span>
            <span class="hf-msg-time">${msg.time}</span>
          </div>
          <div class="hf-msg-bubble">${formattedText}</div>
        `;
      }
      log.appendChild(msgEl);
    });

    // Scroll to bottom
    setTimeout(() => {
      log.scrollTop = log.scrollHeight;
    }, 50);
  }

  updateWidgets() {
    const shadow = this.shadowRoot;
    
    // 1. Hint Level Dots
    const dotsContainer = shadow.querySelector('#hint-level-dots-container');
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      const activeLevel = Math.min(5, Math.max(0, this.widgetState.hintLevel));
      
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
    if (hintDesc) hintDesc.textContent = this.widgetState.hintText;

    // 2. Approach list / stats
    const curVal = shadow.querySelector('#approach-current-val');
    if (curVal) curVal.textContent = this.widgetState.currentApproach;
    
    const betVal = shadow.querySelector('#approach-better-val');
    if (betVal) {
      const progressText = this.widgetState.progress > 0 ? ` (${this.widgetState.progress}% Done)` : '';
      betVal.textContent = `${this.widgetState.betterApproach}${progressText}`;
    }
    
    // 3. Complexity boxes
    const timeVal = shadow.querySelector('#complexity-time-val');
    if (timeVal) timeVal.textContent = this.widgetState.timeComplexity;
    
    const spaceVal = shadow.querySelector('#complexity-space-val');
    if (spaceVal) spaceVal.textContent = this.widgetState.spaceComplexity;
    
    const improvBadge = shadow.querySelector('#complexity-improvable-badge');
    if (improvBadge) {
      if (this.widgetState.canImprove) {
        improvBadge.textContent = "Yes ▲";
        improvBadge.className = "hf-complexity-badge hf-badge-red";
      } else {
        improvBadge.textContent = "Optimal";
        improvBadge.className = "hf-complexity-badge hf-badge-green";
      }
    }
  }

  async handleUserSendMessage() {
    const suffix = this.activeTab === 'hints' ? 'hints' : 'interviewer';
    const textInput = this.shadowRoot.querySelector(`#chat-textarea-input-${suffix}`);
    if (!textInput) return;
    
    const userText = textInput.value.trim();
    if (!userText || this.isResponding) return;

    // Clear input
    textInput.value = '';
    
    // Save message to history
    this.histories[this.activeTab].push({
      role: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();

    await this.callAI(userText);
  }

  async triggerQuickAction(actionType, placeholderMessage) {
    if (this.isResponding) return;
    
    // Print placeholder in chat to make it look like a prompt
    this.histories[this.activeTab].push({
      role: 'user',
      text: placeholderMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();

    await this.callAI(placeholderMessage, actionType);
  }

  setResponding(state) {
    this.isResponding = state;
    const suffix = this.activeTab === 'hints' ? 'hints' : 'interviewer';
    
    const sendBtn = this.shadowRoot.querySelector(`#btn-send-message-${suffix}`);
    const indicator = this.shadowRoot.querySelector(`#typing-indicator-${suffix}`);
    
    if (sendBtn) sendBtn.disabled = state;
    if (indicator) indicator.style.display = state ? 'flex' : 'none';
    
    if (state) {
      const log = this.shadowRoot.querySelector(`#chat-messages-log-${suffix}`);
      if (log) {
        setTimeout(() => {
          log.scrollTop = log.scrollHeight;
        }, 50);
      }
    }
  }

  async callAI(userPrompt, action = '') {
    this.setResponding(true);

    // 1. Gather all context
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

    const activeHistory = this.histories[this.activeTab];
    const historyContext = [];
    let expectedRole = 'user';
    for (const msg of activeHistory.slice(0, -1)) {
      if (historyContext.length === 0 && msg.role === 'model') {
        continue;
      }
      const role = msg.role === 'model' ? 'model' : 'user';
      if (role === expectedRole) {
        historyContext.push({
          role,
          parts: [{ text: msg.text }]
        });
        expectedRole = expectedRole === 'user' ? 'model' : 'user';
      }
    }

    // 2. Validate API configuration
    if (this.settings.provider === 'gemini' && !this.settings.geminiApiKey) {
      this.addModelResponse("⚠️ Google AI Studio API Key not configured! Please click on ⚙️ Settings at the bottom and enter your API Key.");
      this.setResponding(false);
      return;
    }

    if (this.settings.provider === 'groq' && !this.settings.groqApiKey) {
      this.addModelResponse("⚠️ Groq API Key not configured! Please click on ⚙️ Settings at the bottom and enter your API Key.");
      this.setResponding(false);
      return;
    }

    try {
      let result = null;
      if (this.settings.provider === 'gemini') {
        result = await this.callGeminiDirect(problemContext, codeState, userPrompt, historyContext, action);
      } else if (this.settings.provider === 'groq') {
        result = await this.callGroqDirect(problemContext, codeState, userPrompt, historyContext, action);
      } else {
        result = await this.callBackendServer(problemContext, codeState, userPrompt, activeHistory.slice(0, -1), action);
      }

      if (result) {
        // Update widgets state
        this.widgetState = {
          progress: result.progress || 0,
          progressDesc: result.progressDesc || "You're making progress!",
          currentApproach: result.currentApproach || 'None',
          betterApproach: result.betterApproach || 'Not analyzed',
          timeComplexity: result.userCodeTimeComplexity || 'N/A',
          spaceComplexity: result.userCodeSpaceComplexity || 'N/A',
          canImprove: result.canImproveComplexity || false,
          hintLevel: result.hintLevel || 0,
          hintText: result.hintText || 'No hints yet.'
        };
        
        // Add chat response
        this.addModelResponse(result.chatMessage);
      } else {
        this.addModelResponse("⚠️ Failed to parse response from AI.");
      }
    } catch (error) {
      console.error(error);
      this.addModelResponse(`❌ Error generating response: ${error.message}`);
    } finally {
      this.setResponding(false);
    }
  }

  addModelResponse(text) {
    this.histories[this.activeTab].push({
      role: 'model',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.renderMessages();
    this.updateWidgets();
  }

  async callGeminiDirect(problem, codeState, userPrompt, history, action) {
    const key = this.settings.geminiApiKey;
    const model = this.settings.geminiModel;
    const persona = this.settings.persona;
    const mode = this.activeTab; // 'interviewer' | 'hints'

    const systemInstruction = `You are HintFlow, a premium mock interviewer and AI coding coach.
Your goal is to guide the user to solve their coding problem without giving direct code solutions.
DO NOT WRITE COMPLETE CODE BLOCKS for the solution. If the user asks for code, guide them conceptually or write small pseudocode snippets instead.

Current Mode: ${mode === 'interviewer' ? 'FAANG Interviewer Mode (Act like an interviewer, ask approach, time/space complexity, edge cases, probe code bugs)' : 'Supportive Coding Tutor Mode (Provide progressive hints, explain concepts)'}
Persona setting: ${persona}

IMPORTANT: You must return your response STRICTLY as a JSON object matching this schema. Do not wrap it in any other text.
{
  "chatMessage": "The text message you say to the user.",
  "progress": 75, // integer 0 to 100 based on user's progress towards optimal solution
  "progressDesc": "Short encouraging progress description",
  "currentApproach": "Description of user's current approach, e.g. Brute Force or Two Pointers",
  "betterApproach": "The next better approach they should aim for, e.g. Binary Search, or 'None (Optimal)'",
  "userCodeTimeComplexity": "Time complexity of user's code, e.g. O(n²)",
  "userCodeSpaceComplexity": "Space complexity of user's code, e.g. O(1)",
  "canImproveComplexity": true, // boolean indicating if complexity can be improved
  "hintLevel": 2, // current hint level from 1 to 5 (increment if they make progress or ask for next hint)
  "hintText": "A short conceptual hint (no code) for their current stage."
}`;

    const promptText = `
PROBLEM CONTEXT:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description: ${problem.description}
Constraints: ${problem.constraints}

USER CODE CONTEXT:
Language: ${codeState.language}
Current Code:
\`\`\`
${codeState.code}
\`\`\`

USER TRIGGER ACTION: ${action ? `User triggered action: ${action}` : 'None'}
USER MESSAGE: ${userPrompt}

Please evaluate the code and conversation, and respond with the required JSON payload.`;

    const contents = [...history, {
      role: 'user',
      parts: [{ text: promptText }]
    }];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
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

  async callBackendServer(problem, codeState, userPrompt, history, action) {
    const url = this.settings.backendUrl;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem,
        codeState,
        userPrompt,
        history,
        action,
        settings: { ...this.settings, mode: this.activeTab }
      })
    });

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  async callGroqDirect(problem, codeState, userPrompt, history, action) {
    const key = this.settings.groqApiKey;
    const model = this.settings.groqModel;
    const persona = this.settings.persona;
    const mode = this.activeTab;

    const systemInstruction = `You are HintFlow, a premium mock interviewer and AI coding coach.
Your goal is to guide the user to solve their coding problem without giving direct code solutions.
DO NOT WRITE COMPLETE CODE BLOCKS for the solution. If the user asks for code, guide them conceptually or write small pseudocode snippets instead.

Current Mode: ${mode === 'interviewer' ? 'FAANG Interviewer Mode (Act like an interviewer, ask approach, time/space complexity, edge cases, probe code bugs)' : 'Supportive Coding Tutor Mode (Provide progressive hints, explain concepts)'}
Persona setting: ${persona}

IMPORTANT: You must return your response STRICTLY as a JSON object matching this schema. Do not wrap it in any other text or markdown blocks (e.g. do not wrap in \`\`\`json).
{
  "chatMessage": "The text message you say to the user.",
  "progress": 75, // integer 0 to 100 based on user's progress towards optimal solution
  "progressDesc": "Short encouraging progress description",
  "currentApproach": "Description of user's current approach, e.g. Brute Force or Two Pointers",
  "betterApproach": "The next better approach they should aim for, e.g. Binary Search, or 'None (Optimal)'",
  "userCodeTimeComplexity": "Time complexity of user's code, e.g. O(n²)",
  "userCodeSpaceComplexity": "Space complexity of user's code, e.g. O(1)",
  "canImproveComplexity": true, // boolean indicating if complexity can be improved
  "hintLevel": 2, // current hint level from 1 to 5
  "hintText": "A short conceptual hint (no code) for their current stage."
}`;

    const promptText = `
PROBLEM CONTEXT:
Title: ${problem.title}
Difficulty: ${problem.difficulty}
Description: ${problem.description}
Constraints: ${problem.constraints}

USER CODE CONTEXT:
Language: ${codeState.language}
Current Code:
\`\`\`
${codeState.code}
\`\`\`

USER TRIGGER ACTION: ${action ? `User triggered action: ${action}` : 'None'}
USER MESSAGE: ${userPrompt}

Please evaluate the code and conversation, and respond with the required JSON payload.`;

    const messages = [
      { role: 'system', content: systemInstruction }
    ];

    for (const msg of history) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts[0].text
      });
    }

    messages.push({
      role: 'user',
      content: promptText
    });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || response.statusText);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new Error("Empty response from Groq API");
    }

    return JSON.parse(responseText);
  }
}

// Expose class globally
window.HintFlowSidebar = HintFlowSidebar;
