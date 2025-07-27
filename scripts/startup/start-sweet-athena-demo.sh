#!/bin/bash

# Sweet Athena Quick Demo Script
# This will start a local demo you can interact with immediately

echo "🌸 Starting Sweet Athena Demo..."
echo "==============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
sleep 2

# Start the main server if not running
echo "🚀 Starting backend server..."
if ! lsof -i :3002 | grep -q LISTEN; then
    npm run dev > /tmp/sweet-athena-backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started (PID: $BACKEND_PID)"
else
    echo "Backend already running on port 3002"
fi

# Create a simple mock signalling server
echo "🔌 Creating mock signalling server..."
mkdir -p /tmp/sweet-athena-demo

cat > /tmp/sweet-athena-demo/signalling-server.js << 'EOF'
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log('🌸 Sweet Athena Mock Signalling Server starting...');

const connections = new Map();
let nextId = 1;

wss.on('connection', (ws, req) => {
    const id = nextId++;
    connections.set(id, ws);
    
    console.log(`Client connected: ${id}`);
    
    // Send initial config
    ws.send(JSON.stringify({
        type: 'config',
        data: {
            serverId: id,
            personality: 'sweet',
            clothingLevel: 'moderate'
        }
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Message from ${id}:`, data.type);
            
            // Echo back state changes
            if (data.type === 'personality_change' || data.type === 'clothing_change') {
                ws.send(JSON.stringify({
                    type: 'state_update',
                    data: {
                        personality: data.personality || 'sweet',
                        clothingLevel: data.level || 'moderate',
                        timestamp: Date.now()
                    }
                }));
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });
    
    ws.on('close', () => {
        connections.delete(id);
        console.log(`Client disconnected: ${id}`);
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connections: connections.size,
        timestamp: new Date().toISOString()
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`✅ Mock signalling server running on port ${PORT}`);
});
EOF

# Install minimal dependencies for the mock server
cd /tmp/sweet-athena-demo
npm init -y > /dev/null 2>&1
npm install ws express cors > /dev/null 2>&1

# Start the mock signalling server
node signalling-server.js > /tmp/sweet-athena-signalling.log 2>&1 &
SIGNALLING_PID=$!
echo "Signalling server started (PID: $SIGNALLING_PID)"

# Create a simple web server for the demo
echo "🌐 Starting web server..."
cat > /tmp/sweet-athena-demo/web-server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

const PORT = 8081;
app.listen(PORT, () => {
    console.log(`✅ Web server running on port ${PORT}`);
    console.log(`🌐 Access demo at: http://localhost:${PORT}`);
});
EOF

# Create demo HTML with 2D avatar fallback
mkdir -p /tmp/sweet-athena-demo/public
cat > /tmp/sweet-athena-demo/public/demo.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sweet Athena Demo - Interactive Avatar</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .main-content {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 30px;
        }
        .avatar-container {
            background: rgba(0,0,0,0.3);
            border-radius: 15px;
            padding: 20px;
            text-align: center;
            position: relative;
        }
        .avatar-display {
            width: 100%;
            max-width: 600px;
            height: 400px;
            background: #1a1a2e;
            border-radius: 10px;
            margin: 0 auto;
            position: relative;
            overflow: hidden;
        }
        .avatar-svg {
            width: 100%;
            height: 100%;
        }
        .controls {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
        }
        .control-section {
            margin-bottom: 25px;
        }
        .control-section h3 {
            margin-bottom: 15px;
        }
        .btn {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            background: rgba(255,255,255,0.2);
            color: white;
            margin: 5px;
            transition: all 0.3s ease;
        }
        .btn:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        .btn.active {
            background: rgba(76, 175, 80, 0.4);
            border: 2px solid #4CAF50;
        }
        .status {
            text-align: center;
            padding: 10px;
            margin-top: 10px;
            border-radius: 5px;
            font-size: 14px;
        }
        .connected {
            background: rgba(76, 175, 80, 0.3);
        }
        .disconnected {
            background: rgba(244, 67, 54, 0.3);
        }
        input[type="range"] {
            width: 100%;
            margin: 10px 0;
        }
        .chat-input {
            width: 100%;
            padding: 10px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.1);
            color: white;
            margin-top: 10px;
        }
        .chat-input::placeholder {
            color: rgba(255,255,255,0.7);
        }
        @keyframes breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
        }
        @keyframes talk {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(1.1); }
        }
        .breathing {
            animation: breathe 4s ease-in-out infinite;
        }
        .talking .mouth {
            animation: talk 0.5s ease-in-out infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌸 Sweet Athena - Interactive AI Avatar</h1>
            <p>Experience personality-driven interactions with customizable appearance</p>
        </div>

        <div class="main-content">
            <div class="avatar-container">
                <div class="avatar-display" id="avatarDisplay">
                    <!-- 2D Avatar SVG -->
                    <svg class="avatar-svg breathing" viewBox="0 0 400 400" id="avatarSvg">
                        <!-- Background circle -->
                        <circle cx="200" cy="200" r="180" fill="#2a2a3e"/>
                        
                        <!-- Hair Back -->
                        <path d="M 100 150 Q 200 50, 300 150 L 280 250 Q 200 280, 120 250 Z" 
                              fill="#8B4513" id="hairBack"/>
                        
                        <!-- Face -->
                        <ellipse cx="200" cy="200" rx="80" ry="100" fill="#FDBCB4" id="face"/>
                        
                        <!-- Eyes -->
                        <ellipse cx="170" cy="180" rx="15" ry="20" fill="#FFF" class="eye"/>
                        <ellipse cx="230" cy="180" rx="15" ry="20" fill="#FFF" class="eye"/>
                        <circle cx="170" cy="180" r="8" fill="#667eea" class="pupil"/>
                        <circle cx="230" cy="180" r="8" fill="#667eea" class="pupil"/>
                        
                        <!-- Eyebrows -->
                        <path d="M 155 165 Q 170 160, 185 165" stroke="#8B4513" stroke-width="3" 
                              fill="none" stroke-linecap="round" id="leftEyebrow"/>
                        <path d="M 215 165 Q 230 160, 245 165" stroke="#8B4513" stroke-width="3" 
                              fill="none" stroke-linecap="round" id="rightEyebrow"/>
                        
                        <!-- Nose -->
                        <path d="M 200 190 L 195 210 L 205 210 Z" fill="#F5A492"/>
                        
                        <!-- Mouth -->
                        <path d="M 175 230 Q 200 240, 225 230" stroke="#D6949B" stroke-width="3" 
                              fill="none" stroke-linecap="round" class="mouth" id="mouth"/>
                        
                        <!-- Hair Front -->
                        <path d="M 120 120 Q 200 80, 280 120 L 270 180 Q 200 160, 130 180 Z" 
                              fill="#8B4513" id="hairFront"/>
                        
                        <!-- Clothing -->
                        <path d="M 140 280 Q 200 300, 260 280 L 280 380 L 120 380 Z" 
                              fill="#764ba2" id="clothing"/>
                        
                        <!-- Personality indicator -->
                        <text x="200" y="350" text-anchor="middle" fill="white" 
                              font-size="14" id="personalityText">Sweet</text>
                    </svg>
                </div>
                <div class="status connected" id="status">
                    🟢 Connected - 2D Avatar Mode
                </div>
            </div>

            <div class="controls">
                <div class="control-section">
                    <h3>🎭 Personality</h3>
                    <button class="btn active" data-personality="sweet">Sweet</button>
                    <button class="btn" data-personality="shy">Shy</button>
                    <button class="btn" data-personality="confident">Confident</button>
                    <button class="btn" data-personality="caring">Caring</button>
                    <button class="btn" data-personality="playful">Playful</button>
                </div>

                <div class="control-section">
                    <h3>👗 Clothing Level</h3>
                    <input type="range" id="clothingSlider" min="0" max="3" value="1" step="1">
                    <div style="display: flex; justify-content: space-between; font-size: 12px;">
                        <span>Conservative</span>
                        <span>Moderate</span>
                        <span>Revealing</span>
                        <span>Very Revealing</span>
                    </div>
                </div>

                <div class="control-section">
                    <h3>💬 Chat</h3>
                    <input type="text" class="chat-input" id="chatInput" 
                           placeholder="Say something to Sweet Athena...">
                    <button class="btn" id="sendBtn" style="width: 100%; margin-top: 10px;">
                        Send Message
                    </button>
                </div>

                <div class="control-section">
                    <h3>📊 Current State</h3>
                    <div style="font-size: 14px;">
                        <p>Personality: <span id="currentPersonality">Sweet</span></p>
                        <p>Clothing: <span id="currentClothing">Moderate</span></p>
                        <p>Mood: <span id="currentMood">Happy</span></p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Avatar state
        let currentState = {
            personality: 'sweet',
            clothingLevel: 1,
            mood: 'happy',
            isConnected: true
        };

        // WebSocket connection
        let ws = null;
        
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:8080');
            
            ws.onopen = () => {
                console.log('Connected to signalling server');
                updateStatus(true);
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            };
            
            ws.onclose = () => {
                console.log('Disconnected from server');
                updateStatus(false);
                setTimeout(connectWebSocket, 3000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }

        function handleServerMessage(data) {
            if (data.type === 'state_update') {
                updateAvatarState(data.data);
            }
        }

        function updateStatus(connected) {
            currentState.isConnected = connected;
            const statusEl = document.getElementById('status');
            statusEl.className = connected ? 'status connected' : 'status disconnected';
            statusEl.textContent = connected 
                ? '🟢 Connected - 2D Avatar Mode' 
                : '🔴 Disconnected - Reconnecting...';
        }

        // Personality system
        const personalityStyles = {
            sweet: {
                hairColor: '#8B4513',
                eyeColor: '#667eea',
                expression: 'M 175 230 Q 200 240, 225 230',
                eyebrowShape: 'M 155 165 Q 170 160, 185 165',
                mood: 'Happy'
            },
            shy: {
                hairColor: '#654321',
                eyeColor: '#9370DB',
                expression: 'M 180 230 Q 200 235, 220 230',
                eyebrowShape: 'M 155 160 Q 170 165, 185 160',
                mood: 'Bashful'
            },
            confident: {
                hairColor: '#D2691E',
                eyeColor: '#4169E1',
                expression: 'M 170 230 Q 200 235, 230 230',
                eyebrowShape: 'M 155 170 Q 170 165, 185 170',
                mood: 'Bold'
            },
            caring: {
                hairColor: '#A0522D',
                eyeColor: '#20B2AA',
                expression: 'M 175 225 Q 200 235, 225 225',
                eyebrowShape: 'M 155 163 Q 170 158, 185 163',
                mood: 'Nurturing'
            },
            playful: {
                hairColor: '#FF6B6B',
                eyeColor: '#FF69B4',
                expression: 'M 170 225 Q 200 245, 230 225',
                eyebrowShape: 'M 155 165 Q 170 155, 185 165',
                mood: 'Energetic'
            }
        };

        const clothingStyles = [
            { color: '#1a237e', neckline: 'M 140 280 Q 200 300, 260 280 L 280 380 L 120 380 Z' },
            { color: '#764ba2', neckline: 'M 140 280 Q 200 310, 260 280 L 280 380 L 120 380 Z' },
            { color: '#e91e63', neckline: 'M 150 290 Q 200 320, 250 290 L 280 380 L 120 380 Z' },
            { color: '#ff4081', neckline: 'M 160 300 Q 200 330, 240 300 L 280 380 L 120 380 Z' }
        ];

        function changePersonality(personality) {
            currentState.personality = personality;
            const style = personalityStyles[personality];
            
            // Update avatar appearance
            document.getElementById('hairBack').setAttribute('fill', style.hairColor);
            document.getElementById('hairFront').setAttribute('fill', style.hairColor);
            document.querySelectorAll('.pupil').forEach(p => p.setAttribute('fill', style.eyeColor));
            document.getElementById('mouth').setAttribute('d', style.expression);
            document.getElementById('leftEyebrow').setAttribute('d', style.eyebrowShape);
            document.getElementById('rightEyebrow').setAttribute('d', style.eyebrowShape.replace('155', '215').replace('185', '245'));
            document.getElementById('personalityText').textContent = personality.charAt(0).toUpperCase() + personality.slice(1);
            
            // Update UI
            document.getElementById('currentPersonality').textContent = 
                personality.charAt(0).toUpperCase() + personality.slice(1);
            document.getElementById('currentMood').textContent = style.mood;
            
            // Update buttons
            document.querySelectorAll('[data-personality]').forEach(btn => {
                btn.classList.remove('active');
            });
            document.querySelector(`[data-personality="${personality}"]`).classList.add('active');
            
            // Send to server
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'personality_change',
                    personality: personality
                }));
            }
            
            // Animate the change
            animatePersonalityChange();
        }

        function changeClothingLevel(level) {
            currentState.clothingLevel = level;
            const style = clothingStyles[level];
            
            document.getElementById('clothing').setAttribute('fill', style.color);
            document.getElementById('clothing').setAttribute('d', style.neckline);
            
            const levelNames = ['Conservative', 'Moderate', 'Revealing', 'Very Revealing'];
            document.getElementById('currentClothing').textContent = levelNames[level];
            
            // Send to server
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'clothing_change',
                    level: levelNames[level].toLowerCase().replace(' ', '_')
                }));
            }
        }

        function animatePersonalityChange() {
            const avatar = document.getElementById('avatarSvg');
            avatar.style.transform = 'scale(0.95)';
            setTimeout(() => {
                avatar.style.transform = 'scale(1)';
            }, 300);
        }

        function simulateTalking(text) {
            const avatar = document.getElementById('avatarSvg');
            avatar.classList.add('talking');
            
            // Simulate talking duration based on text length
            const duration = Math.min(text.length * 100, 5000);
            setTimeout(() => {
                avatar.classList.remove('talking');
            }, duration);
        }

        function updateAvatarState(data) {
            if (data.personality) {
                changePersonality(data.personality);
            }
            if (data.clothingLevel !== undefined) {
                document.getElementById('clothingSlider').value = data.clothingLevel;
                changeClothingLevel(data.clothingLevel);
            }
        }

        // Event listeners
        document.querySelectorAll('[data-personality]').forEach(btn => {
            btn.addEventListener('click', () => {
                changePersonality(btn.dataset.personality);
            });
        });

        document.getElementById('clothingSlider').addEventListener('input', (e) => {
            changeClothingLevel(parseInt(e.target.value));
        });

        document.getElementById('sendBtn').addEventListener('click', () => {
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            if (text) {
                simulateTalking(text);
                
                // Send to server
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'chat_message',
                        text: text
                    }));
                }
                
                // Simulate response
                setTimeout(() => {
                    const responses = {
                        sweet: "That's so nice of you to say! 💕",
                        shy: "Oh... um... thank you... *blushes*",
                        confident: "I know, right? Let's make something amazing!",
                        caring: "How are you feeling? I'm here to help!",
                        playful: "Hehe! That sounds like fun! 🎉"
                    };
                    simulateTalking(responses[currentState.personality]);
                }, 1000);
                
                input.value = '';
            }
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('sendBtn').click();
            }
        });

        // Initialize
        connectWebSocket();
        
        // Add some idle animations
        setInterval(() => {
            if (Math.random() > 0.7) {
                // Random blink
                document.querySelectorAll('.eye').forEach(eye => {
                    eye.style.transform = 'scaleY(0.1)';
                    setTimeout(() => {
                        eye.style.transform = 'scaleY(1)';
                    }, 150);
                });
            }
        }, 3000);
    </script>
