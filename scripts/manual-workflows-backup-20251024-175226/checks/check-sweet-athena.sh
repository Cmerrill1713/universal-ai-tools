#!/bin/bash

echo "🌸 Sweet Athena Connection Checker"
echo "================================="
echo ""

# Check if signaling server is running
echo "1. Checking signaling server..."
if lsof -i :8888 > /dev/null 2>&1; then
    echo "✅ Signaling server is running on port 8888"
else
    echo "❌ Signaling server is NOT running on port 8888"
    echo "   Run: node sweet-athena-signaling-server.mjs"
fi

# Check if backend is running
echo ""
echo "2. Checking backend server..."
if curl -s http://localhost:9999/api/health > /dev/null 2>&1; then
    echo "✅ Backend server is running on port 9999"
else
    echo "❌ Backend server is NOT running on port 9999"
    echo "   Run: npm run start:minimal"
fi

# Check if frontend is running
echo ""
echo "3. Checking frontend..."
if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo "✅ Frontend is running on port 5174"
else
    echo "❌ Frontend is NOT running on port 5174"
    echo "   Run: npm run dev (in ui/ folder)"
fi

# Test WebSocket connection
echo ""
echo "4. Testing WebSocket connection..."
node -e "
const ws = new (require('ws'))('ws://localhost:8888');
ws.on('open', () => {
    console.log('✅ WebSocket connection successful');
    ws.close();
    process.exit(0);
});
ws.on('error', (err) => {
    console.log('❌ WebSocket connection failed:', err.message);
    process.exit(1);
});
setTimeout(() => {
    console.log('❌ WebSocket connection timeout');
    process.exit(1);
}, 3000);
" 2>/dev/null || echo "   Make sure 'ws' package is installed: npm install ws"

echo ""
echo "5. Next steps:"
echo "   - Open UE5 project"
echo "   - Press ~ for console"
echo "   - Type: PixelStreaming.WebRTC.SignallingServerUrl ws://127.0.0.1:8888"
echo "   - Press Enter"
echo "   - Click Play in UE5"
echo ""
echo "6. Then open in browser:"
echo "   http://localhost:5174/sweet-athena-ue5"
echo ""