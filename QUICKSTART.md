# Quick Start Guide

## Get Started in 5 Minutes

### 1. Load the Extension

1. Open **Chrome** and navigate to `chrome://extensions/`
2. Toggle **"Developer mode"** (top-right corner)
3. Click **"Load unpacked"**
4. Select this folder (`api-text-sender-extension`)
5. You should see the extension in your toolbar!

### 2. Add a Server Profile

1. Click the extension icon in your toolbar
2. Click **"Configure API URL"** or the ⚙️ icon → **"Options"**
3. In the **Server Profiles** section:
   - Enter a profile name (e.g., "Local Ollama")
   - Enter the server base URL (e.g., `http://localhost:11434`)
   - Click **"Add Profile"**

### 3. Fetch Models

1. Select your profile from the **"Active Profile"** dropdown
2. Click **"Fetch Models"** button
3. Wait for models to load from your server
4. Models will appear in the **"Select Model"** dropdown

### 4. Activate the Configuration

1. Choose your profile from **"Select Active Profile"**
2. Choose a model from **"Select Model"**
3. Click **"Save Selection"**

### 5. Send Your First Request

#### Option A: From Any Webpage Using Chat Panel (NEW! 💬)
1. Navigate to any website
2. Look for the **chat panel** at the bottom-right corner
3. Click to expand it
4. Optionally select some text on the page
5. Type your question in the chat input (e.g., "Summarize this page")
6. Press Enter or click Send
7. See the AI response appear in the chat!

#### Option B: Use Context Menu
1. Select some text on a website
2. Right-click → **"Send Selected Text to API"**
3. See the response in the popup!

#### Option C: Use the Popup
1. Click the extension icon
2. Click **"Send All Text"** or **"Send Screenshot"**
3. View results instantly

---

## Example: Quick Test with Flask

**Create `test_api.py`:**
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    return jsonify({
        "success": True,
        "type": data.get('type'),
        "message": f"Received {len(data.get('content', '').split())} words"
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)
```

**Run it:**
```bash
pip install flask
python test_api.py
```

**Configure extension:** `http://localhost:5000/api/generate`

**Done!** 🎉

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Extension not appearing | Refresh `chrome://extensions/` |
| Chat panel not visible | Refresh the webpage you're viewing |
| "API URL not configured" | Open options, enter URL, click Save |
| "No text selected" | Select text before using Send Selected Text |
| API test fails | Make sure your API is running and URL is correct |
| Screenshot fails | Refresh the webpage and try again |
| Chat not responding | Check that your API endpoint is running |

---

## Next Steps

- Read the full [README.md](./README.md) for advanced features
- Check [`.github/copilot-instructions.md`](./.github/copilot-instructions.md) for development details
- Customize the extension by editing the JavaScript files
- Test with different API endpoints

Enjoy! 🚀
