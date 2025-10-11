# Athena Mobile App Setup Guide

## Overview

This guide covers connecting to Athena from mobile devices (iPhone/iPad) once the web frontend is fixed.

---

## Current Status

### ✅ Backend Ready
- **API Server:** Running on localhost:8888
- **TTS Service:** MLX Kokoro on localhost:8877
- **Knowledge Services:** Full RAG pipeline operational
- **Monitoring:** Complete observability stack

### ⚠️ Frontend Status
- **Web UI (port 3000):** Has Tailwind CSS build errors
- **Native macOS App:** ✅ Fully functional
- **Mobile Access:** Pending frontend fix

---

## Mobile Access Options

### Option 1: Web Frontend (Recommended - Pending Fix)

Once `athena-frontend` is fixed:

#### Local Network Access (iPhone on same WiFi)
```
1. Get your Mac's local IP:
   ifconfig | grep "inet " | grep -v 127.0.0.1

2. On iPhone Safari, visit:
   http://[YOUR_MAC_IP]:3000
   Example: http://192.168.1.198:3000

3. Add to Home Screen for app-like experience
```

#### Secure Remote Access (Cellular)
```
1. Set up Cloudflare Tunnel:
   cloudflared tunnel --url http://localhost:3000

2. Or use Nginx + Let's Encrypt:
   - Configure SSL certificate
   - Set up domain name
   - Use certificate pinning for security

See: ATHENA_IPHONE_SECURE_SETUP.md
```

### Option 2: Native iOS App (Swift)

Build a native iOS companion app:

#### SwiftUI WebView Wrapper
```swift
// AthenaIOS/ContentView.swift
import SwiftUI
import WebKit

struct ContentView: View {
    let serverURL = "http://192.168.1.198:3000" // Your Mac's IP
    
    var body: some View {
        WebView(url: URL(string: serverURL)!)
            .edgesIgnoringSafeArea(.all)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        return WKWebView()
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        webView.load(request)
    }
}
```

#### Or Native Swift Chat UI
Build a native iOS app similar to the macOS Athena.app:
- Reuse ChatService, VoiceRecorder
- SwiftUI for iOS interface
- Connect to same backend (localhost:8888)

---

## Frontend Fix Options

### Quick Fix: Use Development Server

Instead of Docker container, run Next.js directly:

```bash
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools

# Install dependencies
npm install

# Start development server
npm run dev

# Access on:
# - Mac: http://localhost:3000
# - iPhone: http://[MAC_IP]:3000
```

### Proper Fix: Rebuild Docker Container

1. **Fix Tailwind Config**
```bash
# Ensure postcss.config.js exists
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Ensure tailwind.config.js exists
# ... (tailwind config)
```

2. **Rebuild Container**
```bash
docker build -t athena-frontend:latest .
docker run -d --name athena-frontend -p 3000:3000 athena-frontend:latest
```

### Alternative: Use Streamlit/Gradio

Simple Python-based UI:
```python
# quick_frontend.py
import streamlit as st
import requests

st.title("Athena")
message = st.text_input("Your message:")
if st.button("Send"):
    response = requests.post(
        "http://localhost:8888/api/chat",
        json={"message": message, "request_id": "web"}
    )
    st.write(response.json()["response"])

# Run: streamlit run quick_frontend.py --server.port 3000
```

---

## Network Configuration

### For Local Network Access

#### On Mac (Server):
```bash
# Check firewall allows port 3000
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /path/to/node

# Or disable firewall temporarily
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

#### On iPhone:
1. Connect to same WiFi as Mac
2. Open Safari
3. Navigate to: `http://[MAC_IP]:3000`
4. Tap Share → Add to Home Screen

### For Cellular Access

#### Option A: Cloudflare Tunnel (Easiest)
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Create tunnel
cloudflared tunnel --url http://localhost:3000

# Get public URL (e.g., https://xyz.trycloudflare.com)
# Use on iPhone anywhere
```

#### Option B: Nginx + Let's Encrypt (Most Secure)
```bash
# Install nginx
brew install nginx

