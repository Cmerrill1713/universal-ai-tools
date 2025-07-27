#!/bin/bash

echo "🌸 Sweet Athena Complete Launch Script"
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Kill all existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx" 2>/dev/null || true
pkill -f "node.*server" 2>/dev/null || true
pkill -f "UnrealEditor" 2>/dev/null || true
pkill -f "StartPixelStreaming" 2>/dev/null || true
lsof -ti:9999,8080,8081,8888,8765,8766 | xargs kill -9 2>/dev/null || true
sleep 3

# Step 1: Start the minimal backend (without hanging issues)
echo ""
echo "📦 1/4 Starting backend API (minimal mode)..."
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run start:minimal > /tmp/sweet-athena-backend-minimal.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Step 2: Start Pixel Streaming Signaling Server
echo ""
echo "📡 2/4 Starting Pixel Streaming signaling server..."
cd ~/UE5-SweetAthena/Scripts

# Create a simple signaling server if the script has issues
cat > /tmp/simple-signaling-server.js << 'EOF'
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const clients = new Map();
let ue5Client = null;

wss.on('connection', (ws, req) => {
  const clientId = Date.now().toString();
  
  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'identify' && data.source === 'ue5') {
      ue5Client = ws;
      console.log('UE5 connected');
    } else if (data.type === 'offer' && ue5Client) {
      ue5Client.send(JSON.stringify({
        type: 'offer',
        offer: data.offer,
        clientId: clientId
      }));
    } else if (data.type === 'answer' && clients.has(data.clientId)) {
      clients.get(data.clientId).send(JSON.stringify({
        type: 'answer',
        answer: data.answer
      }));
    } else if (data.type === 'ice') {
      // Forward ICE candidates
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  });
  
  ws.on('close', () => {
    if (ws === ue5Client) {
      ue5Client = null;
      console.log('UE5 disconnected');
    }
    clients.delete(clientId);
  });
  
  if (ws !== ue5Client) {
    clients.set(clientId, ws);
  }
});

server.listen(8080, () => {
  console.log('Signaling server running on port 8080');
});
EOF

node /tmp/simple-signaling-server.js > /tmp/signaling-server.log 2>&1 &
SIGNAL_PID=$!
echo "   Signaling server PID: $SIGNAL_PID"

