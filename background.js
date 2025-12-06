/**
 * Background Service Worker
 * Handles context menu creation, API requests, and inter-component communication
 */

// Create context menus when extension loads
chrome.runtime.onInstalled.addListener(() => {
  // Menu item for selected text
  chrome.contextMenus.create({
    id: 'send-selected-text',
    title: 'Send Selected Text to API',
    contexts: ['selection']
  });

  // Menu item for all visible text
  chrome.contextMenus.create({
    id: 'send-all-text',
    title: 'Send All Visible Text to API',
    contexts: ['page']
  });

  // Menu item for screenshot
  chrome.contextMenus.create({
    id: 'send-screenshot',
    title: 'Send Screenshot to API',
    contexts: ['page']
  });
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    switch (info.menuItemId) {
      case 'send-selected-text':
        await handleSelectedText(info.selectionText, tab);
        break;
      case 'send-all-text':
        await handleAllText(tab);
        break;
      case 'send-screenshot':
        await handleScreenshot(tab);
        break;
    }
  } catch (error) {
    console.error('Error in context menu handler:', error);
    notifyUser(tab.id, 'error', `Error: ${error.message}`);
  }
});

/**
 * Send selected text to API
 * @param {string} selectedText - The selected text from the page
 * @param {object} tab - The current tab object
 */
async function handleSelectedText(selectedText, tab) {
  const config = await getActiveConfig();
  if (!config) {
    notifyUser(tab.id, 'error', 'No active profile configured. Please set it in the options page.');
    return;
  }

  const response = await sendToApi(config, {
    type: 'selected_text',
    content: selectedText,
    model: config.selectedModel,
    pageUrl: tab.url,
    pageTitle: tab.title,
    timestamp: new Date().toISOString()
  });

  notifyPopup('result', response);
}

/**
 * Send all visible text to API
 * @param {object} tab - The current tab object
 */
async function handleAllText(tab) {
  const config = await getActiveConfig();
  if (!config) {
    notifyUser(tab.id, 'error', 'No active profile configured. Please set it in the options page.');
    return;
  }

  // Request content script to extract all visible text
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: 'extract-all-text'
  });

  if (!response || response.error) {
    notifyUser(tab.id, 'error', response?.error || 'Failed to extract text from page');
    return;
  }

  const apiResponse = await sendToApi(config, {
    type: 'all_text',
    content: response.text,
    model: config.selectedModel,
    pageUrl: tab.url,
    pageTitle: tab.title,
    timestamp: new Date().toISOString()
  });

  notifyPopup('result', apiResponse);
}

/**
 * Send screenshot to API
 * @param {object} tab - The current tab object
 */
async function handleScreenshot(tab) {
  const config = await getActiveConfig();
  if (!config) {
    notifyUser(tab.id, 'error', 'No active profile configured. Please set it in the options page.');
    return;
  }

  try {
    // Capture the visible tab
    const canvas = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png'
    });

    const apiResponse = await sendToApi(config, {
      type: 'screenshot',
      content: canvas,
      model: config.selectedModel,
      pageUrl: tab.url,
      pageTitle: tab.title,
      timestamp: new Date().toISOString()
    });

    notifyPopup('result', apiResponse);
  } catch (error) {
    notifyUser(tab.id, 'error', `Failed to capture screenshot: ${error.message}`);
  }
}

/**
 * Get active profile configuration
 * @returns {Promise<object>} Active profile config or null
 */
async function getActiveConfig() {
  try {
    const result = await chrome.storage.sync.get(['activeProfile', 'selectedModel', 'profiles', 'ocrUrl', 'ocrOptions']);
    
    if (!result.activeProfile || !result.selectedModel || !result.profiles) {
      return null;
    }

    const profile = result.profiles.find(p => p.id === result.activeProfile);
    if (!profile) return null;

    return {
      url: profile.url,
      selectedModel: result.selectedModel,
      ocrUrl: result.ocrUrl || '',
      ocrOptions: result.ocrOptions || '',
      systemPrompt: profile.systemPrompt || ''
    };
  } catch (error) {
    console.error('Error getting active config:', error);
    return null;
  }
}

