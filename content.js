/**
 * Content Script
 * Runs on web pages to extract text and handle page-specific operations
 */

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract-all-text') {
    try {
      const allText = extractAllVisibleText();
      sendResponse({ text: allText });
    } catch (error) {
      sendResponse({ error: error.message });
    }
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
  // Create a clone of the body to manipulate
  const bodyClone = document.body.cloneNode(true);

  // Remove script and style elements
  const scripts = bodyClone.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());

  // Get all text content
  const allText = bodyClone.innerText || bodyClone.textContent || '';

  // Clean up excessive whitespace
  return allText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
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
