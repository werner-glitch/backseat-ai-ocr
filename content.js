/**
 * Content Script
 * Runs on web pages to extract text and handle page-specific operations
 */

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract-all-text') {
    // This handler is async because we read filters from storage
    chrome.storage.sync.get(['exclusionSelectors'], (res) => {
      try {
        const exclusionStr = (res && res.exclusionSelectors) ? res.exclusionSelectors : '';
        const result = extractAllVisibleText(exclusionStr);
        sendResponse({ text: result.cleanedText, chunks: result.chunks, sentBlocks: result.sentBlocks, sentChars: result.sentChars, excerpts: result.excerpts });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    });
    return true; // indicate async response
  } else if (request.action === 'get-selection') {
    const text = window.getSelection().toString();
    sendResponse({ text: text || '', hasSelection: text.length > 0 });
  } else if (request.action === 'has-selection') {
    const hasSelection = window.getSelection().toString().length > 0;
    sendResponse({ hasSelection: hasSelection });
  } else if (request.action === 'notify') {
    showNotification(request.type, request.message);
  }
});

/**
 * Extract all visible text from the current page
 * @returns {string} All visible text content
 */
function extractAllVisibleText() {
  // fallback when called without exclusions: default empty string
  const exclusionArg = arguments && arguments[0] ? arguments[0] : '';
  // Parse exclusion selectors (comma or newline separated)
  const raw = exclusionArg || '';
  const selectors = raw.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);

  // Default selectors to exclude
  const defaultSelectors = ['nav', 'footer', 'aside', 'header', '.sidebar', '.ad', '.ads', '.cookie', '.banner', '.newsletter', '.popup', '.modal', '.social', '.breadcrumb'];
  const allSelectors = Array.from(new Set(defaultSelectors.concat(selectors)));

  // Prefer main > article > body
  let root = document.querySelector('main') || document.querySelector('article') || document.body;

  // Clone root to avoid modifying page
  const clone = root.cloneNode(true);
  // Remove script/style/noscript
  const bad = clone.querySelectorAll('script, style, noscript');
  bad.forEach(el => el.remove());

  // Remove elements matching exclusion selectors
  allSelectors.forEach(sel => {
    try {
      // If selector looks like a plain tag (no . or # and is alphabetic), query by tag
      if (/^[a-zA-Z0-9_-]+$/.test(sel)) {
        const els = clone.querySelectorAll(sel);
        els.forEach(e => e.remove());
      } else {
        // otherwise use as-is (class/id or complex selector)
        const els = clone.querySelectorAll(sel);
        els.forEach(e => e.remove());
      }
    } catch (e) {
      // ignore invalid selectors
    }
  });

  // Extract text
  let allText = clone.innerText || clone.textContent || '';
  let cleaned = allText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');

  // Chunking: max chunk size 2000, max total 5000, send only first 2-3 blocks
  const maxChunk = 2000;
  const maxTotal = 5000;
  const chunks = [];
  for (let i = 0; i < cleaned.length; i += maxChunk) {
    chunks.push(cleaned.slice(i, i + maxChunk));
  }
  // Determine how many blocks to send (2-3 blocks up to maxTotal)
  let sentBlocks = Math.min(3, chunks.length);
  // Ensure total chars <= maxTotal
  let sentChars = 0;
  const selectedChunks = [];
  for (let i = 0; i < sentBlocks; i++) {
    const remaining = maxTotal - sentChars;
    if (remaining <= 0) break;
    const take = Math.min(chunks[i].length, remaining);
    selectedChunks.push(chunks[i].slice(0, take));
    sentChars += take;
  }
  // adjust sentBlocks to actual selected
  sentBlocks = selectedChunks.length;

  // excerpts: short preview of each selected chunk
  const excerpts = selectedChunks.map(c => c.substring(0, Math.min(200, c.length)));

  return { cleanedText: cleaned, chunks: selectedChunks, sentBlocks, sentChars, excerpts };
}

/**
 * Show notification overlay on the page
 * @param {string} type - Type of notification (error, success, info)
 * @param {string} message - The message to display
 */
function showNotification(type, message) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `api-sender-notification api-sender-notification-${type}`;
  notification.textContent = message;

  // Add styles dynamically if not already present
  if (!document.getElementById('api-sender-styles')) {
    const style = document.createElement('style');
    style.id = 'api-sender-styles';
    style.textContent = `
      .api-sender-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        animation: api-sender-slide-in 0.3s ease-out;
      }

      .api-sender-notification-success {
        background-color: #4caf50;
        color: white;
      }

      .api-sender-notification-error {
        background-color: #f44336;
        color: white;
      }

      .api-sender-notification-info {
        background-color: #2196f3;
        color: white;
      }

      @keyframes api-sender-slide-in {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = 'api-sender-slide-in 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}
