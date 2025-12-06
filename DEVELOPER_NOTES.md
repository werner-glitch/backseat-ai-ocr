# Developer Notes: Chat Panel Implementation

## 🏗️ Architecture Overview

### Component Hierarchy
```
manifest.json (Manifest V3 Configuration)
│
├─ background.js (Service Worker)
│  ├─ Context menu creation
│  ├─ Message routing
│  └─ API coordination
│
├─ content.js (Content Script)
│  └─ Page interaction helpers
│
└─ chat-panel.js (NEW! Chat Component)
   ├─ ChatPanel class
   ├─ UI injection
   └─ User interaction
```

### Message Flow Architecture

```
USER_INPUT (Chat Panel)
    ↓
chrome.runtime.sendMessage({
  action: 'send-chat-message',
  question: '...',
  context: '...'
})
    ↓
background.js (Message Handler)
    ├─ getActiveConfig()
    ├─ Prepare request body
    └─ sendToApi()
    ↓
API Endpoint (/api/generate)
    ↓
Response JSON
    ↓
background.js (Send Response)
    ↓
chrome.runtime.sendMessage (Response)
    ↓
chat-panel.js (addMessage())
    ↓
UI UPDATE (Chat Panel Display)
```

---

## 🔧 Key Implementation Details

### 1. ChatPanel Class Structure

```javascript
class ChatPanel {
  constructor()              // Initialize state
  init()                    // Setup and inject
  createPanelHTML()         // Create DOM
  attachEventListeners()    // Register handlers
  setupStyles()             // Embed CSS
  togglePanel()             // Open/close
  handleSendMessage()       // Process user input
  handleScreenshot()        // Capture screen
  addMessage()              // Display message
  showTypingIndicator()     // Loading animation
  removeTypingIndicator()   // Cleanup animation
}
```

### 2. CSS Embedding Pattern

All CSS is embedded in a `<style>` tag dynamically:
```javascript
const style = document.createElement('style');
style.id = 'ai-chat-panel-styles';
style.textContent = `...all CSS...`;
document.head.appendChild(style);
```

**Benefits:**
- Single file (no external CSS)
- No MIME type issues
- CSS scoped to page
- Easy to override

### 3. Message Passing Protocol

**From Chat Panel to Background:**
```javascript
chrome.runtime.sendMessage({
  action: 'send-chat-message',      // Route identifier
  question: string,                 // User's question
  context: string,                  // Page content or selected text
  dataType: string,                 // Type classification
  pageUrl: string,                  // Current URL
  pageTitle: string                 // Page title
}, callback);                        // Response handler
```

**From Background to Chat Panel:**
```javascript
callback({
  success: boolean,
  data: {
    response: string,               // AI response
    tokens: number,                 // Token count
    // ... or any JSON from API
  },
  error: string                     // If failed
});
```

### 4. Screenshot Capture Flow

```javascript
chrome.runtime.sendMessage(
  { action: 'capture-screenshot' },
  (response) => {
    response.screenshot  // Base64 PNG data URL
                        // Format: data:image/png;base64,...
  }
);
```

---

## 📊 Data Types

### New Request Types in `background.js`

```javascript
// From chat panel
'selected_text_with_question'     // Selected text + user question
'all_text_with_question'          // Full page + user question
'screenshot_with_question'        // Screenshot + user question

// Existing (from context menu) - still supported
'selected_text'                   // Just selected text
'all_text'                        // Just full page
'screenshot'                      // Just screenshot
```

### Request Body Structure

