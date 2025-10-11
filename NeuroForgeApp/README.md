# 🍎 NeuroForge AI - Native macOS App

Beautiful native SwiftUI chat interface for NeuroForge AI

## ✨ Features

- 🍎 **Native macOS Design** - SwiftUI with modern macOS Big Sur+ look
- ⚡ **Direct Backend Connection** - Connects to localhost:8013
- 💬 **Real-time Chat** - Beautiful message bubbles with timestamps
- 🔔 **Connection Status** - Live indicator showing backend status
- ⌨️ **Keyboard Shortcuts** - ⌘+Enter to send, ⌘+N for new chat
- 🎨 **Dark Mode Support** - Automatically follows system theme

## 🚀 Quick Start

### Prerequisites
- macOS 13+ (Ventura or later)
- Swift 5.9+
- NeuroForge backend running on localhost:8013

### Build & Run

```bash
cd NeuroForgeApp
swift build
swift run
```

Or open in Xcode:
```bash
open Package.swift
# Press ⌘R to run
```

## 🎯 What You Can Do

From the native app, try:

```
"Search Google for Mars"        → Opens browser
"Open Calculator"                → Launches Calculator
"What's 456 times 789?"         → AI calculates
"Tell me about quantum physics"  → AI explains
"Take a screenshot"              → Takes screenshot
```

## 📊 Benefits vs Web Frontend

| Feature | Web | Native |
|---------|-----|--------|
| **Speed** | Good | ⚡ Faster |
| **Design** | React | 🍎 SwiftUI |
| **Notifications** | Browser | 🔔 Native |
| **Shortcuts** | Limited | ⌨️ Full |
| **Offline** | ❌ No | ✅ Yes |

## 🔧 Configuration

Backend URL is set to `http://localhost:8013` by default.

To change it, edit `ChatService.swift`:
```swift
private let baseURL = "http://your-backend:port"
```

## 📦 Package as .app

To create a standalone .app:

```bash
swift build -c release
# The binary will be in .build/release/NeuroForgeApp
```

## 🐛 Troubleshooting

**"Connection Failed"**
- Make sure backend is running: `docker ps`
- Test backend: `curl http://localhost:8013/health`
- Check logs: `docker logs unified-ai-assistant-api`

**"Build Failed"**
- Make sure you have Xcode Command Line Tools: `xcode-select --install`
- Check Swift version: `swift --version`

## 🎨 Customization

### Change Theme Colors
Edit `ContentView.swift`:
```swift
.foregroundColor(.purple)  // Change to your color
```

### Add Menu Bar Icon
Edit `main.swift` to add:
```swift
MenuBarExtra("🧠", systemImage: "brain.head.profile") {
    // Menu items
}
```

## 📝 License

Same as NeuroForge AI project

