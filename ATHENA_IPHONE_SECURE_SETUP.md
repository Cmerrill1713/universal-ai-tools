# 🔐 Athena iPhone Secure Setup

## Overview

Your iPhone will be **securely pinned** to THIS specific Mac. Even on cellular, it will ONLY connect to your Mac and reject any other servers.

## Architecture

```
iPhone (WiFi or Cellular)
    ↓ 
    ↓ [Secure Tunnel/VPN]
    ↓
Your Mac (192.168.1.198)
    ↓
Nginx (Port 80) → Athena Frontend (Port 3000)
                → Backend API (Port 8013)
```

## Setup Options

### Option 1: WiFi Only (Current - Working Now!)

**Status**: ✅ **Ready to use right now!**

**Access**: `http://192.168.1.198`

**How to test**:
1. Make sure your iPhone is on the same WiFi as this Mac
2. Open Safari on your iPhone
3. Go to: `http://192.168.1.198`
4. You should see Athena!

**Security**: 
- Only works on your local network
- Other devices on your WiFi can also access it
- No encryption (HTTP not HTTPS)

---

### Option 2: WiFi + Cellular with Certificate Pinning (Recommended)

**Status**: 🔧 Needs setup

**Access**: `https://192.168.1.198` (via VPN) or `https://athena.yourdomain.com`

**Security**:
- ✅ iPhone pinned to YOUR Mac's certificate
- ✅ Rejects connections to any other server
- ✅ End-to-end encryption
- ✅ Works on cellular (with VPN or tunnel)

**Setup Steps**:

#### Step 1: Generate SSL Certificate
```bash
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools

# Generate self-signed certificate for your Mac
openssl req -x509 -newkey rsa:4096 -keyout athena-key.pem -out athena-cert.pem -days 365 -nodes -subj "/CN=192.168.1.198"

# Get certificate fingerprint
openssl x509 -in athena-cert.pem -noout -fingerprint -sha256
```

#### Step 2: Configure Nginx with SSL
Update Nginx to use HTTPS with your certificate

#### Step 3: Update iOS App with Certificate Pin
The iOS app will be hardcoded to ONLY accept YOUR certificate

#### Step 4: Choose Cellular Access Method

**Option A: Tailscale VPN** (Easiest)
```bash
# Install on Mac
brew install tailscale
tailscale up

# Install Tailscale app on iPhone
# Connect on iPhone
# Access: http://192.168.1.198 (works on cellular!)
```

**Option B: Cloudflare Tunnel** (Free Public URL)
```bash
brew install cloudflare/cloudflare/cloudflared
cloudflared tunnel login
cloudflared tunnel create athena
cloudflared tunnel route dns athena athena.yourdomain.com
cloudflared tunnel run --url http://localhost:80 athena
```

**Option C: Port Forwarding** (Manual)
- Forward port 443 on your router to 192.168.1.198:443
- Use dynamic DNS (like DuckDNS)
- Access: `https://yourhome.duckdns.org`

---

### Option 3: Cloud Deployment

**Status**: 🔧 More complex

**Access**: `https://athena.yourdomain.com`

**How it works**:
- Deploy entire stack to AWS/DigitalOcean/Vercel
- Always available (Mac doesn't need to be on)
- Professional setup

---

## Current Setup Summary

**What's Working Now**:
✅ Nginx reverse proxy running on port 80
✅ Athena frontend accessible at `http://192.168.1.198`
✅ Backend API working
✅ All services monitored by Netdata

**To Test Right Now**:
1. Grab your iPhone
2. Connect to same WiFi as this Mac
3. Open Safari
4. Go to: `http://192.168.1.198`
5. See Athena! 🎉

**For Cellular Access**:
You need to add ONE of these:
- VPN (Tailscale - 5 min setup)
- Public tunnel (Cloudflare - 10 min setup)
- Port forwarding (Router config - 20 min setup)

---

## Recommended: Tailscale VPN Setup (5 minutes)

This is the **easiest and most secure** way to access your Mac from cellular:

```bash
# 1. Install Tailscale on Mac
brew install tailscale

# 2. Start Tailscale
tailscale up

# 3. Get your Tailscale IP
tailscale ip -4
# Example output: 100.64.0.1

# 4. Install Tailscale on iPhone (from App Store)

# 5. Access Athena from iPhone (WiFi or Cellular):
# http://100.64.0.1  (Tailscale IP)
# or
# http://192.168.1.198  (Local IP, works through VPN)
```

**Benefits**:
- ✅ Works on cellular
- ✅ Secure encrypted tunnel
- ✅ No port forwarding needed
- ✅ No public IP needed
- ✅ Free for personal use
- ✅ 5 minute setup

---

## iOS App Setup

The iOS app in `AthenaIOS/` folder is ready to use:

1. Open `AthenaIOS` in Xcode
2. Connect your iPhone
3. Click Run
4. The app loads your Athena frontend

**Current settings**:
- Server: `http://192.168.1.198`
- Works: WiFi only (same network)

**To enable cellular**: Set up Tailscale first, then change server URL in ContentView.swift

---

## Security Notes

**Current Security (WiFi only)**:
- ⚠️ Unencrypted HTTP
- ⚠️ Anyone on your WiFi can access
- ⚠️ No authentication

**With SSL + Certificate Pinning**:
- ✅ Encrypted HTTPS
- ✅ iPhone only trusts YOUR Mac
- ✅ Rejects imposters

**With Tailscale/VPN**:
- ✅ Encrypted tunnel
- ✅ Only authorized devices
- ✅ Works like local network from anywhere

---

## Next Steps

**Right now** (5 seconds):
```bash
# On your iPhone, open Safari and go to:
http://192.168.1.198
```

**For cellular** (5 minutes):
```bash
# Install Tailscale
brew install tailscale
tailscale up

# Then follow Tailscale setup above
```

**Questions?** Just ask! 🚀