```json
{
  "type": "selected_text_with_question",
  "question": "What is this?",
  "content": "The selected text or full page content",
  "model": "llama2",
  "pageUrl": "https://example.com/page",
  "pageTitle": "Page Title",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## 🎨 CSS Architecture

### Core Classes
- `.ai-chat-panel-container` - Wrapper (fixed positioning)
- `.ai-chat-panel` - Main container (with transform animation)
- `.ai-chat-panel-open` - Open state
- `.ai-chat-panel-closed` - Closed state
- `.ai-chat-message` - Individual message
- `.ai-chat-message.user` - User message styling
- `.ai-chat-message.assistant` - AI message styling

### Animation Classes
- `.ai-chat-panel` - Slide-up/down with transform
- `.ai-chat-message` - Fade-in animation
- `.ai-chat-typing-indicator` - Bouncing dots

### Responsive Breakpoint
```css
@media (max-width: 480px) {
  /* Mobile: Full width, reduced height */
  .ai-chat-panel {
    width: 100%;
    height: 60vh;
  }
}
```

---

## 🐛 Error Handling Strategy

### Levels of Error Handling

1. **Try-Catch Blocks** (Local errors)
```javascript
try {
  // Operation
} catch (error) {
  // User-friendly message
  this.addMessage('assistant', `Error: ${error.message}`);
}
```

2. **Response Validation** (API errors)
```javascript
if (response && response.success && response.data) {
  // Process response
} else {
  this.addMessage('assistant', `Error: ${response.error}`);
}
```

3. **Fallback Messages** (Network errors)
```javascript
chrome.runtime.sendMessage(msg, (response) => {
  if (!response) {
    this.addMessage('assistant', 'Error: No response from extension.');
  }
});
```

---

## 🔐 Security Considerations

### Content Security Policy
✅ No inline JavaScript (uses event listeners)
✅ No eval() or dangerous functions
✅ `textContent` instead of `innerHTML`
✅ No external script loading

### Data Handling
✅ Selected text sanitized via DOM APIs
✅ Screenshot is base64 (no binary injection)
✅ User input escaped with textContent
✅ No localStorage (uses chrome.storage)

### Permissions
✅ `tabCapture` - only for screenshots
✅ `scripting` - content script injection
✅ `storage` - profile configuration
✅ `contextMenus` - right-click menus

---

## 💾 Storage & State Management

### No Persistent Chat Storage
- Messages exist only during page session
- Cleared when navigating to new page
- User intended (lightweight, fresh each time)

### Profile Configuration (Persisted)
```javascript
// Stored in chrome.storage.sync
{
  profiles: [
    {
      id: 'timestamp-id',
      name: 'Local Ollama',
      url: 'http://localhost:11434',
      models: ['llama2', 'neural-chat'],
      createdAt: 'ISO-8601'
    }
  ],
  activeProfile: 'timestamp-id',
  selectedModel: 'llama2'
}
```

---

## 🔄 Lifecycle Events

### Page Load
1. Content scripts injected (content.js, chat-panel.js)
2. ChatPanel class instantiated
3. `init()` called → HTML injected → Styles applied
4. Event listeners attached
5. Panel ready for use

### User Action: Send Message
1. User types question
2. User presses Enter or clicks Send
3. `handleSendMessage()` triggered
4. Selected text checked
5. Message added to UI
6. Background service worker contacted
7. API request sent
8. Response received
9. Message added to UI

### Page Navigation
1. Content scripts unloaded
2. Chat panel destroyed (DOM removed)
3. New page loads
4. Fresh chat panel injected
5. Cycle repeats

---

## 🧪 Testing Guide

### Manual Testing Checklist

```javascript
// Test 1: Panel Injection
✓ Navigate to any webpage
✓ See chat panel at bottom-right
✓ Click to expand/collapse

// Test 2: Text Input
✓ Type message in input field
✓ Press Enter → message sends
✓ Message appears as user message

// Test 3: Selected Text Context
✓ Select text on page
✓ Type question
✓ Send → selected text included

// Test 4: Full Page Context
✓ Deselect all text
✓ Type question
✓ Send → full page content included

// Test 5: Screenshot Feature
✓ Click camera button
✓ Screenshot captured
✓ Message appears in chat
✓ Send with question

// Test 6: API Response
✓ Message appears with AI response
✓ Typing indicator shown while waiting
✓ Error message if API fails

// Test 7: Mobile Responsiveness
✓ Open on mobile viewport
✓ Panel width adjusts
✓ Touch interactions work

// Test 8: Integration
✓ Old context menu items still work
✓ Popup still functional
✓ Options page still accessible
```

### API Testing with cURL

```bash
# Test endpoint
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "all_text_with_question",
    "question": "What is this?",
    "content": "Sample text",
    "model": "llama2",
    "pageUrl": "http://test.com",
    "pageTitle": "Test",
    "timestamp": "2024-01-01T00:00:00Z"
  }'
