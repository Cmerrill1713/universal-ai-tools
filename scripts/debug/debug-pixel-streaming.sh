#!/bin/bash

echo "🔍 Pixel Streaming Debug Report"
echo "==============================="
echo ""

# Check services
echo "1. Service Status:"
echo "------------------"
echo -n "Backend API (9999): "
lsof -i :9999 > /dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running"

echo -n "Signaling Server (8080): "
lsof -i :8080 > /dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running"

echo -n "UE5 Pixel Stream (8888): "
lsof -i :8888 > /dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running"

echo ""
echo "2. UE5 Process:"
echo "---------------"
if pgrep -f "UnrealEditor" > /dev/null; then
    echo "✅ UE5 is running"
    echo "Process info:"
    ps aux | grep UnrealEditor | grep -v grep | awk '{print "  PID:", $2, "CPU:", $3"%", "MEM:", $4"%"}'
else
    echo "❌ UE5 is not running"
fi

echo ""
echo "3. Quick Fix - Start Missing Services:"
echo "-------------------------------------"

# Start signaling server if not running
if ! lsof -i :8080 > /dev/null 2>&1; then
    echo "Starting signaling server..."
    cat > /tmp/pixel-streaming-signaling.js << 'EOF'
const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log('Pixel Streaming Signaling Server Starting...');

// Store connections
const players = new Map();
let streamer = null;

wss.on('connection', (ws, req) => {
    console.log('New connection from:', req.connection.remoteAddress);
    
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message.toString());
            console.log('Received:', msg.type);
            
            // Handle different message types
            if (msg.type === 'streamer') {
                streamer = ws;
                console.log('Streamer connected');
            } else if (msg.type === 'player') {
                const playerId = Date.now().toString();
                players.set(playerId, ws);
                ws.playerId = playerId;
                console.log('Player connected:', playerId);
                
                // Notify streamer of new player
                if (streamer && streamer.readyState === WebSocket.OPEN) {
                    streamer.send(JSON.stringify({
                        type: 'playerConnected',
                        playerId: playerId
                    }));
                }
            } else {
                // Forward messages between streamer and players
                if (ws === streamer) {
                    // From streamer to specific player
                    const player = players.get(msg.playerId);
                    if (player && player.readyState === WebSocket.OPEN) {
                        player.send(JSON.stringify(msg));
                    }
                } else {
                    // From player to streamer
                    if (streamer && streamer.readyState === WebSocket.OPEN) {
                        msg.playerId = ws.playerId;
                        streamer.send(JSON.stringify(msg));
                    }
                }
            }
        } catch (e) {
            console.error('Message error:', e);
        }
    });
    
    ws.on('close', () => {
        if (ws === streamer) {
            console.log('Streamer disconnected');
            streamer = null;
        } else if (ws.playerId) {
            console.log('Player disconnected:', ws.playerId);
            players.delete(ws.playerId);
            
            // Notify streamer
            if (streamer && streamer.readyState === WebSocket.OPEN) {
                streamer.send(JSON.stringify({
                    type: 'playerDisconnected',
                    playerId: ws.playerId
                }));
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        streamer: streamer ? 'connected' : 'disconnected',
        players: players.size
    });
});

server.listen(8080, () => {
    console.log('Signaling server running on http://localhost:8080');
    console.log('WebSocket endpoint: ws://localhost:8080');
});
EOF

    cd /tmp && node pixel-streaming-signaling.js > /tmp/signaling.log 2>&1 &
    echo "Started signaling server (PID: $!)"
fi

echo ""
echo "4. Test Signaling Server:"
echo "------------------------"
curl -s http://localhost:8080/health 2>/dev/null | jq '.' || echo "Signaling server not responding"

echo ""
echo "5. UE5 Console Commands:"
echo "-----------------------"
echo "Run these in UE5 console (~ key):"
echo ""
echo "PixelStreaming.WebRTC.StartStreaming"
echo "PixelStreaming.WebRTC.PixelStreamingIP localhost"
echo "PixelStreaming.WebRTC.PixelStreamingPort 8888"
echo "PixelStreaming.WebRTC.PixelStreamingBitrate 10000000"
echo ""
echo "6. Check UE5 Output Log:"
echo "-----------------------"
echo "In UE5: Window → Developer Tools → Output Log"
echo "Look for 'PixelStreaming' messages"