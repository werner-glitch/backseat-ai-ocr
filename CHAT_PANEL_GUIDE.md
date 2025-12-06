# Chat Panel - Visual Guide

## 🎯 Where You'll See It

The chat panel appears at the **bottom-right corner of every webpage**:

```
┌─────────────────────────────────────────────────────┐
│                   Example Website                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Website content...                                │
│                                                     │
│                                                     │
│                            ┌─────────────────────┐ │
│                            │ Chat with AI    [^]│ │
│                            ├─────────────────────┤ │
│                            │ User: What is this? │ │
│                            │ AI: This is...      │ │
│                            ├─────────────────────┤ │
│                            │[Input field...    ]\│ │
│                            │[Send] [Screenshot] │ │
│                            └─────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## 💬 Chat Panel Layout

### When Minimized (Closed)
```
┌─────────────────┐
│ Chat with AI [^]│  <- Click to open
└─────────────────┘
```

### When Expanded (Open)
```
┌──────────────────────────┐
│ Chat with AI         [v] │  <- Click to close
├──────────────────────────┤
│ AI: Hello! How can I     │
│     help?                │
│                          │
│ You: What is this page?  │
│                          │
│ AI: This page contains   │
│     information about... │
├──────────────────────────┤
│ [Type here...         ]\ │  <- Text input
│ [Send] [Screenshot]      │  <- Action buttons
├──────────────────────────┤
│   Configured API         │  <- Status footer
└──────────────────────────┘
```

---

## 🎮 How to Use - Step by Step

### Step 1: Open Chat Panel
```
1. Scroll to bottom-right of webpage
2. Look for "Chat with AI" panel
3. Click the header to expand it
```

### Step 2: Ask a Question

**Option A: No Context**
```
[Type your question...]
"What is the main topic of this page?"
[Press Enter or Click Send Button]
```

**Option B: With Selected Text**
```
1. Select some text on the page with mouse
2. Type your question in chat input
3. Send
→ Both selected text + question sent to AI
```

**Option C: With Screenshot**
```
1. Click the camera button [📷]
2. Extension captures visible portion
3. Type your question (optional)
4. Send
→ Screenshot + question sent to AI
```

### Step 3: See Response
```
Panel shows:
- Typing indicator (dots bouncing)
- Then AI response appears
- You can continue asking more questions
```

---

## 🎨 Visual Workflow Diagram

```
┌──────────────────────────────┐
│ User opens any webpage       │
└──────────────┬───────────────┘
               ↓
        ┌──────────────┐
        │ Chat panel   │
        │ appears at   │◄────── Loaded automatically
        │ bottom-right │
        └──────────────┘
               ↓
        ┌──────────────────────┐
        │ User types question: │
        │ "Summarize this"     │
        └──────┬───────────────┘
               ↓
    ┌─────────────────────────────────┐
    │ Chat checks for selected text   │
    │ If selected: include it         │
    │ If not: use full page content   │
    └──────┬────────────────────────┬─┘
           │                        │
    ┌──────▼────────┐      ┌────────▼──────┐
    │ Sends to      │      │ Captures      │
    │ Active API    │      │ screenshot    │
    │ Endpoint      │      │ if requested  │
    └──────┬────────┘      └────────┬──────┘
           └──────────┬─────────────┘
                      ↓
           ┌────────────────────┐
           │ Background Service │
           │ Worker processes   │
           │ request            │
           └────────┬───────────┘
                    ↓
           ┌────────────────────┐
           │ Sends POST to API: │
           │ {question, content}│
           └────────┬───────────┘
                    ↓
           ┌────────────────────┐
           │ API responds with  │
           │ {"response": "..."}│
           └────────┬───────────┘
                    ↓
           ┌────────────────────┐
           │ Response appears   │
           │ in chat panel      │
           └────────────────────┘
```

---

## 📱 Keyboard Shortcuts

| Action | Key |
|--------|-----|
| Send Message | `Enter` |
| New Line | `Shift + Enter` |
| Focus Chat Input | Click in text field |
| Open/Close Panel | Click header |

---

## 🎯 Common Use Cases

### Use Case 1: Quick Question
```
1. Reading article
2. Want a quick explanation
3. Type question in chat
4. Get instant answer
```

### Use Case 2: Analyze Selected Text
```
1. Found important paragraph
2. Select it with mouse
3. Type: "Explain this in simple terms"
4. Send
→ AI explains just that selected part
```

### Use Case 3: Screenshot Analysis
```
1. Complex diagram on page
2. Click camera button
3. Screenshot captured automatically
4. Type: "What does this diagram show?"
5. Send
→ AI analyzes the screenshot
```

### Use Case 4: Full Page Summary
```
1. Long article
2. No text selected
3. Type: "Summarize this article"
4. Send
→ AI summarizes entire visible content
```

---

## ⚙️ Configuration

### Before Using Chat Panel

1. **Configure API Endpoint**
   - Click extension icon → Options
   - Add a server profile (e.g., http://localhost:11434)
   - Fetch available models
   - Save selection

2. **Select Active Model**
   - Choose which model to use
   - Same model used for chat panel and context menus

### When Using Chat Panel

- Chat automatically uses your active profile
- If no profile is set, you'll see an error message
- Switch profiles in options, then use chat panel

---

## 🔴 What Happens on Error

### API Not Running
```
❌ Error: Could not reach API endpoint
Try: Start your API server and try again
```

### No Profile Configured
```
❌ Error: No active profile configured
Try: Open options and set up a profile
```

### Network Error
```
❌ Error: [specific error message]
Try: Check API is running, check internet connection
```

---

## 💡 Pro Tips

1. **Keep Panel Open While Reading**
   - Open it once, keep it minimized
   - Easy access without re-opening

2. **Use Selected Text for Context**
   - Select specific parts before asking
   - Gets more accurate answers

3. **Screenshots for Visual Elements**
   - Use camera button for diagrams/images
   - AI can analyze what it sees

4. **Check Your API Response Format**
   - API can return any JSON
   - Panel displays the response as-is

5. **Combine Methods**
   - Use context menu for quick actions
   - Use chat panel for conversations

---

## 📊 Message Flow

```
BROWSER                          EXTENSION             API SERVER
  │                                 │                      │
  │  Type question                  │                      │
  ├────────────────────────────────►│                      │
  │                                 │                      │
  │                                 │  Get selected text   │
  │                    ┌────────────┤────────┐             │
  │                    │            │        │             │
  │                    │ No text    │ Extract all page    │
  │                    │ selected?  │ content             │
  │                    │            │        │             │
  │                    └────────────┼────────┘             │
  │                                 │                      │
  │                                 │  POST /api/generate │
  │                                 │  {question, content}│
  │                                 ├─────────────────────►│
  │                                 │                      │
  │                                 │                      │ Process...
  │                                 │                      │
  │                                 │  {"response": "..."}│
  │                                 │◄─────────────────────┤
  │                                 │                      │
  │  Show response in chat          │                      │
  │◄────────────────────────────────┤                      │
  │                                 │                      │
```

---

## 🚀 Getting Started Now

1. **Load extension**: `chrome://extensions/` → Load unpacked
2. **Configure**: Click extension → Options → Add profile
3. **Use chat**: Navigate to any webpage, see panel at bottom-right
4. **Ask questions**: Type and press Enter!

**That's it!** 🎉

The chat panel is ready to help!
