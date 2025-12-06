/**
 * Chat Panel Component
 * Injected into all web pages to provide an AI chat interface
 * Allows users to ask questions with selected text or full page context
 */

class ChatPanel {
  constructor() {
    this.isOpen = false;
    this.panelElement = null;
    this.messagesContainer = null;
    this.inputField = null;
    this.isWaitingForResponse = false;
    this.savedSelection = ''; // preserve user selection across panel open
    this._isDragging = false;
    this.customHeight = null; // user-defined height in px
    this.COLLAPSED_HEIGHT = 48; // px
    this.MAX_VH = 0.9; // 90% of viewport
  }

  /**
   * Initialize and inject the chat panel into the page
   */
  init() {
    if (document.getElementById('ai-chat-panel-container')) {
      return; // Already injected
    }

    this.createPanelHTML();
    // Load saved custom height (if any)
    try {
      const saved = localStorage.getItem('aiChatCustomHeight');
      if (saved) {
        const h = parseFloat(saved);
        if (!Number.isNaN(h) && h > this.COLLAPSED_HEIGHT) {
          this.customHeight = h;
        }
      }
    } catch (e) {
      this.customHeight = null;
    }
    this.attachEventListeners();
    this.setupStyles();
    // Sync toggle icon with initial state
    this.updateToggleIconState();
  }

  /**
   * Create the panel HTML structure
   */
  createPanelHTML() {
    const container = document.createElement('div');
    container.id = 'ai-chat-panel-container';
    container.innerHTML = `
      <div id="ai-chat-panel" class="ai-chat-panel ai-chat-panel-closed">
        <div class="ai-chat-header">
          <h3>Chat with AI</h3>
          <button id="ai-chat-toggle" class="ai-chat-toggle-btn" title="Toggle chat panel">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 18l1.41-5.02C2.24 11.36 2 10.7 2 10c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.28 0-2.5-.32-3.56-.93L2 18z" fill="currentColor"/>
            </svg>
          </button>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages"></div>
        <div class="ai-chat-input-group">
          <input 
            type="text" 
            id="ai-chat-input" 
            placeholder="Ask something..." 
            class="ai-chat-input"
          />
          <button id="ai-chat-send-btn" class="ai-chat-send-btn" title="Send question">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
          <button id="ai-chat-screenshot-btn" class="ai-chat-screenshot-btn" title="Attach screenshot">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>
        </div>
        <div class="ai-chat-footer">
          <small>Configured API</small>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    this.panelElement = document.getElementById('ai-chat-panel');
    this.messagesContainer = document.getElementById('ai-chat-messages');
    this.inputField = document.getElementById('ai-chat-input');
  }

  /**
   * Attach event listeners to interactive elements
   */
  attachEventListeners() {
    // Toggle panel open/close — capture selection before focusing input so selection isn't lost
    document.getElementById('ai-chat-toggle').addEventListener('click', (e) => {
      try {
        const sel = window.getSelection().toString();
        if (sel && sel.length > 0) this.savedSelection = sel;
      } catch (err) {
        // ignore
      }
      this.togglePanel();
    });

    // Send button
    document.getElementById('ai-chat-send-btn').addEventListener('click', () => {
      this.handleSendMessage();
    });

    // Enter key to send
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isWaitingForResponse) {
        this.handleSendMessage();
      }
    });

    // Screenshot button
    document.getElementById('ai-chat-screenshot-btn').addEventListener('click', () => {
      this.handleScreenshot();
    });

    // Drag-to-resize via header (mouse + touch)
    const header = this.panelElement.querySelector('.ai-chat-header');
    let startY = 0;
    let startHeight = 0;

    const onPointerMove = (clientY) => {
      if (!this._isDragging) return;
      const dy = startY - clientY; // dragging up increases height
      const newHeight = Math.min(window.innerHeight * 0.95, Math.max(40, startHeight + dy));
      this.panelElement.style.transition = 'height 0s';
      this.panelElement.style.height = `${newHeight}px`;
    };

    header.addEventListener('mousedown', (ev) => {
      this._isDragging = true;
      startY = ev.clientY;
      startHeight = this.panelElement.offsetHeight;
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (ev) => {
      onPointerMove(ev.clientY);
    });

    document.addEventListener('mouseup', () => {
      if (this._isDragging) {
        this._isDragging = false;
        // Save custom height if user resized larger than collapsed
        const finalH = this.panelElement.offsetHeight;
        if (finalH > this.COLLAPSED_HEIGHT + 4) {
          this.customHeight = finalH;
          try { localStorage.setItem('aiChatCustomHeight', String(this.customHeight)); } catch (e) {}
          this.panelElement.classList.add('ai-chat-panel-custom');
          this.panelElement.classList.remove('ai-chat-panel-open');
          this.panelElement.classList.remove('ai-chat-panel-closed');
        }
        this.panelElement.style.transition = '';
        document.body.style.userSelect = '';
        this.updateToggleIconState();
      }
    });

    // touch support
    header.addEventListener('touchstart', (ev) => {
      this._isDragging = true;
      startY = ev.touches[0].clientY;
      startHeight = this.panelElement.offsetHeight;
      document.body.style.userSelect = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (ev) => {
      if (!this._isDragging) return;
      onPointerMove(ev.touches[0].clientY);
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (this._isDragging) {
        this._isDragging = false;
        const finalH = this.panelElement.offsetHeight;
        if (finalH > this.COLLAPSED_HEIGHT + 4) {
          this.customHeight = finalH;
          try { localStorage.setItem('aiChatCustomHeight', String(this.customHeight)); } catch (e) {}
          this.panelElement.classList.add('ai-chat-panel-custom');
          this.panelElement.classList.remove('ai-chat-panel-open');
          this.panelElement.classList.remove('ai-chat-panel-closed');
        }
        this.panelElement.style.transition = '';
        this.updateToggleIconState();
        document.body.style.userSelect = '';
      }
    });
  }

  /**
   * Setup dynamic CSS styles for the chat panel
   */
  setupStyles() {
    if (document.getElementById('ai-chat-panel-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'ai-chat-panel-styles';
    style.textContent = `
      /* Full-width bottom bar. Closed = small bar, Open = taller panel */
      #ai-chat-panel-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: auto;
        pointer-events: none;
        z-index: 999998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      .ai-chat-panel {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 48px; /* collapsed height */
        max-height: 95vh;
        background: white;
        border-radius: 12px 12px 0 0;
        box-shadow: 0 -2px 16px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        transition: height 0.25s ease-out;
        overflow: hidden;
        z-index: 999999;
      }

      .ai-chat-panel.ai-chat-panel-open {
        height: 50vh; /* open height */
      }

      .ai-chat-panel.ai-chat-panel-closed {
        height: 48px; /* collapsed bar */
      }

      .ai-chat-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        background: #f5f5f5;
        border-radius: 12px 12px 0 0;
      }