# Configure SSL
# Get domain name
# Use certbot for Let's Encrypt
# Set up certificate pinning

See: ATHENA_IPHONE_SECURE_SETUP.md (already created)
```

---

## Mobile-Specific Features to Add

### When Frontend is Working:

#### 1. PWA (Progressive Web App)
```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
})

module.exports = withPWA({
  // your config
})
```

Benefits:
- Installable on iPhone
- Offline support
- Push notifications
- App-like experience

#### 2. Mobile-Optimized UI
```css
/* Responsive design */
@media (max-width: 768px) {
  .chat-container {
    height: 100vh;
    padding: 1rem;
  }
}
```

#### 3. Voice Input Button
```javascript
// Add microphone button for mobile
<button onClick={startVoiceInput}>
  🎤 Tap to Speak
</button>
```

#### 4. Touch Gestures
```javascript
// Swipe to delete messages
// Pull to refresh
// Long-press for options
```

---

## API Endpoints for Mobile

All accessible from iPhone when on same network:

### Chat
```
POST http://[MAC_IP]:8888/api/chat
Body: {"message": "Hello", "request_id": "mobile"}
```

### TTS
```
POST http://[MAC_IP]:8888/api/tts/speak
Body: {"text": "Hello", "voice": "sarah", "speed": "normal"}
```

### WebSocket (Real-time)
```
ws://[MAC_IP]:8888/ws/chat
```

### Health Check
```
GET http://[MAC_IP]:8888/health
```

---

## Current System Status for Mobile

### ✅ Ready Now:
- Backend API fully functional
- TTS with natural voices
- RAG pipeline operational
- Knowledge grounding working
- WebSocket support available

### ⚠️ Needs Fixing:
- Web frontend (athena-frontend) has build errors
- Once fixed, mobile can connect immediately

### 🎯 Workaround Until Fixed:
Use native macOS Athena.app on your Mac
- All features working
- Full RAG + TTS + monitoring
- Can develop/test chat tuning

---

## Testing Mobile Connection

### Quick Test (when frontend is fixed):
```bash
# On Mac - get your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# On iPhone - open Safari
# Navigate to: http://[MAC_IP]:3000

# Should see Athena web interface
```

### API Test from iPhone:
```
# On iPhone - use Shortcuts app or any HTTP client
# Test API connection:
GET http://[MAC_IP]:8888/health

# Should return:
{
  "status": "healthy",
  "service": "universal-ai-tools-api"
}
```

---

## Security Considerations

### Local Network (Safe)
- Only accessible on your WiFi
- No internet exposure
- Good for development/testing

### Cellular/Internet (Use with Caution)
- Requires SSL/TLS (Let's Encrypt)
- Use certificate pinning
- Consider authentication
- Rate limiting recommended

See full security guide: `ATHENA_IPHONE_SECURE_SETUP.md`

---

## Next Steps

### Immediate (For Native App):
1. ✅ Athena.app is fully working
2. ✅ All backend services operational
3. ✅ RAG + TTS + monitoring ready
4. 🎯 Start using for chat tuning

### Short Term (For Mobile):
1. Fix athena-frontend build errors
2. Test on iPhone via local WiFi
3. Add mobile-optimized UI elements
4. Enable PWA features

### Long Term:
1. Build native iOS app
2. Set up secure remote access
3. Add push notifications
4. Implement offline mode

---

## Resources

- **Secure Setup:** `ATHENA_IPHONE_SECURE_SETUP.md`
- **Container Status:** `CURRENT_SYSTEM_STATUS.md`
- **Audit Report:** `CONTAINER_AUDIT_REPORT.md`
- **System Architecture:** `WEAVIATE_VS_KNOWLEDGE_SERVICES.md`

---

*Last Updated: 2025-10-11*  
*Native App: ✅ Fully Functional*  
*Mobile Web: ⚠️ Pending frontend fix*