/**
 * Send image data URL to OCR endpoint using multipart/form-data
 * @param {string} ocrUrl
 * @param {string} dataUrl - data:image/png;base64,...
 * @returns {Promise<{success:boolean,text?:string,error?:string}>}
 */
async function sendImageToOcr(ocrUrl, dataUrl) {
  try {
    if (!ocrUrl) return { success: false, error: 'No OCR URL configured' };

    // Convert data URL to Blob
    const blob = await (await fetch(dataUrl)).blob();

    const form = new FormData();
    form.append('file', blob, 'screenshot.png');

    // If OCR options provided (JSON string), append as 'options' field
    if (typeof ocrUrl === 'string' && ocrUrl) {
      try {
        const stored = await chrome.storage.sync.get('ocrOptions');
        const optionsStr = stored.ocrOptions || '';
        if (optionsStr && optionsStr.trim()) {
          // Ensure it's valid JSON; if so append stringified JSON
          try {
            const parsed = JSON.parse(optionsStr);
            form.append('options', JSON.stringify(parsed));
          } catch (e) {
            // invalid JSON in storage; skip attaching options
            console.warn('Stored OCR options invalid JSON, skipping options field');
          }
        }
      } catch (e) {
        // ignore storage read errors
      }
    }

    const resp = await fetch(ocrUrl, {
      method: 'POST',
      body: form
    });

    if (!resp.ok) {
      return { success: false, error: `OCR HTTP ${resp.status}: ${resp.statusText}` };
    }

    const json = await resp.json();

    // Use unified extractor to find OCR text in many possible response shapes
    const extracted = extractOcrText(json);
    if (extracted && typeof extracted === 'string' && extracted.trim().length > 0) {
      return { success: true, text: extracted };
    }

    // If no useful text found, return a success with empty text and a flag
    return { success: true, text: '', warning: 'Kein OCR-Ergebnis, bitte Screenshot erneut versuchen' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Extract OCR text from various possible OCR server JSON shapes.
 * Priority: json.text -> json.data.stdout -> json.stdout -> json.result -> json.output -> first long string field (>10)
 * @param {object} json
 * @returns {string} extracted text or empty string
 */
function extractOcrText(json) {
  if (!json || typeof json !== 'object') return '';

  if (typeof json.text === 'string' && json.text.trim().length > 0) return json.text.trim();

  if (json.data && typeof json.data === 'object') {
    if (typeof json.data.stdout === 'string' && json.data.stdout.trim().length > 0) return json.data.stdout.trim();
  }

  if (typeof json.stdout === 'string' && json.stdout.trim().length > 0) return json.stdout.trim();
  if (typeof json.result === 'string' && json.result.trim().length > 0) return json.result.trim();
  if (typeof json.output === 'string' && json.output.trim().length > 0) return json.output.trim();

  // Backup: first "long" string field at root
  try {
    for (const val of Object.values(json)) {
      if (typeof val === 'string' && val.trim().length > 10) return val.trim();
      // also support nested single-level objects like { something: { text: '...' } }
      if (val && typeof val === 'object') {
        for (const v2 of Object.values(val)) {
          if (typeof v2 === 'string' && v2.trim().length > 10) return v2.trim();
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return '';
}

/**
 * Retrieve stored API URL from chrome.storage (deprecated, kept for backwards compatibility)
 * @returns {Promise<string>} The stored API URL or empty string if not set
 */
async function getStoredApiUrl() {
  const result = await chrome.storage.sync.get('apiUrl');
  return result.apiUrl || '';
}

/**
 * Send data to the API endpoint
 * Ollama expects only 'model' and 'prompt' fields
 * @param {object} config - Config with url and selectedModel
 * @param {object} data - The data to send (will be converted to prompt)
 * @returns {Promise<object>} The API response
 */
async function sendToApi(config, data) {
  try {
    // Construct API endpoint
    const apiUrl = `${config.url}/api/generate`;
    
    // Build a comprehensive prompt from all available data
    // If caller supplied a fully assembled prompt, use it directly
    if (data && typeof data.prompt === 'string' && data.prompt.length > 0) {
      // If a system prompt exists for the active profile or caller provided one, prepend it
      let finalPrompt = data.prompt;
      if (data.systemPrompt && data.systemPrompt.trim()) {
        finalPrompt = `System Prompt:\n${data.systemPrompt.trim()}\n\n` + finalPrompt;
      } else if (config.systemPrompt && config.systemPrompt.trim()) {
        finalPrompt = `System Prompt:\n${config.systemPrompt.trim()}\n\n` + finalPrompt;
      }

      const requestBodyDirect = {
        model: config.selectedModel,
        prompt: finalPrompt
      };
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBodyDirect)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonResponse = await response.json();
      return {
        success: true,
        status: response.status,
        data: jsonResponse,
        timestamp: new Date().toISOString()
      };
    }

    let promptParts = [];
    
    // Add page context
    // Prepend system prompt if present
    if (data.systemPrompt) {
      promptParts.push(`System Prompt:\n${data.systemPrompt}`);
    } else if (config.systemPrompt) {
      promptParts.push(`System Prompt:\n${config.systemPrompt}`);
    }
    if (data.pageTitle) {
      promptParts.push(`Page Title: ${data.pageTitle}`);
    }
    if (data.pageUrl) {
      promptParts.push(`Page URL: ${data.pageUrl}`);
    }
    
    // Add content (text or screenshot reference). If screenshot, try OCR first.
    if (data.content) {
      if (String(data.type).toLowerCase().includes('screenshot')) {
        // If content is a data URL (data:image/...), and OCR URL configured, send to OCR server
        const isDataUrl = String(data.content).startsWith('data:');
        if (isDataUrl && config.ocrUrl) {
          try {
            const ocrResult = await sendImageToOcr(config.ocrUrl, data.content);
            if (ocrResult.success && ocrResult.text) {
              promptParts.push(`Content (from OCR):\n${ocrResult.text}`);
            } else if (ocrResult.success && (!ocrResult.text || ocrResult.text.trim() === '')) {
              // OCR returned no text -> inform the user in the chat panel instead of calling the model
              const hint = (ocrResult.warning) ? ocrResult.warning : 'Kein OCR-Ergebnis, bitte Screenshot erneut versuchen';
              return {
                success: true,
                status: 200,
                data: { assembled: hint },
                timestamp: new Date().toISOString()
              };
            } else {
              // OCR failed with an error
              promptParts.push(`[Screenshot provided; OCR failed: ${ocrResult.error || 'unknown'}]`);
            }
          } catch (e) {
            promptParts.push(`[Screenshot provided; OCR error: ${e.message}]`);
          }
        } else if (isDataUrl && !config.ocrUrl) {
          // No OCR endpoint configured
          promptParts.push(`[Screenshot provided as Base64 PNG; set an OCR URL in options to extract text automatically]`);
        } else {
          // Content is already plain text (maybe OCRed upstream) or other format
          promptParts.push(`Content:\n${data.content}`);
        }
      } else {
        promptParts.push(`Content:\n${data.content}`);
      }
    }
    
    // Add user question if present
    if (data.question) {
      promptParts.push(`Question: ${data.question}`);
    }
    
    // If no question but has type info, add that context
    if (!data.question && data.type) {
      promptParts.push(`Data Type: ${data.type}`);
    }
    
    // Combine all parts into a single prompt string
    const prompt = promptParts.join('\n\n');
    
    // Create Ollama-compatible request body with only model and prompt
    const requestBody = {
      model: config.selectedModel,
      prompt: prompt
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Try to read a streaming NDJSON response (Ollama streams JSON objects line-by-line).
    // We'll read the response body as a stream and parse each line as its own JSON object,
    // then concatenate any textual parts (e.g. `response`, `text`, `message`, `output`).
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // Helper to extract text from arbitrary nested objects returned by stream chunks
    function extractTextFromObject(obj) {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      if (Array.isArray(obj)) return obj.map(extractTextFromObject).join('');
      if (typeof obj === 'object') {
        if (typeof obj.response === 'string') return obj.response;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.content === 'string') return obj.content;
        if (typeof obj.message === 'string') return obj.message;
        if (typeof obj.output === 'string') return obj.output;
        // If object contains nested parts, try to concatenate them
        let s = '';
        for (const k of Object.keys(obj)) {
          s += extractTextFromObject(obj[k]);
        }
        return s;
      }
      return '';
    }

    // If we have a readable stream, parse it line-by-line
    if (response.body && (contentType.includes('application/x-ndjson') || contentType.includes('text/event-stream') || contentType.includes('text/plain') || response.headers.get('transfer-encoding') === 'chunked')) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assembled = '';

      // Read chunks and split on newlines; parse each non-empty line as JSON
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split(/\r?\n/);
        // keep the last partial line in buffer
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Strip common event-stream prefix like "data: "
          let candidate = trimmed.replace(/^data:\s*/i, '');
          try {
            const obj = JSON.parse(candidate);
            assembled += extractTextFromObject(obj);
            continue;
          } catch (e) {
            // try to recover JSON substring between first { and last }
            const first = candidate.indexOf('{');
            const last = candidate.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) {
              const sub = candidate.slice(first, last + 1);
              try {
                const obj2 = JSON.parse(sub);
                assembled += extractTextFromObject(obj2);
                continue;
              } catch (e2) {
                // fallthrough to ignore line
              }
            }
            // ignore non-JSON line
          }
        }
      }

      // Process remaining buffer (if it contains a full JSON line)
      const rem = buffer.trim();
      if (rem) {
        let candidate = rem.replace(/^data:\s*/i, '');
        try {
          const obj = JSON.parse(candidate);
          assembled += extractTextFromObject(obj);
        } catch (e) {
          const first = candidate.indexOf('{');
          const last = candidate.lastIndexOf('}');
          if (first !== -1 && last !== -1 && last > first) {
            try {
              const obj2 = JSON.parse(candidate.slice(first, last + 1));
              assembled += extractTextFromObject(obj2);
            } catch (e2) {
              // ignore
            }
          }
        }
      }

      return {
        success: true,
        status: response.status,
        data: { assembled: assembled },
        timestamp: new Date().toISOString()
      };
    }

    // Fallback: non-streaming JSON
    const jsonResponse = await response.json();
    return {
      success: true,
      status: response.status,
      data: jsonResponse,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Notify popup with result (used when popup is open)
 * @param {string} type - Type of notification
 * @param {object} data - Data to send
 */
function notifyPopup(type, data) {
  chrome.runtime.sendMessage({
    type: type,
    data: data
  }).catch(() => {
    // Popup not open, silently fail
  });
}

/**
 * Notify user in active tab
 * @param {number} tabId - The tab ID to notify
 * @param {string} type - Type of notification (error, success, info)
 * @param {string} message - The notification message
 */
function notifyUser(tabId, type, message) {
  chrome.tabs.sendMessage(tabId, {
    action: 'notify',
    type: type,
    message: message
  }).catch(() => {
    console.log('Could not send notification to tab');
  });
}

/**
 * Listen for messages from popup and chat panel
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'send-data') {
    (async () => {
      try {
        const config = await getActiveConfig();
        if (!config) {
          sendResponse({
            success: false,
            error: 'No active profile configured'
          });
          return;
        }

        const response = await sendToApi(config, {
          type: request.dataType,
          content: request.content,
          model: config.selectedModel,
          pageUrl: request.pageUrl,
          pageTitle: request.pageTitle,
          timestamp: new Date().toISOString()
        });

        sendResponse(response);
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // Keep channel open for async response
  } else if (request.action === 'send-chat-message') {
    (async () => {
      try {
        const config = await getActiveConfig();
        if (!config) {
          sendResponse({
            success: false,
            error: 'No active profile configured. Please set it in the options page.'
          });
          return;
        }

        // Prepare request body based on data type
        const requestBody = {
          type: request.dataType,
          question: request.question,
          content: request.context,
          model: config.selectedModel,
          pageUrl: request.pageUrl,
          pageTitle: request.pageTitle,
          timestamp: new Date().toISOString()
        };

        // If assembled prompt provided by caller, pass it along as 'prompt'
        if (request.assembledPrompt && typeof request.assembledPrompt === 'string') {
          requestBody.prompt = request.assembledPrompt;
        }

        const response = await sendToApi(config, requestBody);
        sendResponse(response);
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // Keep channel open for async response
  } else if (request.action === 'capture-screenshot') {
    (async () => {
      try {
        // Get the active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          sendResponse({
            success: false,
            error: 'No active tab found'
          });
          return;
        }

        const tab = tabs[0];
        const canvas = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png'
        });

        sendResponse({
          success: true,
          screenshot: canvas
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true; // Keep channel open for async response
  }
  else if (request.action === 'capture-and-ocr') {
    (async () => {
      try {
        // capture active tab screenshot and run OCR with configured OCR endpoint
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs || tabs.length === 0) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        const tab = tabs[0];
        const canvas = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        // Retrieve OCR URL from storage
        const cfg = await getActiveConfig();
        if (!cfg || !cfg.ocrUrl) {
          sendResponse({ success: true, screenshot: canvas, ocrText: '', warning: 'No OCR configured' });
          return;
        }
        const ocrResult = await sendImageToOcr(cfg.ocrUrl, canvas);
        if (ocrResult.success) {
          sendResponse({ success: true, screenshot: canvas, ocrText: ocrResult.text || '', warning: ocrResult.warning || '' });
        } else {
          sendResponse({ success: false, error: ocrResult.error || 'OCR failed' });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  else if (request.action === 'build-prompt') {
    try {
      const assembled = buildCombinedPrompt(request.payload || {});
      sendResponse({ success: true, prompt: assembled });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
});

/**
 * Build combined prompt from collected sections.
 * Sections: systemPrompt, pageTitle, pageUrl, allText, ocrText, question
 * If any section missing/empty, substitute 'nicht verfügbar'
 * Truncate sections to keep total length under maxChars
 */
function buildCombinedPrompt({ systemPrompt = '', pageTitle = '', pageUrl = '', allText = '', ocrText = '', question = '', selection = '' } = {}) {
  const maxChars = 30000; // overall limit

  const sections = [];
  if (systemPrompt && systemPrompt.trim()) {
    sections.push(`${systemPrompt.trim()}`);
  }

  if (selection && String(selection).trim()) {
    sections.push(`Ausgewählter Text:
${String(selection).trim()}`);
  }

  sections.push(`Seiten-Titel: ${pageTitle && pageTitle.trim() ? pageTitle.trim() : 'nicht verfügbar'}`);
  sections.push(`Seiten-URL: ${pageUrl && pageUrl.trim() ? pageUrl.trim() : 'nicht verfügbar'}`);

  const cleanedAll = allText && String(allText).trim() ? String(allText).trim() : 'nicht verfügbar';
  sections.push(`\nGesamter Seitentext (STRG+A):\n${cleanedAll}`);

  const cleanedOcr = ocrText && String(ocrText).trim() ? String(ocrText).trim() : 'nicht verfügbar';
  sections.push(`\nSichtbarer Bereich (Screenshot, OCR):\n${cleanedOcr}`);

  sections.push(`\nFrage des Nutzers:\n${question && question.trim() ? question.trim() : 'nicht verfügbar'}`);

  // Join and truncate if necessary
  let prompt = sections.join('\n\n');
  if (prompt.length > maxChars) {
    // attempt to truncate large sections: prefer keeping header/context & question
    const preserve = `Frage des Nutzers:\n${question && question.trim() ? question.trim() : 'nicht verfügbar'}`;
    // remove from middle - keep first 60% of allowed and add preserve
    const head = prompt.slice(0, Math.floor(maxChars * 0.6));
    const tail = '\n\n... [TRUNCATED] ...\n\n' + preserve;
    prompt = head + tail;
    if (prompt.length > maxChars) prompt = prompt.slice(0, maxChars);
  }

  return prompt;
}

