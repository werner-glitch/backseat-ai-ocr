# AI Coding Agent Instructions for Chrome Extension Project

## Project Overview

This is a **Chrome Manifest V3 browser extension** that sends webpage text (selected, all visible, or screenshots) to configurable AI server endpoints. Supports multiple server profiles with automatic model discovery. Built for local AI integration (Ollama, local LLMs, public APIs).

**Key Files:**
- `manifest.json` - Manifest V3 configuration
- `background.js` - Service Worker (API requests, context menus, profile management)
- `content.js` - Content script (page DOM interaction)
- `popup.{html,js,css}` - Extension popup UI
- `options.{html,js,css}` - Settings/profiles page UI
- `README.md` - Comprehensive usage guide

## Architecture & Data Flow

### Multi-Profile System
Extension now supports multiple server profiles, each with:
- Profile ID (timestamp-based)
- Profile name and URL
- List of available models (fetched from `/api/tags`)
- Active selection tracking

Storage structure:
```javascript
{
  profiles: [
    { id, name, url, models: [], createdAt }
  ],
  activeProfile: "profile-id",
  selectedModel: "model-name"
}
```

### Component Communication Pattern

1. **User Action** → Right-click context menu or popup button
2. **Context Menu Handler** (`background.js`) → Routes to appropriate handler
3. **Get Active Config** → `getActiveConfig()` retrieves active profile + model from storage
4. **Data Extraction** (`content.js`) → Extract text or capture screenshot
5. **API Request** (`background.js` - `sendToApi(config, data)`) → POST to profile URL + model info
6. **Response Display** → Popup shows result with timestamp

### Key Service Boundaries

- **`background.js` (Service Worker)**: Central coordinator
  - Creates/manages context menus
  - Fetches data to API using active profile
  - `getActiveConfig()`: Returns {url, selectedModel} or null
  - `sendToApi(config, data)`: Sends to config.url/api/generate
  - Stores profiles in `chrome.storage.sync`
  - Handles popup messages

- **`options.js`**: Profile management
  - Creates/deletes profiles
  - Fetches models from `/api/tags` endpoint
  - Manages active profile selection
  - Validates URLs and handles duplicates

- **`popup.js`**: UI controller
  - Displays active profile and model
  - Sends data using active config
  - Shows API responses

- **`content.js`**: Page interaction
  - Extracts visible text
  - Shows in-page notifications
  - Responds to background script messages

## Critical Developer Workflows

### Loading Extension for Development

```bash
# 1. Modify code
# 2. Go to chrome://extensions/
# 3. Enable "Developer mode" (top-right toggle)
# 4. Click "Load unpacked" → select project directory
# 5. For changes: click reload button on extension card
```

### Debugging

- **Popup console**: Right-click extension icon → Inspect
- **Service Worker logs**: `chrome://extensions/` → Click "Inspect" link under extension name
- **Content script console**: Open DevTools on webpage (F12) → Console tab

### Testing Locally

```bash
# Test with Ollama
ollama serve  # Terminal 1
# Configure extension with: http://localhost:11434/api/generate

# Or test with Python Flask
python app.py  # Terminal 2
# Configure extension with: http://localhost:5000/api/generate
```

## Project-Specific Patterns & Conventions

### Message Passing Protocol

**Pattern: Always include `action` field for routing**

```javascript
// From background to content
chrome.tabs.sendMessage(tabId, { action: 'extract-all-text' })

// From popup to background
chrome.runtime.sendMessage({ action: 'send-data', content: '...', dataType: 'selected_text' })

// Content handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extract-all-text') { /* handle */ }
})
```

### Storage Convention

Uses `chrome.storage.sync` (not `localStorage`) for Manifest V3 compatibility with profiles:

