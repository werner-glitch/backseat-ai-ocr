# API Text & Screenshot Sender - Chrome Extension

A powerful Chrome extension (Manifest V3) that allows you to send selected text, all visible page text, or screenshots to a configurable REST API endpoint. Perfect for integration with local AI services like Ollama, local LLMs, or any HTTP API.

## Features

✨ **Multiple Data Types**
- **Send Selected Text**: Right-click on selected text to send it to your API
- **Send All Visible Text**: Extract and send all visible text from the current page
- **Send Screenshots**: Capture and send base64-encoded PNG screenshots

💬 **Chat Panel**
- **Floating Chat Interface**: Collapsible chat panel at the bottom right of every webpage
- **Context-Aware Questions**: Ask questions with automatically attached page context
- **Smart Context Selection**: Uses selected text if available, otherwise sends full page content
- **Screenshot Attachment**: Capture and send screenshots with questions directly from the chat
- **Real-time Responses**: View AI responses streamed into the chat panel
- **Always Accessible**: Toggle chat panel open/closed without leaving the page

🔧 **Multi-Profile Support**
- Create multiple server profiles (Ollama, local LLMs, public APIs)
- Switch between profiles instantly
- Each profile stores its configuration
- Automatic model discovery via /api/tags

📦 **Model Management**
- Automatically fetch available models from Ollama-compatible servers
- Select which model to use for API requests
- Model information stored per profile

📋 **Context Menu Integration**
- Right-click context menu items for quick access
- Works with text selection or anywhere on the page

⚡ **Real-time Response Display**
- View API responses in the extension popup
- View chat responses in the floating panel
- See full response data with expandable details
- Success/error indicators with timestamps

🎨 **Modern UI**
- Clean, intuitive interface for both popup and chat panel
- Responsive design (works on mobile browsers)
- Loading indicators and status messages
- In-page notifications for feedback
- Smooth animations and transitions

## Installation

### Load as Unpacked Extension

1. **Download/Clone this repository** to your local machine
   ```bash
   git clone <repository-url>
   cd api-text-sender-extension
   ```

2. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load Unpacked**
   - Click "Load unpacked"
   - Select the extension directory containing `manifest.json`

4. **Verify Installation**
   - The extension icon should appear in your Chrome toolbar
   - Right-click anywhere on a webpage to see the context menu options

## Usage

### Setup Server Profiles

1. **Open Extension Options**
   - Click the extension icon → Options
   - Or right-click extension icon → Options

2. **Add a Server Profile**
   - Enter a profile name (e.g., "Local Ollama", "OpenAI API")
   - Enter the server base URL (e.g., `http://localhost:11434`)
   - Click "Add Profile"
   - The profile will appear in "Your Profiles" list

3. **Fetch Available Models**
   - Select the profile from the "Active Profile" dropdown
   - Click "Fetch Models" button
   - The extension will query `/api/tags` endpoint
   - Available models will populate in the model dropdown
   - Models are automatically saved with the profile

4. **Select Active Configuration**
   - Choose a profile from "Select Active Profile"
   - Select a model from "Select Model"
   - Click "Save Selection"
   - Your choices are now active for all extension operations

### Send Data to API

#### Via Chat Panel (Floating on Every Page)

1. **Open Chat Panel**
   - Look for the chat panel at the bottom-right of the page
   - Click the header to expand/collapse
   - The panel slides up from the bottom

2. **Ask a Question with Context**
   - Select any text on the page (optional)
   - Type your question in the input field
   - Press Enter or click the send button
   - If text is selected: that text + your question is sent
   - If no text is selected: all visible page content + your question is sent
   - Response appears in the chat panel

3. **Send a Screenshot**
   - Click the camera/screenshot button in the chat panel
   - The extension captures the visible portion of the page
   - A message is added: "Screenshot attached - asking what to do with it"
   - Type any question you want (or let it analyze automatically)
   - The screenshot is sent to your API
   - Response appears in the chat

#### Via Context Menu (Right-Click)

