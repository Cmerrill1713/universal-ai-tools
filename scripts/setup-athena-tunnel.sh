#!/bin/bash

# =============================================================================
# Athena Secure Tunnel Setup
# =============================================================================
# This creates a secure connection between your iPhone and this Mac
# =============================================================================

echo "🔐 Setting up secure Athena tunnel..."

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📦 Installing Cloudflare Tunnel..."
    brew install cloudflare/cloudflare/cloudflared
fi

# Get local IP
LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
echo "📍 Your Mac's IP: $LOCAL_IP"

echo ""
echo "✅ Choose your setup:"
echo ""
echo "1. Local WiFi Only (Current Setup)"
echo "   - Access: http://$LOCAL_IP"
echo "   - Works: Only on same WiFi"
echo "   - Security: Local network only"
echo ""
echo "2. Cloudflare Tunnel (WiFi + Cellular)"
echo "   - Access: https://athena.yourdomain.com"
echo "   - Works: Anywhere (WiFi + Cellular)"
echo "   - Security: End-to-end encrypted tunnel"
echo ""
echo "3. Self-Signed Certificate (WiFi + Cellular via IP)"
echo "   - Access: https://$LOCAL_IP (with certificate pinning)"
echo "   - Works: WiFi + Cellular (with VPN or port forward)"
echo "   - Security: Pinned to YOUR certificate"
echo ""

read -p "Enter choice (1/2/3): " choice

case $choice in
    1)
        echo "✅ Already set up! Access Athena at: http://$LOCAL_IP"
        ;;
    2)
        echo "🌐 Setting up Cloudflare Tunnel..."
        echo "This will:"
        echo "  1. Create a secure tunnel from your Mac to Cloudflare"
        echo "  2. Give you a public URL"
        echo "  3. Work on WiFi AND cellular"
        echo ""
        cloudflared tunnel login
        ;;
    3)
        echo "🔐 Setting up self-signed certificate with pinning..."
        ./setup-ssl-pinning.sh
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

