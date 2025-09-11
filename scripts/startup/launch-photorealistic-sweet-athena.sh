#!/bin/bash

# Launch Sweet Athena in Photorealistic Mode
# This script handles the complete UE5 + Pixel Streaming setup

echo "🌸 Launching Photorealistic Sweet Athena"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if UE5 is installed
check_ue5() {
    echo "🔍 Checking for Unreal Engine 5.6..."
    
    UE5_PATHS=(
        "/Users/Shared/Epic Games/UE_5.6"
        "/Applications/UE_5.6"
        "$HOME/Applications/UE_5.6"
        "/Users/Shared/UnrealEngine/UE_5.6"
    )
    
    UE5_FOUND=""
    for path in "${UE5_PATHS[@]}"; do
        if [ -d "$path" ]; then
            UE5_FOUND="$path"
            break
        fi
    done
    
    if [ -z "$UE5_FOUND" ]; then
        echo -e "${RED}❌ Unreal Engine 5.6 not found!${NC}"
        echo ""
        echo "Please install UE5 first:"
        echo "1. Open Epic Games Launcher"
        echo "2. Install Unreal Engine 5.6"
        echo "3. Run this script again"
        echo ""
        echo "Opening installation guide..."
        open ~/Desktop/INSTALL_SWEET_ATHENA_UE5.md
        exit 1
    else
        echo -e "${GREEN}✓ Found UE5 at: $UE5_FOUND${NC}"
    fi
}

# Start all services
start_services() {
    echo ""
    echo "🚀 Starting services..."
    
    # Kill any existing services
    echo "Cleaning up old processes..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:8081 | xargs kill -9 2>/dev/null || true
    lsof -ti:8888 | xargs kill -9 2>/dev/null || true
    sleep 2
    
    # Start signalling server
    echo "Starting WebRTC signalling server..."
    cd ~/UE5-SweetAthena/Scripts
    if [ -f "StartPixelStreaming.sh" ]; then
        ./StartPixelStreaming.sh &
        STREAMING_PID=$!
        echo "Pixel Streaming started (PID: $STREAMING_PID)"
    else
        echo -e "${YELLOW}⚠️  Pixel Streaming script not found, creating minimal version${NC}"
        # Create a minimal signalling server
        node -e "
        const WebSocket = require('ws');
        const wss = new WebSocket.Server({ port: 8080 });
        console.log('Signalling server on port 8080');
        wss.on('connection', ws => {
            ws.on('message', msg => {
                wss.clients.forEach(client => {
                    if (client !== ws) client.send(msg);
                });
            });
        });
        " &
    fi
    
    # Start backend API
    echo "Starting backend services..."
    cd ~/Desktop/universal-ai-tools
    npm run dev > /tmp/sweet-athena-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started (PID: $BACKEND_PID)"
    
    sleep 5
}

# Launch UE5 with Sweet Athena
launch_ue5() {
    echo ""
    echo "🎮 Launching Unreal Engine with Sweet Athena..."
    
    # Build the launch command
    UE5_EDITOR="$UE5_FOUND/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
    PROJECT_PATH="$HOME/UE5-SweetAthena/SweetAthenaUE5Project.uproject"
    
    if [ ! -f "$PROJECT_PATH" ]; then
        echo -e "${YELLOW}⚠️  Project file not found, using demo scene${NC}"
        PROJECT_PATH=""
    fi
    
    # Launch with Pixel Streaming parameters
    "$UE5_EDITOR" $PROJECT_PATH \
        -game \
        -ResX=1920 -ResY=1080 \
        -PixelStreamingIP=127.0.0.1 \
        -PixelStreamingPort=8888 \
        -RenderOffScreen \
        -ForceRes \
        -AudioMixer \
        -AllowPixelStreamingCommands \
        -messaging &
    
    UE5_PID=$!
    echo "Unreal Engine launched (PID: $UE5_PID)"
}