- **Send Selected Text**
  1. Select text on any webpage
  2. Right-click → "Send Selected Text to API"
  3. Data sent to active profile with selected model

- **Send All Visible Text**
  1. Right-click anywhere on a page
  2. Select "Send All Visible Text to API"
  3. Extension extracts and sends all page text

- **Send Screenshot**
  1. Right-click anywhere on a page
  2. Select "Send Screenshot to API"
  3. Extension captures visible tab and sends as base64 PNG

#### Via Popup

1. Click the extension icon in toolbar
2. View your active profile and model
3. Use the three buttons:
   - **Send Selected Text**: Sends currently selected text
   - **Send All Text**: Sends all visible page text
   - **Send Screenshot**: Captures and sends screenshot
4. View API response in the popup

### API Data Format

The extension sends POST requests to your API with the following JSON structure:

**For Chat Panel Requests:**
```json
{
  "type": "selected_text_with_question|all_text_with_question|screenshot_with_question",
  "question": "What is this about?",
  "content": "...",
  "model": "selected-model-name",
  "pageUrl": "https://example.com",
  "pageTitle": "Page Title",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**For Context Menu Requests:**
```json
{
  "type": "selected_text|all_text|screenshot",
  "content": "...",
  "model": "selected-model-name",
  "pageUrl": "https://example.com",
  "pageTitle": "Page Title",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Field Descriptions:**
- `type`: The type of data being sent
  - `selected_text`: User-selected text from the page
  - `all_text`: All visible text extracted from the page
  - `screenshot`: Base64-encoded PNG screenshot
  - `selected_text_with_question`: Selected text + user question from chat
  - `all_text_with_question`: Full page text + user question from chat
  - `screenshot_with_question`: Screenshot + user question from chat
- `question`: (Chat panel only) The user's question
- `content`: The actual data content (text or base64 image)
- `model`: The selected model name from the active profile
- `pageUrl`: Full URL of the webpage
- `pageTitle`: Title of the webpage
- `timestamp`: ISO 8601 timestamp of when data was sent

### Example API Response

Your API should return a JSON response. The extension will display it in the popup:

```json
{
  "success": true,
  "message": "Data received and processed",
  "result": {
    "tokens": 42,
    "response": "The AI response goes here..."
  }
}
```

## Local API Setup Examples

### Using Ollama

If you're using [Ollama](https://ollama.ai/) locally:

```bash
# Start Ollama
ollama serve

# In a separate terminal, test the API
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"llama2","prompt":"Hello"}'
```

Configure the extension with URL: `http://localhost:11434/api/generate`

### Using Local Python Flask Server

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    
    print(f"Type: {data['type']}")
    print(f"Content: {data['content'][:100]}...")  # First 100 chars
    print(f"Page: {data['pageTitle']}")
    
    # Process data with your model/service
    response = {
        "success": True,
        "message": "Data processed",
        "tokens_received": len(data['content'].split()),
        "type": data['type']
    }
    
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True, port=11434)
```

Run with: `python app.py`

Configure extension with: `http://localhost:11434/api/generate`

## File Structure

```
api-text-sender-extension/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service Worker - handles API requests & menus
├── content.js            # Content Script - extracts page content
├── chat-panel.js         # Chat Panel Component - injected on all pages
├── popup.html            # Popup UI
├── popup.js              # Popup logic
├── popup.css             # Popup styles
├── options.html          # Options page UI
├── options.js            # Options page logic
├── options.css           # Options page styles
├── images/
│   ├── icon-16.png       # 16x16 icon
│   ├── icon-48.png       # 48x48 icon
│   └── icon-128.png      # 128x128 icon
└── README.md             # This file
```

## Code Architecture

### Manifest V3 Setup
- **Service Worker** (`background.js`): Handles all background operations
- **Content Script** (`content.js`): Interacts with page DOM
- **Chat Panel** (`chat-panel.js`): Floating UI component injected on all pages
- **Popup & Options**: Separate UI components with dedicated styling

### Key Components