      .ai-chat-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .ai-chat-toggle-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .ai-chat-toggle-btn:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #1a1a1a;
      }

      .ai-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ai-chat-message {
        display: flex;
        gap: 8px;
        margin-bottom: 4px;
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .ai-chat-message.user {
        justify-content: flex-end;
      }

      .ai-chat-message-content {
        max-width: 85%;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
        white-space: pre-wrap;
      }

      .ai-chat-message.user .ai-chat-message-content {
        background: #007bff;
        color: white;
        border-bottom-right-radius: 2px;
      }

      .ai-chat-message.assistant .ai-chat-message-content {
        background: #e9ecef;
        color: #1a1a1a;
        border-bottom-left-radius: 2px;
      }

      .ai-chat-input-group {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid #e0e0e0;
        background: #fafafa;
      }

      .ai-chat-input {
        flex: 1;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 14px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s;
      }

      .ai-chat-input:focus {
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
      }

      .ai-chat-input:disabled {
        background: #f0f0f0;
        color: #999;
        cursor: not-allowed;
      }

      .ai-chat-send-btn,
      .ai-chat-screenshot-btn {
        background: #007bff;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        font-size: 0;
      }

      .ai-chat-send-btn:hover:not(:disabled),
      .ai-chat-screenshot-btn:hover:not(:disabled) {
        background: #0056b3;
        transform: translateY(-1px);
      }

      .ai-chat-send-btn:disabled,
      .ai-chat-screenshot-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .ai-chat-screenshot-btn {
        background: #6c757d;
      }

      .ai-chat-screenshot-btn:hover:not(:disabled) {
        background: #5a6268;
      }

      .ai-chat-footer {
        padding: 8px 12px;
        border-top: 1px solid #e0e0e0;
        font-size: 12px;
        color: #666;
        background: #fafafa;
        text-align: center;
        border-radius: 0 0 12px 12px;
      }

      .ai-chat-typing-indicator {
        display: flex;
        gap: 4px;
        align-items: flex-end;
      }

      .ai-chat-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #999;
        animation: typing 0.6s infinite;
      }

      .ai-chat-typing-dot:nth-child(1) {
        animation-delay: 0s;
      }

      .ai-chat-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .ai-chat-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% {
          transform: translateY(0);
        }
        30% {
          transform: translateY(-8px);
        }
      }

      /* Scrollbar styling */
      .ai-chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .ai-chat-messages::-webkit-scrollbar-track {
        background: #f1f1f1;
      }

      .ai-chat-messages::-webkit-scrollbar-thumb {
        background: #bbb;
        border-radius: 3px;
      }

      .ai-chat-messages::-webkit-scrollbar-thumb:hover {
        background: #888;
      }

      @media (max-width: 480px) {
        .ai-chat-panel.ai-chat-panel-open {
          height: 60vh;
          border-radius: 16px 16px 0 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Toggle panel open/closed state
   */
  togglePanel() {
    // Determine current visual state
    const isCollapsed = this.panelElement.classList.contains('ai-chat-panel-closed') || this.panelElement.offsetHeight <= this.COLLAPSED_HEIGHT + 2;
    const isMax = this.panelElement.classList.contains('ai-chat-panel-open') && this.panelElement.offsetHeight >= window.innerHeight * this.MAX_VH - 2;
    const isCustom = this.panelElement.classList.contains('ai-chat-panel-custom') || (this.customHeight && !isCollapsed && !isMax);

    if (isCollapsed) {
      // Expand: prefer custom height if available, otherwise max
      if (this.customHeight && this.customHeight > this.COLLAPSED_HEIGHT) {
        this.panelElement.classList.remove('ai-chat-panel-closed');
        this.panelElement.classList.remove('ai-chat-panel-open');
        this.panelElement.classList.add('ai-chat-panel-custom');
        this.panelElement.style.height = `${this.customHeight}px`;
      } else {
        this.panelElement.classList.remove('ai-chat-panel-closed');
        this.panelElement.classList.add('ai-chat-panel-open');
        this.panelElement.classList.remove('ai-chat-panel-custom');
        this.panelElement.style.height = `${Math.floor(window.innerHeight * this.MAX_VH)}px`;
      }
      this.isOpen = true;
      setTimeout(() => { this.inputField.focus(); }, 120);
    } else {
      // Collapse to small bar
      this.panelElement.classList.remove('ai-chat-panel-open');
      this.panelElement.classList.remove('ai-chat-panel-custom');
      this.panelElement.classList.add('ai-chat-panel-closed');
      this.panelElement.style.height = `${this.COLLAPSED_HEIGHT}px`;
      this.isOpen = false;
    }

    this.updateToggleIconState();
  }

  /**
   * Update toggle button icon based on current panel state
   */
  updateToggleIconState() {
    const btn = document.getElementById('ai-chat-toggle');
    if (!btn) return;
    const isCollapsed = this.panelElement.classList.contains('ai-chat-panel-closed') || this.panelElement.offsetHeight <= this.COLLAPSED_HEIGHT + 2;
    const isMax = this.panelElement.classList.contains('ai-chat-panel-open') && this.panelElement.offsetHeight >= window.innerHeight * this.MAX_VH - 2;
    const isCustom = this.panelElement.classList.contains('ai-chat-panel-custom') || (this.customHeight && !isCollapsed && !isMax);

    if (isCollapsed) {
      // show expand icon (chevron up)
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 12l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.title = 'Open panel';
    } else {
      // show collapse icon (chevron down)
      btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      btn.title = isMax ? 'Collapse panel (was maximized)' : 'Collapse panel';
    }
  }

  /**
   * Open panel (set to open state)
   */
  openPanel() {
    if (!this.isOpen) {
      this.togglePanel();
    }
  }

  /**
   * Handle sending a message
   */
  async handleSendMessage() {
    const question = this.inputField.value.trim();
    if (!question || this.isWaitingForResponse) return;

    // Get selected text or all text
    let context = '';
    // Prefer the saved selection (captured before opening) to avoid losing selection on focus
    const selectedText = (this.savedSelection && this.savedSelection.length > 0) ? this.savedSelection : window.getSelection().toString();

    if (selectedText) {
      context = selectedText;
      // clear saved selection after using it
      this.savedSelection = '';
    } else {
      // Get all visible text from page
      const bodyClone = document.body.cloneNode(true);
      const scripts = bodyClone.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());
      const allText = bodyClone.innerText || bodyClone.textContent || '';
      context = allText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .substring(0, 3000); // Limit to 3000 chars to avoid huge requests
    }

    // Add user message to chat
    this.addMessage('user', question);
    this.inputField.value = '';
    this.inputField.disabled = true;
    this.isWaitingForResponse = true;

    // Show typing indicator
    this.showTypingIndicator();

    // Send to background script
    try {
      chrome.runtime.sendMessage({
        action: 'send-chat-message',
        question: question,
        context: context,
        dataType: selectedText ? 'selected_text_with_question' : 'all_text_with_question',
        pageUrl: window.location.href,
        pageTitle: document.title
      }, (response) => {
        this.removeTypingIndicator();

        if (!response) {
          this.addMessage('assistant', 'Error: No response from extension.');
          this.inputField.disabled = false;
          this.isWaitingForResponse = false;
          return;
        }

        if (response.success && response.data) {
          // If background returned assembled streaming text, use it; otherwise fall back
          const text = response.data.assembled || response.data.response || response.data.result || JSON.stringify(response.data);
          this.addMessage('assistant', text);
        } else {
          this.addMessage('assistant', `Error: ${response.error || 'Unknown error'}`);
        }

        this.inputField.disabled = false;
        this.isWaitingForResponse = false;
      });
    } catch (error) {
      this.removeTypingIndicator();
      this.addMessage('assistant', `Error: ${error.message}`);
      this.inputField.disabled = false;
      this.isWaitingForResponse = false;
    }
  }

  /**
   * Handle screenshot capture and send
   */
  async handleScreenshot() {
    if (this.isWaitingForResponse) return;

    this.isWaitingForResponse = true;
    document.getElementById('ai-chat-screenshot-btn').disabled = true;

    try {
      chrome.runtime.sendMessage({
        action: 'capture-screenshot'
      }, (response) => {
        document.getElementById('ai-chat-screenshot-btn').disabled = false;

        if (!response) {
          this.addMessage('assistant', 'Error: Could not capture screenshot.');
          this.isWaitingForResponse = false;
          return;
        }

        if (response.success && response.screenshot) {
          this.addMessage('user', '[Screenshot attached - asking what to do with it]');
          this.showTypingIndicator();

          // Send screenshot to API with a default question
          chrome.runtime.sendMessage({
            action: 'send-chat-message',
            question: 'What do you see in this screenshot? Please describe it.',
            context: response.screenshot,
            dataType: 'screenshot_with_question',
            pageUrl: window.location.href,
            pageTitle: document.title
          }, (apiResponse) => {
            this.removeTypingIndicator();

            if (apiResponse && apiResponse.success && apiResponse.data) {
                const text = apiResponse.data.assembled || apiResponse.data.response || apiResponse.data.result || JSON.stringify(apiResponse.data);
              this.addMessage('assistant', text);
            } else {
              this.addMessage('assistant', `Error: ${apiResponse?.error || 'Failed to process screenshot'}`);
            }

            this.isWaitingForResponse = false;
          });
        } else {
          this.addMessage('assistant', `Error: ${response.error || 'Failed to capture screenshot'}`);
          this.isWaitingForResponse = false;
        }
      });
    } catch (error) {
      document.getElementById('ai-chat-screenshot-btn').disabled = false;
      this.addMessage('assistant', `Error: ${error.message}`);
      this.isWaitingForResponse = false;
    }
  }

  /**
   * Add a message to the chat
   * @param {string} role - 'user' or 'assistant'
   * @param {string} text - Message text
   */
  addMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-chat-message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-chat-message-content';
    contentDiv.textContent = text;

    messageDiv.appendChild(contentDiv);
    this.messagesContainer.appendChild(messageDiv);

    // Auto-scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Show typing indicator
   */
  showTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'ai-chat-message assistant';
    messageDiv.id = 'ai-chat-typing-indicator';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ai-chat-message-content';
    contentDiv.innerHTML = `
      <div class="ai-chat-typing-indicator">
        <div class="ai-chat-typing-dot"></div>
        <div class="ai-chat-typing-dot"></div>
        <div class="ai-chat-typing-dot"></div>
      </div>
    `;

    messageDiv.appendChild(contentDiv);
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Remove typing indicator
   */
  removeTypingIndicator() {
    const indicator = document.getElementById('ai-chat-typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
}

// Initialize chat panel when content script loads
const chatPanel = new ChatPanel();
chatPanel.init();
