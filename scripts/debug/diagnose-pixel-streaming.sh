#!/bin/bash

echo "🔍 UE5 Pixel Streaming Diagnostic Tool"
echo "======================================"
echo ""

# Check what's running
echo "1. Checking running servers..."
echo "Port 80: $(lsof -ti:80 2>/dev/null || echo 'Nothing')"
echo "Port 88: $(lsof -ti:88 2>/dev/null || echo 'Nothing')"
echo "Port 8080: $(lsof -ti:8080 2>/dev/null || echo 'Nothing')"
echo "Port 8888: $(lsof -ti:8888 2>/dev/null || echo 'Nothing')"
echo ""

# Check if UE5 is running
echo "2. Checking if UE5 is running..."
ps aux | grep -i unreal | grep -v grep | head -3
echo ""

# Test WebSocket connection
echo "3. Testing WebSocket connection to UE5..."
cat > test-ws.js << 'EOF'
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:8888');

ws.on('open', () => {
    console.log('✅ WebSocket connected!');
    ws.close();
    process.exit(0);
});

ws.on('error', (err) => {
    console.log('❌ WebSocket error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('❌ Connection timeout');
    process.exit(1);
}, 5000);
EOF

node test-ws.js 2>/dev/null || echo "WebSocket test failed"
echo ""

# Create a minimal test
echo "4. Creating absolute minimal test..."
cat > minimal-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Minimal UE5 Test</title>
</head>
<body style="margin:0; background:#000; color:#fff; font-family:Arial;">
    <h2 style="margin:20px;">UE5 Pixel Streaming - Minimal Test</h2>
    
    <div style="margin:20px;">
        <h3>Quick Fix Steps:</h3>
        <ol>
            <li>In UE5, open Project Settings</li>
            <li>Go to Plugins → Pixel Streaming</li>
            <li>Set "Signalling Server URL" to: ws://127.0.0.1:8888</li>
            <li>Check "Start Streaming on Launch"</li>
            <li>Save and restart UE5</li>
        </ol>
        
        <h3>Alternative: Use Legacy Pixel Streaming</h3>
        <ol>
            <li>In UE5: Edit → Plugins</li>
            <li>Search for "Pixel Streaming"</li>
            <li>Disable "Pixel Streaming" (the new one)</li>
            <li>Enable "Pixel Streaming Legacy"</li>
            <li>Restart UE5</li>
        </ol>
        
        <h3>Nuclear Option: Use NDI Instead</h3>
        <p>NDI is much simpler and more reliable:</p>
        <ol>
            <li>Install NDI Plugin for UE5</li>
            <li>In console: ndi.broadcast 1</li>
            <li>Use NDI Studio Monitor to view</li>
        </ol>
    </div>
    
    <div style="margin:20px; background:#333; padding:20px;">
        <button onclick="testDirect()" style="padding:10px 20px; font-size:16px;">Test Direct Connection</button>
        <pre id="log" style="margin-top:20px; font-size:12px;"></pre>
    </div>
    
    <script>
        function log(msg) {
            document.getElementById('log').textContent += msg + '\n';
        }
        
        function testDirect() {
            log('Testing direct connection...');
            
            // Try different URLs
            const urls = [
                'http://127.0.0.1:80',
                'http://localhost:80',
                'http://127.0.0.1:8080',
                'http://localhost:8080'
            ];
            
            urls.forEach(url => {
                fetch(url)
                    .then(r => log(`✅ ${url} responded`))
                    .catch(e => log(`❌ ${url} failed`));
            });
            
            // Test WebSocket
            try {
                const ws = new WebSocket('ws://127.0.0.1:8888');
                ws.onopen = () => log('✅ WebSocket connected to 8888');
                ws.onerror = () => log('❌ WebSocket failed');
            } catch (e) {
                log('❌ WebSocket error: ' + e.message);
            }
        }
    </script>
</body>
</html>
EOF

echo "5. Opening test page..."
open minimal-test.html

echo ""
echo "📋 DIAGNOSIS COMPLETE"
echo ""
echo "If WebSocket connects but no video:"
echo "→ UE5 isn't configured to stream"
echo ""
echo "If WebSocket doesn't connect:"
echo "→ UE5's signaling server isn't running"
echo ""
echo "RECOMMENDED: Use the Legacy Pixel Streaming plugin or NDI instead"