# Create the viewer page
create_viewer() {
    echo ""
    echo "🌐 Creating viewer interface..."
    
    cat > ~/Desktop/sweet-athena-viewer.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Sweet Athena - Photorealistic View</title>
    <style>
        body {
            margin: 0;
            background: #000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
        }
        #videoContainer {
            width: 100vw;
            height: 100vh;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #remoteVideo {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
        }
        .controls {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            padding: 20px;
            border-radius: 10px;
            display: flex;
            gap: 10px;
        }
        button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            background: #667eea;
            color: white;
            cursor: pointer;
            font-weight: bold;
        }
        button:hover {
            background: #764ba2;
        }
        .status {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            padding: 10px 20px;
            border-radius: 5px;
        }
        .loading {
            font-size: 24px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div id="videoContainer">
        <video id="remoteVideo" autoplay playsinline></video>
        <div class="loading" id="loading">
            🌸 Connecting to Sweet Athena...<br>
            <small>Make sure UE5 is running with Pixel Streaming</small>
        </div>
    </div>
    
    <div class="status" id="status">
        Status: Connecting...
    </div>
    
    <div class="controls">
        <button onclick="changePersonality('sweet')">Sweet</button>
        <button onclick="changePersonality('confident')">Confident</button>
        <button onclick="changePersonality('playful')">Playful</button>
        <button onclick="toggleFullscreen()">Fullscreen</button>
    </div>
    
    <script>
        let pc = null;
        let ws = null;
        
        function connect() {
            ws = new WebSocket('ws://localhost:8080');
            
            ws.onopen = () => {
                console.log('Connected to signalling server');
                document.getElementById('status').textContent = 'Status: Connected';
                setupWebRTC();
            };
            
            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'offer') {
                    await pc.setRemoteDescription(data.offer);
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    ws.send(JSON.stringify({ type: 'answer', answer }));
                } else if (data.type === 'ice') {
                    await pc.addIceCandidate(data.candidate);
                }
            };
            
            ws.onerror = () => {
                document.getElementById('status').textContent = 'Status: Error';
                setTimeout(connect, 3000);
            };
        }
        
        function setupWebRTC() {
            pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            pc.ontrack = (event) => {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            };
            
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    ws.send(JSON.stringify({
                        type: 'ice',
                        candidate: event.candidate
                    }));
                }
            };
        }
        
        function changePersonality(type) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'command',
                    command: 'personality',
                    value: type
                }));
            }
        }
        
        function toggleFullscreen() {
            const video = document.getElementById('remoteVideo');
            if (video.requestFullscreen) {
                video.requestFullscreen();
            }
        }
        
        // Start connection
        connect();
    </script>
</body>
</html>
EOF
    
    echo -e "${GREEN}✓ Viewer page created${NC}"
}

# Main execution
main() {
    check_ue5
    start_services
    create_viewer
    
    echo ""
    echo "⏳ Waiting for UE5 to start (this may take a minute)..."
    sleep 5
    
    launch_ue5
    
    echo ""
    echo "========================================="
    echo -e "${GREEN}🎉 Sweet Athena is launching!${NC}"
    echo "========================================="
    echo ""
    echo "📺 Opening viewer in browser..."
    open ~/Desktop/sweet-athena-viewer.html
    echo ""
    echo "🎮 What to do now:"
    echo "1. Wait for UE5 to fully load (shader compilation on first run)"
    echo "2. In UE5: Open Content > Maps > SweetAthenaLevel"
    echo "3. Click the Play button in UE5"
    echo "4. The photorealistic stream will appear in your browser"
    echo ""
    echo "🛑 To stop everything:"
    echo "Press Ctrl+C or run: kill $STREAMING_PID $BACKEND_PID $UE5_PID"
    echo ""
    echo -e "${BLUE}This is the REAL Sweet Athena - photorealistic quality! 🌸${NC}"
}

# Run main
main