</body>
</html>
EOF

# Start the web server
node web-server.js > /tmp/sweet-athena-web.log 2>&1 &
WEB_PID=$!
echo "Web server started (PID: $WEB_PID)"

cd - > /dev/null

# Wait for services to start
echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check if everything is running
echo ""
echo "🔍 Checking services..."
if lsof -i :3002 | grep -q LISTEN; then
    echo -e "${GREEN}✓${NC} Backend API running on port 3002"
fi
if lsof -i :8080 | grep -q LISTEN; then
    echo -e "${GREEN}✓${NC} Signalling server running on port 8080"
fi
if lsof -i :8081 | grep -q LISTEN; then
    echo -e "${GREEN}✓${NC} Web server running on port 8081"
fi

# Test API endpoint
echo ""
echo "🧪 Testing API..."
API_STATUS=$(curl -s -X GET "http://localhost:3002/api/health" 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "error")
if [ "$API_STATUS" = "healthy" ] || [ "$API_STATUS" = "ok" ]; then
    echo -e "${GREEN}✓${NC} API is responding"
else
    echo -e "${YELLOW}⚠️${NC} API may not be fully ready yet"
fi

echo ""
echo "========================================="
echo -e "${GREEN}🎉 Sweet Athena Demo is Ready!${NC}"
echo "========================================="
echo ""
echo "📱 Open your browser and go to:"
echo -e "${BLUE}http://localhost:8081${NC}"
echo ""
echo "🎮 What you can do:"
echo "  • Click personality buttons to change Sweet Athena's personality"
echo "  • Use the slider to adjust clothing levels"
echo "  • Type messages in the chat to interact"
echo "  • Watch the 2D avatar respond to your actions"
echo ""
echo "📊 Monitor logs:"
echo "  • Backend: tail -f /tmp/sweet-athena-backend.log"
echo "  • Signalling: tail -f /tmp/sweet-athena-signalling.log"
echo "  • Web: tail -f /tmp/sweet-athena-web.log"
echo ""
echo "🛑 To stop the demo:"
echo "  Press Ctrl+C or run: kill $BACKEND_PID $SIGNALLING_PID $WEB_PID"
echo ""
echo "Enjoy interacting with Sweet Athena! 🌸"

# Keep script running
wait