```javascript
// Store profiles and settings
await chrome.storage.sync.set({ 
  profiles: [
    { id: '12345', name: 'Local Ollama', url: 'http://localhost:11434', models: ['llama2', 'neural-chat'], createdAt: '...' }
  ],
  activeProfile: '12345',
  selectedModel: 'llama2'
});

// Retrieve active config
const result = await chrome.storage.sync.get(['activeProfile', 'selectedModel', 'profiles']);
const activeProfile = result.profiles.find(p => p.id === result.activeProfile);
```

### Error Handling Pattern

All API operations wrap errors and return structured responses:

```javascript
// Always return {success, error, data, timestamp} format
async function sendToApi(url, data) {
  try {
    const response = await fetch(url, { /* ... */ });
    return { success: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### UI State Management

- Use `style.display = 'none' | 'block'` for show/hide
- Store results in DOM, don't maintain separate state object
- Use `textContent` (not `innerHTML`) for user messages

### Text Extraction Strategy

```javascript
// Clone DOM, remove scripts/styles, extract text
// Then clean up whitespace aggressively
const allText = extracted
  .split('\n')
  .map(line => line.trim())
  .filter(line => line.length > 0)
  .join('\n');
```

## API Data Contract

**Request format** (POST JSON):
```json
{
  "type": "selected_text|all_text|screenshot",
  "content": "...",
  "model": "model-name",
  "pageUrl": "...",
  "pageTitle": "...",
  "timestamp": "ISO-8601"
}
```

**Expected response** (any JSON):
```json
{ "success": true, "result": "..." }
```

Extension displays raw response - API can return any JSON structure.

## Key Integration Points

### Manifest V3 Differences from V2

- No background page (use Service Worker instead)
- Service Worker sleeps after ~30 seconds of inactivity
- Cannot use certain APIs (e.g., `chrome.webRequest`)
- Must declare all permissions upfront

### Permissions Model

```json
{
  "permissions": ["contextMenus", "storage", "scripting", "activeTab", "tabCapture"],
  "host_permissions": ["<all_urls>"]
}
```

- `<all_urls>` needed to send API requests to any endpoint (including localhost)
- Screenshot requires `tabCapture` permission

### Common Gotchas

1. **Content script isolation**: Can't access window objects from background
2. **CORS**: Local API endpoints (localhost) work fine - no CORS issues
3. **Screenshot format**: Returns data URL (base64) - not raw PNG
4. **Message listener cleanup**: Always return `true` if sending async response

## File-Specific Guidance

### `manifest.json`
- Manifest V3 schema - critical for all permissions
- Update version when releasing changes
- Host permissions must include target API domains

### `background.js`
- Single entry point for all background operations
- Loads once per browser session
- Can use chrome.* APIs that content scripts cannot

### `content.js`
- Injected into every page matching `<all_urls>`
- Lightweight - avoid heavy processing
- Cannot make direct API calls (no network access)

### `popup.{html,js,css}`
- Lightweight UI - closes when user clicks elsewhere
- `popup.js` uses `chrome.tabs.query()` to get active tab
- CSS must be self-contained (no external stylesheets)

### `options.{html,js,css}`
- Opens in full page (not popup)
- Can include test/verification features
- Persist state to `chrome.storage.sync`

## Testing Checklist

- [ ] Context menus appear on right-click
- [ ] Selected text extraction works
- [ ] All visible text extraction doesn't include hidden content
- [ ] Screenshot captures visible portion (not off-screen)
- [ ] API URL saves and persists after reload
- [ ] API test connection works with valid endpoint
- [ ] Error messages display for invalid/unreachable APIs
- [ ] Popup displays response correctly
- [ ] In-page notifications appear and auto-dismiss
- [ ] Works on different page types (text-heavy, image, etc.)

## Extension Submission Notes

To publish to Chrome Web Store:
- Need privacy policy (for `chrome.storage` permission)
- Icons must be valid PNG/SVG
- Description must be under 132 characters
- Must test on Chrome version N-1 and N

---

This is a self-contained, single-purpose extension. Changes should maintain modularity - keep content script, service worker, and UI concerns separated. Refer to `README.md` for user-facing documentation.
