# Cellular Network Setup Guide for iOS Companion App

## Current Status
The app currently connects to `localhost:9999` which only works:
- ✅ In the iOS Simulator (running on your Mac)
- ❌ On physical iPhone over cellular
- ⚠️  On physical iPhone over WiFi (needs Mac's local IP)

## Quick Setup Options

### Option 1: ngrok (Easiest for Testing)

1. **Install ngrok**:
```bash
brew install ngrok
```

2. **Create free ngrok account** at https://ngrok.com and get auth token

3. **Configure ngrok**:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

4. **Start ngrok tunnel**:
```bash
# In one terminal, start your server
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run dev

# In another terminal, start ngrok
ngrok http 9999
```

5. **Update iOS app** with ngrok URL:
```swift
// In NetworkConfig.swift, update:
environment = .ngrok(subdomain: "your-ngrok-subdomain")
// Or use the full URL provided by ngrok
environment = .public(url: "https://abc123.ngrok-free.app")
```

### Option 2: Tailscale VPN (Best for Personal Use)

1. **Install Tailscale** on Mac and iPhone
2. **Connect both devices** to your Tailscale network
3. **Use Tailscale IP** in the app:
```swift
environment = .localNetwork(ip: "100.x.x.x") // Your Mac's Tailscale IP
```

### Option 3: Cloud Deployment (Best for Production)

1. **Deploy to cloud provider** (DigitalOcean, AWS, etc.)
2. **Update NetworkConfig.swift**:
```swift
environment = .public(url: "https://your-server.com:9999")
```

## Security Considerations

### For Testing (ngrok/Tailscale):
- ✅ Good for development and personal use
- ⚠️  ngrok URLs are public (use authentication)
- ✅ Tailscale is private VPN (more secure)

### For Production:
- 🔒 Use HTTPS with valid SSL certificate
- 🔑 Implement proper authentication (JWT tokens already in place)
- 🛡️ Add rate limiting and DDoS protection
- 📊 Monitor usage and costs

## Quick Test

1. **Start ngrok**:
```bash
ngrok http 9999
```

2. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

3. **Update IntelligentChatService.swift temporarily**:
```swift
private let baseURL = "https://abc123.ngrok-free.app"
```

4. **Rebuild and test** on physical device

## Automatic Network Detection

The NetworkConfig.swift file includes logic to:
- Use `localhost` on simulator
- Use local IP on same WiFi network
- Use ngrok/public server on cellular

This allows the app to work seamlessly across different network conditions.