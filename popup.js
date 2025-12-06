/**
 * Popup Script
 * Handles UI interactions and API calls from the popup
 */

document.addEventListener('DOMContentLoaded', init);

/**
 * Initialize popup
 */
async function init() {
  // Load and display current active profile and model
  const activeConfig = await getActiveConfig();
  updateActiveProfileDisplay(activeConfig);

  // Setup event listeners
  document.getElementById('send-selected-btn').addEventListener('click', handleSendSelected);
  document.getElementById('send-all-text-btn').addEventListener('click', handleSendAllText);
  document.getElementById('send-screenshot-btn').addEventListener('click', handleSendScreenshot);
  document.getElementById('clear-result-btn').addEventListener('click', clearResult);

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'result') {
      displayResult(request.data);
    }
  });
}

/**
 * Get active profile configuration
 * @returns {Promise<object>} Active config or null
 */
async function getActiveConfig() {
  try {
    const result = await chrome.storage.sync.get(['activeProfile', 'selectedModel', 'profiles']);
    
    if (!result.activeProfile || !result.selectedModel || !result.profiles) {
      return null;
    }

    const profile = result.profiles.find(p => p.id === result.activeProfile);
    if (!profile) return null;

    return {
      profileId: profile.id,
      profileName: profile.name,
      url: profile.url,
      systemPrompt: profile.systemPrompt || '',
      selectedModel: result.selectedModel
    };
  } catch (error) {
    console.error('Error getting active config:', error);
    return null;
  }
}

/**
 * Update active profile display
 * @param {object} config - The active configuration
 */
function updateActiveProfileDisplay(config) {
  const display = document.getElementById('current-api-url');
  if (config) {
    display.innerHTML = `
      <strong>${escapeHtml(config.profileName)}</strong>
      <br><small>${escapeHtml(config.url)}</small>
      <br><small>Model: ${escapeHtml(config.selectedModel)}</small>
    `;
  } else {
    display.textContent = 'Not configured - go to options to set up a profile';
  }
}


/**
 * Handle send selected text button
 */
async function handleSendSelected() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const selection = await chrome.tabs.sendMessage(tab.id, { action: 'get-selection' }).catch(() => null);

  if (!selection || !selection.text) {
    showError('No text selected on the page');
    return;
  }

  await sendDataToApi('selected_text', selection.text, tab);
}

/**
 * Handle send all text button
 */
async function handleSendAllText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Use content script to extract all text
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract-all-text' });
    if (response && response.text) {
      await sendDataToApi('all_text', response.text, tab);
    } else {
      showError('Failed to extract text from page');
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
  }
}

/**
 * Handle send screenshot button
 */
async function handleSendScreenshot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    showLoading(true);
    const canvas = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await sendDataToApi('screenshot', canvas, tab);
  } catch (error) {
    showError(`Failed to capture screenshot: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

/**
 * Send data to API
 * @param {string} dataType - Type of data being sent
 * @param {string} content - The content to send
 * @param {object} tab - The current tab
 */
async function sendDataToApi(dataType, content, tab) {
  const config = await getActiveConfig();
  if (!config) {
    showError('No active profile configured. Please go to options to set it.');
    return;
  }

  showLoading(true);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'send-data',
      dataType: dataType,
      content: content,
      pageUrl: tab.url,
      pageTitle: tab.title
    });

    if (response.success) {
      displayResult(response);
    } else {
      showError(response.error || 'API request failed');
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

/**
 * Display API response result
 * @param {object} result - The API response
 */
function displayResult(result) {
  const container = document.getElementById('result-container');
  const content = document.getElementById('result-content');

  if (result.success) {
    content.innerHTML = `
      <div class="result-success">
        <p><strong>Status:</strong> ${result.status}</p>
        <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
        <details>
          <summary>Response Data</summary>
          <pre>${JSON.stringify(result.data, null, 2)}</pre>
        </details>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="result-error">
        <p><strong>Error:</strong> ${result.error}</p>
        <p><strong>Timestamp:</strong> ${new Date(result.timestamp).toLocaleString()}</p>
      </div>
    `;
  }

  container.style.display = 'block';
  document.getElementById('error-message').style.display = 'none';
}

/**
 * Clear result display
 */
function clearResult() {
  document.getElementById('result-container').style.display = 'none';
  document.getElementById('result-content').innerHTML = '';
}

/**
 * Show error message
 * @param {string} message - The error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  document.getElementById('result-container').style.display = 'none';
}

/**
 * Show/hide loading indicator
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

/**
 * Enhancement: Detect selection and update button state
 */
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const sendSelectedBtn = document.getElementById('send-selected-btn');
  if (tabs.length > 0) {
    // Try to detect if there's selected text
    chrome.tabs.sendMessage(tabs[0].id, { action: 'has-selection' }).then(response => {
      if (response && response.hasSelection) {
        sendSelectedBtn.disabled = false;
      } else {
        sendSelectedBtn.disabled = true;
      }
    }).catch(() => {
      // Content script not available, disable button
      sendSelectedBtn.disabled = true;
    });
  }
});

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