**Chat Panel Component**
- Auto-injects on all webpages
- Collapsible floating interface at bottom-right
- Handles message history and streaming responses
- Communicates with background service worker
- Responsive design for mobile browsers

**Service Worker**
- Manages context menus (without icons to avoid errors)
- Routes messages from chat panel and popup
- Handles API requests with active profile config
- Manages screenshot capture
- Coordinates with content scripts

**Message Passing**
- Uses Chrome's `chrome.runtime.sendMessage()` for inter-component communication
- Supports both one-time messages and persistent channels
- Chat panel → Service Worker → API endpoint
- Service Worker → Chat Panel for responses

**Storage**
- Uses `chrome.storage.sync` for settings (syncs across Chrome devices)
- Profile configurations securely stored and retrieved
- Active profile and model selection persisted

**Error Handling**
- Try-catch blocks in all async operations
- User-friendly error messages in UI and chat panel
- Console logging for debugging
- Graceful fallbacks when API is unavailable

## Permissions Explained

- `contextMenus`: Create right-click context menu items
- `storage`: Store API URL configuration
- `scripting`: Execute content script on pages
- `activeTab`: Get information about current tab
- `tabCapture`: Capture visible tab for screenshots
- `<all_urls>`: Send requests to any API endpoint

## Troubleshooting

### Chat Panel Not Appearing
- Refresh the webpage (Ctrl+R or Cmd+R)
- Reload the extension: `chrome://extensions/` → reload button
- Check that API is configured in options

### Chat Panel Not Responding
- Verify your API endpoint is running
- Check the browser console for errors (F12 → Console)
- Look at Service Worker logs: `chrome://extensions/` → Click "Service Worker" link

### "No active profile configured"
- Open extension options
- Add a server profile
- Select it as active profile
- Select a model
- Save your selection

### "API URL not configured"
- Open extension options (click extension icon → Options)
- Enter your API endpoint URL
- Click "Save Settings"

### "No text selected on the page"
- Make sure to select text before using "Send Selected Text"
- The button will be disabled if no text is selected

### Screenshot fails
- Your browser must have permission to capture the tab
- Some sites with security restrictions may not allow screenshots

### API request fails
- Check if your API endpoint is running
- Verify the URL is correct (must start with http:// or https://)
- Use "Test API Connection" button in options
- Check API CORS settings if hosted remotely

### Content script not injected
- Refresh the webpage
- Reload the extension (`chrome://extensions/` → refresh)
- Some pages (Chrome system pages) don't allow content scripts

## Security & Privacy

- ⚠️ **No data is sent to third parties** - only to your configured API endpoint
- Settings are stored locally using `chrome.storage.sync`
- Screenshots are sent as base64-encoded images in POST requests
- HTTPS is recommended for remote APIs (not for localhost)

## Development

### Modifying the Extension

1. Edit source files as needed
2. Go to `chrome://extensions/`
3. Click reload button on the extension card
4. Changes take effect immediately (usually)

### Debugging

**Console Logs**
- Right-click extension icon → "Inspect" to see popup console
- Service Worker logs: `chrome://extensions/` → Click "Service Worker" link under extension

**Testing Locally**
- Use the "Test API Connection" button in options
- Check network requests in DevTools

## Permissions & Warnings

- First time use may show permission prompts - these are expected
- You can modify permissions in extension settings
- To disable screenshot feature: Remove `tabCapture` from permissions in `manifest.json`

## Roadmap

Potential future enhancements:
- [ ] Save/load request history
- [ ] Multiple API endpoint presets
- [ ] Custom request headers
- [ ] File upload support
- [ ] Voice input
- [ ] Response filtering/formatting
- [ ] Dark mode

## License

MIT License - Feel free to modify and distribute

## Contributing

Have suggestions or found a bug? Feel free to:
1. Test thoroughly
2. Document the issue/feature
3. Propose changes

## Support

For issues:
1. Check troubleshooting section above
2. Enable "Developer mode" in extensions to see logs
3. Verify API endpoint is running and responding correctly

---

**Happy API integration!** 🚀
