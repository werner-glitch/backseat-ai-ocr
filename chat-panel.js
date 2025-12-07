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
    // Load saved custom height (if any) from chrome.storage.sync
    try {
      chrome.storage.sync.get(['aiChatCustomHeight', 'activeProfile', 'profiles'], (res) => {
        try {
          const saved = res.aiChatCustomHeight;
          if (saved) {
            const h = parseFloat(saved);
            if (!Number.isNaN(h) && h > this.COLLAPSED_HEIGHT) {
              this.customHeight = h;
              // apply as custom class so toggle uses it
              try { this.panelElement.classList.add('ai-chat-panel-custom'); } catch (e) {}
            }
          }
          // populate profile dropdown if available
          const profiles = res.profiles || [];
          const active = res.activeProfile || '';
          const select = document.getElementById('ai-chat-profile-select');
          if (select && Array.isArray(profiles)) {
            select.innerHTML = '';
            profiles.forEach(p => {
              const opt = document.createElement('option');
              opt.value = p.id;
              opt.textContent = p.name;
              select.appendChild(opt);
            });
            if (active) select.value = active;
          }
        } catch (e) {
          // ignore
        }
      });
    } catch (e) {
      this.customHeight = null;
    }
    this.attachEventListeners();
    this.setupStyles();
    // Sync toggle icon with initial state
    this.updateToggleIconState();
    // No automatic collection on init. Sources are collected only when the user clicks "Senden".
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
          <div style="display:flex;align-items:center;gap:8px;">
            <h3 style="margin:0;">Chat with AI</h3>
            <select id="ai-chat-profile-select" style="font-size:12px;padding:4px;border-radius:6px;border:1px solid #ccc;"></select>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <div id="ai-chat-active-prompt" style="font-size:12px;color:#333;padding:6px 8px;border-radius:8px;background:#f3f3f3;max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Prompt: -</div>
            <div id="ai-chat-active-ocr" style="font-size:12px;color:#333;padding:6px 8px;border-radius:8px;background:#f3f3f3;">OCR: -</div>
            <button id="ai-chat-toggle" class="ai-chat-toggle-btn" title="Toggle chat panel">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 18l1.41-5.02C2.24 11.36 2 10.7 2 10c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.28 0-2.5-.32-3.56-.93L2 18z" fill="currentColor"/>
            </svg>
            </button>
          </div>
        </div>
        <div class="ai-chat-messages" id="ai-chat-messages"></div>
        <div id="ai-chat-preview" class="ai-chat-preview" style="padding:8px;border-top:1px solid #eee;font-size:12px;max-height:150px;overflow:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;"><div><strong>Collected sources (last used):</strong></div><div id="preview-timestamp" style="font-size:11px;color:#666">-</div></div>
          <div id="preview-title">Seiten-Titel: -</div>
          <div id="preview-url">Seiten-URL: -</div>
          <div id="preview-alltext">Gesamter Seitentext: -</div>
          <div id="preview-ocr">Screenshot (OCR): -</div>
          <div style="margin-top:6px;"><button id="refresh-alltext-btn" style="margin-right:6px;">Neu sammeln</button><button id="retry-ocr-btn">OCR neu</button></div>
        </div>
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
          <!-- Screenshot button removed; Send will collect screenshot/OCR automatically -->
          <label style="display:flex;align-items:center;gap:6px;margin-left:8px;font-size:12px;color:#444;"><input id="ai-chat-debug-toggle" type="checkbox" style="margin-right:6px;">Debug</label>
        </div>
        <div class="ai-chat-footer">
          <small>Configured API</small>
        </div>
        <div id="ai-chat-debug-log-wrap" style="display:none;padding:8px;border-top:1px solid #eee;background:#111;color:#0f0;max-height:160px;overflow:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><strong style="color:#fff;font-size:13px;">Debug Log</strong><button id="ai-chat-clear-log" style="font-size:12px;padding:4px 8px;border-radius:6px;">Clear</button></div>
          <pre id="ai-chat-debug-log" style="white-space:pre-wrap;font-size:12px;margin:0;padding:0;color:#0f0;background:transparent;"> </pre>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    this.panelElement = document.getElementById('ai-chat-panel');
    this.messagesContainer = document.getElementById('ai-chat-messages');
    this.inputField = document.getElementById('ai-chat-input');
    this.debugLogEl = document.getElementById('ai-chat-debug-log');
    this.debugWrap = document.getElementById('ai-chat-debug-log-wrap');
    this.debugToggle = document.getElementById('ai-chat-debug-toggle');
    const clearLogBtn = document.getElementById('ai-chat-clear-log');
    if (clearLogBtn) clearLogBtn.addEventListener('click', () => { if (this.debugLogEl) this.debugLogEl.textContent = ''; });
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

    // Send button: now collects all sources including screenshot/OCR
    document.getElementById('ai-chat-send-btn').addEventListener('click', () => {
      this.handleSendMessage();
    });

    // Debug toggle behaviour and console hook
    if (this.debugToggle) {
      // initialize from storage
      try { chrome.storage.sync.get(['panelDebug'], (res) => {
        const enabled = !!res.panelDebug;
        this.debugToggle.checked = enabled;
        this.debugWrap.style.display = enabled ? 'block' : 'none';
        if (enabled) this.enableConsoleProxy(); else this.disableConsoleProxy();
      }); } catch (e) {}

      this.debugToggle.addEventListener('change', (e) => {
        const on = e.target.checked;
        try { chrome.storage.sync.set({ panelDebug: on }); } catch (err) {}
        if (on) { this.debugWrap.style.display = 'block'; this.enableConsoleProxy(); } else { this.debugWrap.style.display = 'none'; this.disableConsoleProxy(); }
      });
    }

    // Enter key to send
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isWaitingForResponse) {
        this.handleSendMessage();
      }
    });

    // no separate screenshot button anymore; screenshot will be gathered on send

    // Profile select change
    const profileSelect = document.getElementById('ai-chat-profile-select');
    if (profileSelect) {
      profileSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        // save active profile to chrome.storage.sync
        try {
          chrome.storage.sync.set({ activeProfile: val });
        } catch (err) {
          // ignore
        }
      });
    }

    // Preview refresh buttons
    const refreshBtn = document.getElementById('refresh-alltext-btn');
    const retryOcrBtn = document.getElementById('retry-ocr-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.collectPageText(true));
    if (retryOcrBtn) retryOcrBtn.addEventListener('click', () => this.collectScreenshotAndOcr(true));

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
          try { chrome.storage.sync.set({ aiChatCustomHeight: String(this.customHeight) }); } catch (e) {}
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
          try { chrome.storage.sync.set({ aiChatCustomHeight: String(this.customHeight) }); } catch (e) {}
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
        box-shadow: none;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        transition: height 0s;
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
        background: #f9f9f9;
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
      }

      .ai-chat-toggle-btn:hover {
        background: rgba(0, 0, 0, 0.03);
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
      }

      /* no animations for a simple, accessible UI */

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
        font-size: 0;
      }

      .ai-chat-send-btn:disabled,
      .ai-chat-screenshot-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
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
      }

      .ai-chat-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      /* no typing animation for accessibility */

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
    let question = this.inputField.value.trim();
    if (this.isWaitingForResponse) return;

    // Collect all sources: selection, title+url, page text, screenshot+OCR
    this.showTypingIndicator();
    this.isWaitingForResponse = true;

    // Preserve any current selection
    let selectionText = '';
    try { selectionText = window.getSelection().toString() || this.savedSelection || ''; } catch (e) { selectionText = this.savedSelection || ''; }

    const titleUrl = this.collectTitleAndUrl();
    const pageTextPromise = this.collectPageText();

    // Before capturing screenshot, hide the panel so it is not visible in the capture
    try {
      if (this.panelElement) {
        this.panelElement.style.visibility = 'hidden';
      }
      // allow layout to update
      await new Promise(r => setTimeout(r, 120));
    } catch (e) {
      // ignore
    }

    const ocrPromise = this.collectScreenshotAndOcr();

    const [allTextRes, ocrRes] = await Promise.all([pageTextPromise, ocrPromise]);
    const allText = allTextRes && allTextRes.text ? allTextRes.text : '';
    const ocrText = ocrRes && ocrRes.success ? (ocrRes.ocrText || '') : '';
    const pageTitle = titleUrl.title || '';
    const pageUrl = titleUrl.url || '';

    // Restore panel visibility after capture
    try { if (this.panelElement) this.panelElement.style.visibility = ''; } catch (e) {}

    // Update preview to show which sources were used and when
    try {
      const ts = new Date().toLocaleString();
      const previewTs = document.getElementById('preview-timestamp'); if (previewTs) previewTs.textContent = ts;
      const pTitle = document.getElementById('preview-title'); if (pTitle) pTitle.textContent = `Seiten-Titel: ${pageTitle || 'nicht verfügbar'}`;
      const pUrl = document.getElementById('preview-url'); if (pUrl) pUrl.textContent = `Seiten-URL: ${pageUrl || 'nicht verfügbar'}`;
      const pAll = document.getElementById('preview-alltext'); if (pAll) pAll.textContent = `Gesamter Seitentext: ${allText ? allText.substring(0,200) + (allText.length>200? '...':'') : 'nicht verfügbar'}`;
      const pOcr = document.getElementById('preview-ocr'); if (pOcr) pOcr.textContent = `Screenshot (OCR): ${ocrText ? ocrText.substring(0,200) + (ocrText.length>200? '...':'') : 'nicht verfügbar'}`;
    } catch (e) {}

    // Determine question: use user input if provided; otherwise default explanatory prompt
    if (!question || question.length === 0) {
      question = 'Bitte beschreibe, was auf dieser Seite bzw. im Screenshot zu sehen ist und weise auf Besonderheiten oder auffällige Elemente hin.';
    }

    // Add user message to chat (show user's question or that we asked for an explanation)
    this.addMessage('user', this.inputField.value.trim() ? this.inputField.value.trim() : '[Automatische Beschreibung angefordert]');
    this.inputField.value = '';
    this.inputField.disabled = true;
    // Build per-source, question-centered summaries, then combine summaries and ask final question
    try {
      // helper to send assembled prompt to background and await response
      const sendPrompt = (prompt) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'send-chat-message', assembledPrompt: prompt, dataType: 'summarization' }, (resp) => resolve(resp));
        });
      };

      const sources = [];
      if (selectionText && selectionText.trim()) sources.push({ name: 'Auswahl', content: selectionText });
      if (allText && allText.trim()) sources.push({ name: 'Website-Text', content: allText });
      if (ocrText && ocrText.trim()) sources.push({ name: 'OCR', content: ocrText });

      const summaries = [];
      // Limit to 3 summaries (as requested)
      for (let i = 0; i < Math.min(3, sources.length); i++) {
        const src = sources[i];
        // Build per-source prompt that asks for a question-focused summary
        const perPrompt = `Hier ist ein Textauszug (Quelle: ${src.name}). Die Nutzerfrage lautet: "${question}"\n\n"Fasse die wichtigsten Informationen aus diesem Auszug zusammen, die zur Beantwortung der Frage beitragen."\n\nTextauszug:\n${src.content}`;

        const resp = await sendPrompt(perPrompt);
        let summaryText = '';
        if (resp && resp.success && resp.data) {
          summaryText = resp.data.assembled || resp.data.response || resp.data.result || JSON.stringify(resp.data);
        } else if (resp && resp.error) {
          summaryText = `[Fehler bei der Zusammenfassung: ${resp.error}]`;
        } else {
          summaryText = '[Keine Antwort bei der Zusammenfassung]';
        }

        summaries.push({ name: src.name, summary: summaryText });
      }

      // If there were no sources with content, fallback: ask question directly (or use default summary behavior)
      let finalPrompt = '';
      if (summaries.length === 0) {
        finalPrompt = `Die Nutzerfrage lautet: "${question}"\n\nBeantworte die Frage so präzise wie möglich.`;
      } else {
        // assemble final prompt from summaries
        const parts = ['Hier sind die zusammengefassten, frage-relevanten Informationen aus verschiedenen Quellen:'];
        for (const s of summaries) {
          parts.push(`- ${s.name}: ${s.summary}`);
        }
        parts.push(`\nDie Nutzerfrage lautet: "${question}"\nBeantworte die Frage so präzise wie möglich auf Basis dieser Daten.`);
        finalPrompt = parts.join('\n');
      }

      // Send final prompt
      const finalResp = await sendPrompt(finalPrompt);
      this.removeTypingIndicator();

      if (!finalResp) {
        this.addMessage('assistant', 'Error: No response from extension.');
      } else if (finalResp.success && finalResp.data) {
        const text = finalResp.data.assembled || finalResp.data.response || finalResp.data.result || JSON.stringify(finalResp.data);
        this.addMessage('assistant', text);
      } else {
        this.addMessage('assistant', `Error: ${finalResp.error || 'Unknown error'}`);
      }

      this.inputField.disabled = false;
      this.isWaitingForResponse = false;
    } catch (err) {
      this.removeTypingIndicator();
      this.addMessage('assistant', `Error: ${err.message}`);
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
      chrome.runtime.sendMessage({ action: 'capture-screenshot' }, (response) => {
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
   * Collect title and url
   */
  collectTitleAndUrl() {
    try {
      return { title: document.title || '', url: window.location.href || '' };
    } catch (e) {
      return { title: '', url: '' };
    }
  }

  /**
   * Collect full page text via content script
   * @param {boolean} forceRefresh - whether to force collection (for UI button)
   */
  collectPageText(forceRefresh = false) {
    return new Promise((resolve) => {
      try {
        // Extract visible text directly
        const bodyClone = document.body.cloneNode(true);
        const scripts = bodyClone.querySelectorAll('script, style, noscript');
        scripts.forEach(el => el.remove());
        const allText = bodyClone.innerText || bodyClone.textContent || '';
        const cleaned = allText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
        const preview = cleaned ? cleaned.substring(0, 200) : '';
        const elem = document.getElementById('preview-alltext');
        if (elem) elem.textContent = `Gesamter Seitentext: ${preview}${cleaned && cleaned.length > 200 ? '...' : ''}`;
        resolve({ text: cleaned });
      } catch (e) {
        const elem = document.getElementById('preview-alltext');
        if (elem) elem.textContent = `Gesamter Seitentext: nicht verfügbar`;
        resolve({ text: '' });
      }
    });
  }

  /**
   * Capture visible area and run OCR via background helper
   * @param {boolean} forceRetry
   */
  collectScreenshotAndOcr(forceRetry = false) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'capture-and-ocr' }, (response) => {
        const elem = document.getElementById('preview-ocr');
        if (!response) {
          if (elem) elem.textContent = 'Screenshot (OCR): nicht verfügbar';
          resolve({ success: false, ocrText: '' });
          return;
        }
        if (response.success) {
          const preview = (response.ocrText || '').substring(0, 200);
          if (elem) elem.textContent = `Screenshot (OCR): ${preview}${(response.ocrText || '').length > 200 ? '...' : ''}`;
          resolve({ success: true, ocrText: response.ocrText || '', warning: response.warning });
        } else {
          if (elem) elem.textContent = `Screenshot (OCR): error`;
          resolve({ success: false, error: response.error || 'OCR failed' });
        }
      });
    });
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

  /**
   * Append a message to the debug log (if available)
   */
  debugLog(msg) {
    try {
      if (!this.debugLogEl) return;
      const now = new Date().toLocaleTimeString();
      this.debugLogEl.textContent += `[${now}] ${msg}\n`;
      const wrap = this.debugLogEl.parentElement;
      if (wrap) wrap.scrollTop = wrap.scrollHeight;
    } catch (e) {
      // ignore
    }
  }

  /**
   * Replace console methods with proxies that also write to the panel debug log
   */
  enableConsoleProxy() {
    if (this._consoleProxyEnabled) return;
    this._origConsole = this._origConsole || {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
    };
    const levels = ['log', 'error', 'warn', 'info', 'debug'];
    levels.forEach((lvl) => {
      try {
        console[lvl] = (...args) => {
          try { this._origConsole[lvl](...args); } catch (e) {}
          try {
            const s = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
            this.debugLog(`[${lvl}] ${s}`);
          } catch (e) {}
        };
      } catch (e) {}
    });
    this._consoleProxyEnabled = true;
    this.debugLog('Console proxy enabled');
  }

  /**
   * Restore original console methods
   */
  disableConsoleProxy() {
    if (!this._consoleProxyEnabled) return;
    try {
      if (this._origConsole) {
        console.log = this._origConsole.log;
        console.error = this._origConsole.error;
        console.warn = this._origConsole.warn;
        console.info = this._origConsole.info;
        console.debug = this._origConsole.debug || this._origConsole.log;
      }
    } catch (e) {}
    this._consoleProxyEnabled = false;
    this.debugLog('Console proxy disabled');
  }
}

// Initialize chat panel when content script loads
const chatPanel = new ChatPanel();
chatPanel.init();