# Step 3: Create updated viewer with better error handling
echo ""
echo "🌐 3/4 Creating enhanced viewer..."
cat > ~/Desktop/sweet-athena-viewer-fixed.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Sweet Athena - Photorealistic Avatar</title>
    <style>
        body {
            margin: 0;
            background: #0a0a0a;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
        }
        #container {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        #videoContainer {
            width: 100%;
            height: 100%;
            background: #000;
        }
        #remoteVideo {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .status {
            position: absolute;
            top: 20px;
            left: 20px;
            background: rgba(0,0,0,0.8);
            padding: 15px 25px;
            border-radius: 10px;
            font-size: 14px;
        }
        .status.connected { border-left: 4px solid #4CAF50; }
        .status.connecting { border-left: 4px solid #FFC107; }
        .status.error { border-left: 4px solid #F44336; }
        .controls {
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 15px;
            background: rgba(0,0,0,0.8);
            padding: 20px;
            border-radius: 15px;
        }
        button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .loading {
            text-align: center;
            font-size: 24px;
        }
        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .debug {
            position: absolute;
            bottom: 10px;
            right: 10px;
            font-size: 12px;
            opacity: 0.6;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="videoContainer">
            <video id="remoteVideo" autoplay playsinline muted></video>
            <div class="loading" id="loading">
                <div class="loading-spinner"></div>
                <p>🌸 Connecting to Sweet Athena...</p>
                <small>Waiting for UE5 Pixel Streaming...</small>
            </div>
        </div>
        
        <div class="status connecting" id="status">
            <strong>Status:</strong> <span id="statusText">Initializing...</span>
        </div>
        
        <div class="controls" id="controls" style="display: none;">
            <button onclick="changePersonality('sweet')">Sweet</button>
            <button onclick="changePersonality('confident')">Confident</button>
            <button onclick="changePersonality('playful')">Playful</button>
            <button onclick="changePersonality('shy')">Shy</button>
            <button onclick="changePersonality('caring')">Caring</button>
        </div>
        
        <div class="debug" id="debug"></div>
    </div>
    
    <script>
        let pc = null;
        let ws = null;
        let reconnectTimer = null;
        let statsInterval = null;
        
        function updateStatus(text, type = 'connecting') {
            const statusEl = document.getElementById('status');
            const statusTextEl = document.getElementById('statusText');
            statusEl.className = 'status ' + type;
            statusTextEl.textContent = text;
            console.log(`[Status] ${type}: ${text}`);
        }
        
        function updateDebug(text) {
            document.getElementById('debug').textContent = text;
        }
        
        async function connect() {
            updateStatus('Connecting to signaling server...', 'connecting');
            
            try {
                ws = new WebSocket('ws://localhost:8080');
                
                ws.onopen = () => {
                    updateStatus('Connected to signaling server', 'connected');
                    setupWebRTC();
                };
                
                ws.onmessage = async (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('Received:', data.type);
                        
                        if (data.type === 'offer') {
                            await handleOffer(data.offer);
                        } else if (data.type === 'answer') {
                            await pc.setRemoteDescription(data.answer);
                        } else if (data.type === 'ice') {
                            await pc.addIceCandidate(data.candidate);
                        }
                    } catch (e) {
                        console.error('Message handling error:', e);
                    }
                };
                
                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    updateStatus('Connection error', 'error');
                };
                
                ws.onclose = () => {
                    updateStatus('Disconnected - Reconnecting...', 'error');
                    scheduleReconnect();
                };
                
            } catch (error) {
                console.error('Connection error:', error);
                updateStatus('Failed to connect', 'error');
                scheduleReconnect();
            }
        }
        
        function setupWebRTC() {
            pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
            
            pc.ontrack = (event) => {
                console.log('Received video track');
                const video = document.getElementById('remoteVideo');
                video.srcObject = event.streams[0];
                document.getElementById('loading').style.display = 'none';
                document.getElementById('controls').style.display = 'flex';
                updateStatus('Sweet Athena connected', 'connected');
                startStatsMonitoring();
            };
            
            pc.onicecandidate = (event) => {
                if (event.candidate && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'ice',
                        candidate: event.candidate
                    }));
                }
            };
            
            pc.onconnectionstatechange = () => {
                updateDebug(`WebRTC: ${pc.connectionState}`);
                if (pc.connectionState === 'failed') {
                    updateStatus('Connection failed', 'error');
                    scheduleReconnect();
                }
            };
            
            // Create data channel for commands
            const dataChannel = pc.createDataChannel('commands');
            dataChannel.onopen = () => console.log('Data channel open');
        }
        
        async function handleOffer(offer) {
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            ws.send(JSON.stringify({
                type: 'answer',
                answer: answer
            }));
        }
        
        function changePersonality(type) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'command',
                    command: 'personality',
                    value: type
                }));
                updateStatus(`Personality: ${type}`, 'connected');
            }
        }
        
        function scheduleReconnect() {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
                console.log('Attempting reconnection...');
                connect();
            }, 3000);
        }
        
        function startStatsMonitoring() {
            if (statsInterval) clearInterval(statsInterval);
            statsInterval = setInterval(async () => {
                if (pc) {
                    const stats = await pc.getStats();
                    stats.forEach(report => {
                        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
                            const fps = report.framesPerSecond || 0;
                            const bitrate = Math.round((report.bytesReceived * 8) / 1000);
                            updateDebug(`FPS: ${fps} | Bitrate: ${bitrate} kbps`);
                        }
                    });
                }
            }, 1000);
        }
        
        // Auto-connect on load
        connect();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (ws) ws.close();
            if (pc) pc.close();
            if (statsInterval) clearInterval(statsInterval);
            if (reconnectTimer) clearTimeout(reconnectTimer);
        });
    </script>
</body>
</html>
EOF

echo "   Created: ~/Desktop/sweet-athena-viewer-fixed.html"

# Step 4: Launch UE5 with Pixel Streaming
echo ""
echo "🎮 4/4 Launching UE5 with Pixel Streaming..."
UE5_PATH="/Users/Shared/Epic Games/UE_5.6"
PROJECT_PATH="$HOME/UE5-SweetAthena/SweetAthenaUE5Project.uproject"

if [ -f "$PROJECT_PATH" ]; then
    open "$UE5_PATH/Engine/Binaries/Mac/UnrealEditor.app" \
         --args "$PROJECT_PATH" \
         -game \
         -AudioMixer \
         -PixelStreamingIP=localhost \
         -PixelStreamingPort=8888 &
    UE5_PID=$!
    echo "   UE5 PID: $UE5_PID"
else
    echo -e "   ${RED}Project file not found!${NC}"
fi

# Wait and open viewer
echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Open the fixed viewer
open ~/Desktop/sweet-athena-viewer-fixed.html

echo ""
echo "========================================="
echo -e "${GREEN}✅ Sweet Athena Launched!${NC}"
echo "========================================="
echo ""
echo "📋 Running Services:"
echo "   • Backend API: PID $BACKEND_PID"
echo "   • Signaling Server: PID $SIGNAL_PID"
echo "   • Unreal Engine: Launching..."
echo ""
echo "🎮 Next Steps:"
echo "1. Wait for UE5 to load completely"
echo "2. In UE5: Open Content > Maps > SweetAthenaLevel"
echo "3. Click Play (▶️) button"
echo "4. Enable Pixel Streaming in UE5 console:"
echo "   Type: PixelStreaming.WebRTC.StartStreaming"
echo ""
echo "🛑 To stop everything:"
echo "kill $BACKEND_PID $SIGNAL_PID && pkill UnrealEditor"
echo ""
echo "📺 Viewer opened in browser"
echo "Check console for connection status"