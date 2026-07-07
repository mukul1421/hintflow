class HintFlowSidebar {
  constructor(container, parser) {
    this.container = container;
    this.parser = parser;
    this.shadowRoot = container.attachShadow({ mode: 'open' });
    
    // UI state
    this.isOpen = false;
    this.activeTab = 'interviewer'; // 'interviewer' | 'hints' | 'review' | 'insights'
    this.currentCode = "";
    this.currentLanguage = "";
    this.isResponding = false;
    
    // Conversation histories
    this.histories = {
      interviewer: [],
      hints: [],
      review: [],
      insights: []
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
    } else {
      welcome = "Hi! Let me know what you want to review or analyze.";
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
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        :host {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #e2e8f0;
          box-sizing: border-box;
        }

        * {
          box-sizing: border-box;
          scrollbar-width: thin;
          scrollbar-color: #334155 #0f172a;
        }

        /* Floating Toggle Button */
        .hf-floating-toggle {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 2147483647;
          border: 1px solid rgba(255,255,255,0.1);
        }
        
        .hf-floating-toggle:hover {
          transform: scale(1.08) rotate(15deg);
          box-shadow: 0 12px 35px rgba(99, 102, 241, 0.6);
        }

        .hf-floating-toggle.hidden {
          transform: scale(0) rotate(-90deg);
          opacity: 0;
          pointer-events: none;
        }

        /* Sidebar Wrapper */
        .hf-sidebar-wrapper {
          position: fixed;
          top: 0;
          right: -480px;
          width: 480px;
          height: 100vh;
          background: #090d16;
          border-left: 1px solid rgba(99, 102, 241, 0.2);
          box-shadow: -12px 0 45px rgba(0, 0, 0, 0.7);
          transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2147483646;
          display: flex;
          flex-direction: column;
        }

        .hf-sidebar-wrapper.open {
          right: 0;
        }

        /* Inner Layout: Split Pane */
        .hf-sidebar-main {
          flex: 1;
          display: flex;
          overflow: hidden;
          height: calc(100vh - 60px);
        }

        /* Left Column: Chat Container */
        .hf-chat-container {
          width: 58%;
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          background: #06090f;
        }

        /* Right Column: Widgets / Stats */
        .hf-widgets-container {
          width: 42%;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          background: #090d16;
          padding: 14px;
          gap: 14px;
        }

        /* Header Styles */
        .hf-sidebar-header {
          height: 60px;
          background: #0d121f;
          border-bottom: 1px solid rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          flex-shrink: 0;
        }

        .hf-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 16px;
          background: linear-gradient(135deg, #a5b4fc, #818cf8, #6366f1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hf-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hf-btn-close {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 18px;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .hf-btn-close:hover {
          color: white;
          background: rgba(255,255,255,0.06);
        }

        /* Mode / Tab Bar */
        .hf-tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 8px;
          background: #0b0f19;
          gap: 4px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }

        .hf-tab-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6px 2px;
          background: transparent;
          border: none;
          color: #475569;
          font-family: inherit;
          font-weight: 600;
          font-size: 10px;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
          text-align: center;
          gap: 3px;
        }

        .hf-tab-icon {
          font-size: 14px;
        }

        .hf-tab-btn.active {
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.2);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.05);
        }

        .hf-tab-btn:hover:not(.active) {
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.03);
        }

        /* Chat Messages List */
        .hf-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .hf-msg {
          display: flex;
          flex-direction: column;
          max-width: 90%;
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
          color: #475569;
          margin-bottom: 4px;
          padding: 0 4px;
        }

        .hf-msg.user .hf-msg-header {
          justify-content: flex-end;
        }

        .hf-msg-avatar {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #818cf8;
          font-size: 11px;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .hf-msg.user .hf-msg-avatar {
          background: rgba(16, 185, 129, 0.2);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.2);
          order: 2;
        }

        .hf-msg-bubble {
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .hf-msg.model .hf-msg-bubble {
          background: #151d30;
          color: #e2e8f0;
          border-top-left-radius: 2px;
          border: 1px solid rgba(255,255,255,0.03);
        }

        .hf-msg.user .hf-msg-bubble {
          background: #25225c;
          color: #f1f5f9;
          border-top-right-radius: 2px;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .hf-typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          background: #151d30;
          border-radius: 12px;
          border-top-left-radius: 2px;
          align-self: flex-start;
          margin-bottom: 8px;
          border: 1px solid rgba(255,255,255,0.03);
        }

        .hf-typing-dot {
          width: 6px;
          height: 6px;
          background: #818cf8;
          border-radius: 50%;
          animation: hf-bounce 1.4s infinite ease-in-out both;
        }

        .hf-typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .hf-typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes hf-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }

        /* Input Panel */
        .hf-chat-input-area {
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.04);
          background: #0b0f19;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hf-input-field {
          flex: 1;
          background: #111625;
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px;
          padding: 10px 12px;
          color: white;
          font-family: inherit;
          font-size: 13px;
          resize: none;
          height: 40px;
          outline: none;
          transition: all 0.2s;
        }

        .hf-input-field:focus {
          border-color: #6366f1;
          background: #151c30;
          box-shadow: 0 0 10px rgba(99,102,241,0.15);
        }

        .hf-btn-send {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          font-size: 16px;
        }

        .hf-btn-send:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .hf-btn-send:disabled {
          background: #1e293b;
          color: #475569;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        /* Widgets Styling */
        .hf-widget-card {
          background: #101626;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }

        .hf-widget-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #475569;
          font-weight: 700;
          margin-bottom: 8px;
        }

        /* Progress Circle widget */
        .hf-progress-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .hf-circular-chart {
          width: 56px;
          height: 56px;
        }

        .hf-circle-bg {
          fill: none;
          stroke: #1e293b;
          stroke-width: 3.2;
        }

        .hf-circle {
          fill: none;
          stroke-width: 3.2;
          stroke-linecap: round;
          stroke: url(#hf-progress-gradient);
          transition: stroke-dasharray 0.5s ease;
        }

        .hf-percentage {
          fill: #fff;
          font-size: 8px;
          text-anchor: middle;
          font-weight: 700;
          font-family: inherit;
        }

        .hf-progress-text {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
          flex: 1;
        }

        /* Approach widget */
        .hf-approach-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .hf-approach-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          background: rgba(255,255,255,0.01);
          padding: 6px 8px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.02);
        }

        .hf-approach-name {
          font-weight: 600;
          color: #cbd5e1;
        }

        .hf-complexity-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 4px;
        }

        .hf-badge-red { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
        .hf-badge-green { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
        .hf-badge-grey { background: rgba(100, 116, 139, 0.12); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.2); }

        /* Hint Level Widget */
        .hf-hint-level-dots {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
        }

        .hf-hint-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #182235;
          border: 1px solid rgba(255,255,255,0.03);
          transition: all 0.3s;
        }

        .hf-hint-dot.active {
          background: #6366f1;
          box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
        }

        .hf-hint-text-desc {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .hf-btn-next-hint {
          background: linear-gradient(135deg, #4f46e5, #4338ca);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          text-align: center;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .hf-btn-next-hint:hover {
          background: #6366f1;
          transform: translateY(-1px);
        }

        /* Complexity Check Widget */
        .hf-complexity-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 8px;
        }

        .hf-comp-box {
          background: rgba(255,255,255,0.01);
          padding: 6px;
          border-radius: 6px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.02);
        }

        .hf-comp-label {
          font-size: 9px;
          color: #475569;
          margin-bottom: 2px;
        }

        .hf-comp-val {
          font-size: 11px;
          font-weight: 700;
        }

        .hf-improvable-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #64748b;
          padding-top: 4px;
          border-top: 1px solid rgba(255,255,255,0.03);
        }

        /* Quick Action Buttons Grid */
        .hf-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .hf-action-btn {
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          padding: 8px 6px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .hf-action-btn:hover {
          background: #1e293b;
          border-color: rgba(99, 102, 241, 0.3);
          color: white;
          transform: translateY(-1px);
        }

        .hf-action-btn.full-width {
          grid-column: span 2;
          justify-content: center;
        }

        /* Bottom Menu Footer */
        .hf-sidebar-footer {
          height: 48px;
          border-top: 1px solid rgba(255,255,255,0.05);
          background: #0d121f;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 0 16px;
          flex-shrink: 0;
        }

        .hf-footer-item {
          font-size: 10px;
          color: #475569;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          transition: color 0.2s;
        }

        .hf-footer-item:hover, .hf-footer-item.active {
          color: #818cf8;
        }

        /* Settings Overlay Modal */
        .hf-settings-overlay {
          position: absolute;
          inset: 0;
          background: #080c14;
          z-index: 100;
          display: flex;
          flex-direction: column;
          padding: 20px;
          transform: translateY(100%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hf-settings-overlay.open {
          transform: translateY(0);
        }

        .hf-settings-title {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 16px;
          color: white;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          padding-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .hf-settings-form {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }

        .hf-form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hf-form-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }

        .hf-form-input, .hf-form-select {
          background: #111625;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 8px 10px;
          color: white;
          font-family: inherit;
          font-size: 12px;
          outline: none;
        }

        .hf-form-input:focus, .hf-form-select:focus {
          border-color: #6366f1;
          background: #141c2f;
        }

        .hf-settings-footer {
          margin-top: 16px;
          display: flex;
          gap: 8px;
        }

        .hf-btn-save {
          flex: 1;
          background: linear-gradient(135deg, #4f46e5, #3730a3);
          border: none;
          color: white;
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }

        .hf-btn-save:hover {
          background: #6366f1;
        }

        .hf-btn-test {
          background: #1f2937;
          border: 1px solid rgba(255,255,255,0.05);
          color: #cbd5e1;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hf-btn-test:hover {
          background: #374151;
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
            <stop offset="0%" stop-color="#fbbf24" />
            <stop offset="50%" stop-color="#34d399" />
            <stop offset="100%" stop-color="#6366f1" />
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
            <span>🤖</span> HintFlow AI Mentor
          </div>
          <div class="hf-header-actions">
            <button class="hf-btn-close" id="close-sidebar-btn" title="Close Sidebar">✕</button>
          </div>
        </div>

        <!-- Sidebar Body Split Layout -->
        <div class="hf-sidebar-main">
          <!-- Left Column: Chat Area -->
          <div class="hf-chat-container">
            <!-- Tabs Bar -->
            <div class="hf-tabs">
              <button class="hf-tab-btn active" data-tab="interviewer">
                <span class="hf-tab-icon">👤</span>
                <span>Interviewer</span>
              </button>
              <button class="hf-tab-btn" data-tab="hints">
                <span class="hf-tab-icon">💡</span>
                <span>Hints</span>
              </button>
              <button class="hf-tab-btn" data-tab="review">
                <span class="hf-tab-icon">🔍</span>
                <span>Review</span>
              </button>
              <button class="hf-tab-btn" data-tab="insights">
                <span class="hf-tab-icon">✨</span>
                <span>Insights</span>
              </button>
            </div>

            <!-- Messages Log -->
            <div class="hf-chat-messages" id="chat-messages-log">
              <!-- Messages will be rendered here dynamically -->
            </div>

            <!-- Typing indicator -->
            <div class="hf-typing-indicator" style="display: none;" id="typing-indicator">
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
              <span class="hf-typing-dot"></span>
            </div>

            <!-- Input area -->
            <div class="hf-chat-input-area">
              <textarea class="hf-input-field" placeholder="Type your response here..." id="chat-textarea-input"></textarea>
              <button class="hf-btn-send" id="btn-send-message" title="Send Message">➤</button>
            </div>
          </div>

          <!-- Right Column: Stats Panel -->
          <div class="hf-widgets-container">
            <!-- Progress Ring Widget -->
            <div class="hf-widget-card">
              <div class="hf-widget-title">Progress</div>
              <div class="hf-progress-content">
                <svg viewBox="0 0 36 36" class="hf-circular-chart">
                  <path class="hf-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path class="hf-circle" id="progress-svg-ring" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <text x="18" y="20.35" class="hf-percentage" id="progress-text-val">0%</text>
                </svg>
                <div class="hf-progress-text" id="progress-text-desc">Start solving the problem to analyze your progress.</div>
              </div>
            </div>

            <!-- Approach Widget -->
            <div class="hf-widget-card">
              <div class="hf-widget-title">Approach</div>
              <div class="hf-approach-list">
                <div class="hf-approach-item">
                  <span class="hf-approach-name" id="approach-current-val">Brute Force (Current)</span>
                  <span class="hf-complexity-badge hf-badge-red" id="approach-current-complexity">O(n²)</span>
                </div>
                <div class="hf-approach-item">
                  <span class="hf-approach-name" id="approach-better-val">Better Approach</span>
                  <span class="hf-complexity-badge hf-badge-green" id="approach-better-complexity">O(n)</span>
                </div>
              </div>
            </div>

            <!-- Hint Level Widget -->
            <div class="hf-widget-card">
              <div class="hf-widget-title">Hint Level</div>
              <div class="hf-hint-level-dots" id="hint-level-dots-container">
                <span class="hf-hint-dot"></span>
                <span class="hf-hint-dot"></span>
                <span class="hf-hint-dot"></span>
                <span class="hf-hint-dot"></span>
                <span class="hf-hint-dot"></span>
              </div>
              <div class="hf-hint-text-desc" id="hint-level-desc-text">
                Think about storing information from numbers you've already seen.
              </div>
              <button class="hf-btn-next-hint" id="btn-request-next-hint">Next Hint</button>
            </div>

            <!-- Complexity check widget -->
            <div class="hf-widget-card">
              <div class="hf-widget-title">Complexity (Your Code)</div>
              <div class="hf-complexity-grid">
                <div class="hf-comp-box">
                  <div class="hf-comp-label">Time</div>
                  <div class="hf-comp-val" id="complexity-time-val">-</div>
                </div>
                <div class="hf-comp-box">
                  <div class="hf-comp-label">Space</div>
                  <div class="hf-comp-val" id="complexity-space-val">-</div>
                </div>
              </div>
              <div class="hf-improvable-row">
                <span>Can be improved?</span>
                <span id="complexity-improvable-badge" class="hf-complexity-badge hf-badge-grey">N/A</span>
              </div>
            </div>

            <!-- Quick Action Grid -->
            <div class="hf-actions-grid">
              <button class="hf-action-btn" data-action="stuck">😢 I'm Stuck</button>
              <button class="hf-action-btn" data-action="wrong">🐞 Code is Wrong</button>
              <button class="hf-action-btn" data-action="optimize">🚀 Optimize</button>
              <button class="hf-action-btn" data-action="error">⚠️ Explain Error</button>
              <button class="hf-action-btn" data-action="edge">🛡️ Edge Cases</button>
              <button class="hf-action-btn" data-action="dryrun">🎬 Dry Run</button>
              <button class="hf-action-btn full-width" data-action="ask">💬 Ask Anything</button>
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
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                You can get your free API key from Google AI Studio. It is stored securely in your browser and never leaves your machine.
              </div>
            </div>

            <div class="hf-form-group" id="settings-gemini-model-group">
              <label class="hf-form-label">Gemini Model</label>
              <select class="hf-form-select" id="settings-gemini-model-select">
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Advanced)</option>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - Fast)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Thorough)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </select>
            </div>

            <div class="hf-form-group" id="settings-groq-key-group">
              <label class="hf-form-label">Groq API Key</label>
              <input type="password" class="hf-form-input" placeholder="gsk_..." id="settings-groq-key-input" />
              <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                Get your free API key from console.groq.com. It is stored securely in your browser and never leaves your machine.
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

    // Send message on Enter or Click
    const textInput = shadow.querySelector('#chat-textarea-input');
    const sendBtn = shadow.querySelector('#btn-send-message');
    
    sendBtn.addEventListener('click', () => this.handleUserSendMessage());
    textInput.addEventListener('keydown', (e) => {
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
          textInput.focus();
        }
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
  }

  switchTab(tab) {
    if (this.activeTab === tab) return;
    
    this.shadowRoot.querySelectorAll('.hf-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
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

  renderMessages() {
    const log = this.shadowRoot.querySelector('#chat-messages-log');
    log.innerHTML = '';
    
    const messages = this.histories[this.activeTab];
    messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.className = `hf-msg ${msg.role === 'model' ? 'model' : 'user'}`;
      
      const isModel = msg.role === 'model';
      const name = isModel ? (this.activeTab === 'interviewer' ? 'Interviewer' : 'AI Tutor') : 'You';
      const avatar = isModel ? '🤖' : '👤';
      
      // Basic markdown replacement for paragraphs and bold/italics
      let formattedText = msg.text
        .replace(/\n/g, '<br/>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 4px; border-radius: 4px;">$1</code>');

      msgEl.innerHTML = `
        <div class="hf-msg-header">
          <span class="hf-msg-avatar">${avatar}</span>
          <span class="hf-msg-name">${name}</span>
          <span class="hf-msg-time">${msg.time}</span>
        </div>
        <div class="hf-msg-bubble">${formattedText}</div>
      `;
      log.appendChild(msgEl);
    });

    // Scroll to bottom
    setTimeout(() => {
      log.scrollTop = log.scrollHeight;
    }, 50);
  }

  updateWidgets() {
    const shadow = this.shadowRoot;
    
    // 1. Progress circle
    const progressRing = shadow.querySelector('#progress-svg-ring');
    const progressText = shadow.querySelector('#progress-text-val');
    const progressDesc = shadow.querySelector('#progress-text-desc');
    
    const percent = Math.min(100, Math.max(0, this.widgetState.progress));
    progressRing.style.strokeDasharray = `${percent}, 100`;
    progressText.textContent = `${percent}%`;
    progressDesc.textContent = this.widgetState.progressDesc || "You're making progress!";

    // 2. Approach list
    shadow.querySelector('#approach-current-val').textContent = this.widgetState.currentApproach;
    shadow.querySelector('#approach-better-val').textContent = this.widgetState.betterApproach;
    
    // Match complexity classes
    const curComp = shadow.querySelector('#approach-current-complexity');
    curComp.textContent = this.widgetState.timeComplexity;
    if (this.widgetState.timeComplexity.includes('n²')) {
      curComp.className = "hf-complexity-badge hf-badge-red";
    } else if (this.widgetState.timeComplexity.includes('n log') || this.widgetState.timeComplexity.includes('n')) {
      curComp.className = "hf-complexity-badge hf-badge-green";
    } else {
      curComp.className = "hf-complexity-badge hf-badge-grey";
    }

    const betComp = shadow.querySelector('#approach-better-complexity');
    if (this.widgetState.betterApproach.toLowerCase().includes('optimal') || this.widgetState.betterApproach.toLowerCase().includes('none')) {
      betComp.textContent = 'Optimal';
      betComp.className = "hf-complexity-badge hf-badge-green";
    } else {
      betComp.textContent = 'Faster';
      betComp.className = "hf-complexity-badge hf-badge-grey";
    }

    // 3. Hint Level Dots
    const dotsContainer = shadow.querySelector('#hint-level-dots-container');
    dotsContainer.innerHTML = '';
    const activeLevel = Math.min(5, Math.max(0, this.widgetState.hintLevel));
    
    for (let i = 1; i <= 5; i++) {
      const dot = document.createElement('span');
      dot.className = `hf-hint-dot ${i <= activeLevel ? 'active' : ''}`;
      dotsContainer.appendChild(dot);
    }
    
    shadow.querySelector('#hint-level-desc-text').textContent = this.widgetState.hintText;

    // 4. Complexity boxes
    shadow.querySelector('#complexity-time-val').textContent = this.widgetState.timeComplexity;
    shadow.querySelector('#complexity-space-val').textContent = this.widgetState.spaceComplexity;
    
    const improvBadge = shadow.querySelector('#complexity-improvable-badge');
    if (this.widgetState.canImprove) {
      improvBadge.textContent = "Yes ▲";
      improvBadge.className = "hf-complexity-badge hf-badge-red";
    } else {
      improvBadge.textContent = "Optimal";
      improvBadge.className = "hf-complexity-badge hf-badge-green";
    }
  }

  async handleUserSendMessage() {
    const textInput = this.shadowRoot.querySelector('#chat-textarea-input');
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
    const sendBtn = this.shadowRoot.querySelector('#btn-send-message');
    const indicator = this.shadowRoot.querySelector('#typing-indicator');
    
    if (state) {
      sendBtn.disabled = true;
      indicator.style.display = 'flex';
      // scroll to bottom
      const log = this.shadowRoot.querySelector('#chat-messages-log');
      log.scrollTop = log.scrollHeight;
    } else {
      sendBtn.disabled = false;
      indicator.style.display = 'none';
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
    // Map history to standard Gemini chat structure (role: 'user' | 'model')
    // Exclude the last message which is the current userPrompt
    // Filter history to ensure it strictly starts with 'user' and alternates roles
    const historyContext = [];
    let expectedRole = 'user';
    for (const msg of activeHistory.slice(0, -1)) {
      if (historyContext.length === 0 && msg.role === 'model') {
        continue; // Skip initial welcome message from model to satisfy Gemini requirements
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
    const mode = this.activeTab; // 'interviewer' | 'hints' | 'review' | 'insights'

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
        settings: this.settings
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

    // Map history to standard OpenAI roles ('user' or 'assistant')
    // Exclude the welcome message which has role 'model'
    const messages = [
      { role: 'system', content: systemInstruction }
    ];

    for (const msg of history) {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.parts[0].text
      });
    }

    // Append current prompt
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
