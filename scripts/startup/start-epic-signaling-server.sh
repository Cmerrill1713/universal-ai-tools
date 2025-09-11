#!/bin/bash

# Start Epic's Official Pixel Streaming Signaling Server
# This uses the standard implementation without custom messages

echo "🚀 Starting Epic Pixel Streaming Signaling Server"
echo "=============================================="

# Kill any existing signaling servers on port 8888
lsof -ti:8888 | xargs kill -9 2>/dev/null

# Check if we have the Epic signaling server
EPIC_SIGNALING="/Users/Shared/Epic Games/UE_5.6/Engine/Source/Programs/PixelStreaming/WebServers/SignallingWebServer"

if [ ! -d "$EPIC_SIGNALING" ]; then
    echo "❌ Epic signaling server not found at expected location"
    echo "   Looking for alternative locations..."
    
    # Try to find it
    EPIC_SIGNALING=$(find "/Users/Shared/Epic Games" -name "SignallingWebServer" -type d 2>/dev/null | head -1)
    
    if [ -z "$EPIC_SIGNALING" ]; then
        echo "❌ Could not find Epic signaling server"
        echo ""
        echo "Alternative: Use the minimal UE5 signaling server:"
        echo ""
        # Create a minimal UE5-compatible signaling server
        cat > ue5-minimal-signaling.mjs << 'EOF'
#!/usr/bin/env node
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = 8888;
const server = createServer((req, res) => {
  res.writeHead(426, { 'Content-Type': 'text/plain' });
  res.end('WebSocket upgrade required');
});

const wss = new WebSocketServer({ server });
const clients = new Map();

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).substr(2, 9);
  clients.set(id, ws);
  
  // Send config message that UE5 expects
  ws.send(JSON.stringify({ 
    type: 'config', 
    peerConnectionOptions: {} 
  }));
  
  ws.on('message', (msg) => {
    const data = JSON.parse(msg.toString());
    
    // Route messages between peers
    if (data.type === 'offer' || data.type === 'answer' || data.type === 'iceCandidate') {
      clients.forEach((client, clientId) => {
        if (clientId !== id && client.readyState === ws.OPEN) {
          client.send(msg.toString());
        }
      });
    }
  });
  
  ws.on('close', () => clients.delete(id));
});

server.listen(PORT, () => {
  console.log(`✅ UE5 Minimal Signaling Server running on ws://127.0.0.1:${PORT}`);
});
EOF
        chmod +x ue5-minimal-signaling.mjs
        node ue5-minimal-signaling.mjs
        exit 0
    fi
fi

echo "✅ Found Epic signaling server at: $EPIC_SIGNALING"

# Navigate to the signaling server directory
cd "$EPIC_SIGNALING"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo ""
echo "🚀 Starting server on port 8888..."
echo ""
node cirrus.js --HttpPort=8090 --SFUPort=8889 --WebSocketSignallingPort=8888