```

---

## 📝 Common Modifications

### Change Panel Position
```javascript
// In setupStyles(), modify:
.ai-chat-panel {
  bottom: 0;        // ← Change this
  right: 20px;      // ← Or this
}
```

### Change Colors
```css
.ai-chat-message.user .ai-chat-message-content {
  background: #007bff;  /* ← Change user message color */
}

.ai-chat-message.assistant .ai-chat-message-content {
  background: #e9ecef;  /* ← Change AI message color */
}
```

### Change Panel Width
```css
.ai-chat-panel {
  width: 380px;  /* ← Default width, increase for wider panel */
}
```

### Change Animation Speed
```css
.ai-chat-panel {
  transition: transform 0.3s ease-out;  /* ← Change duration */
}
```

---

## 🚀 Performance Optimization Tips

### 1. Limit Page Content Size
Currently limited to 3000 chars - adjust in `handleSendMessage()`:
```javascript
.substring(0, 3000)  // ← Change this number
```

### 2. Message History Limit (Optional)
Add max messages to prevent memory bloat:
```javascript
if (this.messagesContainer.children.length > 50) {
  this.messagesContainer.firstChild.remove();
}
```

### 3. Debounce Input (Optional)
Prevent rapid-fire sending:
```javascript
if (this.isWaitingForResponse) return;
```

### 4. Reduce Animation Complexity
Remove animations if needed:
```css
animation: none;  /* Disable animations */
```

---

## 🔗 Integration Points

### With Background Service Worker
- Message handler: `send-chat-message`
- Message handler: `capture-screenshot`
- Uses `getActiveConfig()` for profile
- Uses `sendToApi()` for API calls

### With Content Script
- Shares page context extraction logic
- Could be further refactored to shared utility

### With Options Page
- Uses same `chrome.storage.sync` API
- Reads same profile configuration
- No direct communication (uses background worker)

### With Popup
- Independent UI component
- Same messaging protocol
- Both send to background worker

---

## 📚 Code Comments & Documentation

All functions have JSDoc comments:

```javascript
/**
 * Handle sending a message
 * @async
 * @returns {Promise<void>}
 */
async handleSendMessage() {
  // Implementation
}
```

Inline comments explain complex logic:

```javascript
// Show typing indicator
this.showTypingIndicator();

// Send to background script
chrome.runtime.sendMessage(...);
```

---

## 🎓 Learning Path

### Understanding the Code
1. Start with `chat-panel.js` constructor
2. Read `init()` method
3. Follow message handling flow
4. Check CSS setup
5. Review background.js integration

### Modifying the Code
1. Change HTML in `createPanelHTML()`
2. Update CSS in `setupStyles()`
3. Modify handlers (send, screenshot)
4. Test changes with reload

### Debugging
1. F12 on webpage → Console
2. Check chat-panel.js logs
3. F12 → Network tab to see API requests
4. chrome://extensions → Service Worker console

---

## 🤔 FAQ for Developers

**Q: Why embed CSS instead of external file?**
A: Simpler distribution, no MIME type issues, single self-contained file.

**Q: Why not use a framework?**
A: Vanilla JS is simpler, faster, no build step, matches existing code.

**Q: Can I store messages between sessions?**
A: Yes - modify `addMessage()` to save to `chrome.storage.local`.

**Q: Can I add custom message types?**
A: Yes - add to `dataType` in `handleSendMessage()` and update background.js.

**Q: How do I change the panel theme?**
A: Modify color values in `.setupStyles()` CSS section.

**Q: Can I add more buttons?**
A: Yes - add HTML in `createPanelHTML()`, CSS in `setupStyles()`, handler in `attachEventListeners()`.

---

## 📖 Related Files

- `manifest.json` - Extension configuration
- `background.js` - API and message coordination
- `content.js` - Page text extraction helpers
- `README.md` - User documentation
- `CHAT_PANEL_GUIDE.md` - Visual guide for users

---

**Last Updated**: December 5, 2025
**Status**: Complete & Production Ready
