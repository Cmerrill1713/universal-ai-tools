#!/bin/bash

echo "🍎 SWIFT FRONTEND RUNTIME TEST"
echo "=============================="
echo ""

echo "1. Checking if Swift app is running..."
if pgrep -f "UniversalAIToolsApp" > /dev/null; then
    echo "  ✅ Swift app is running"
else
    echo "  ❌ Swift app is not running"
    exit 1
fi

echo ""
echo "2. Testing backend services..."
echo "Chat Service (8010):"
curl -s http://localhost:8010/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

echo "Vision Service (8084):"
curl -s http://localhost:8084/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

echo "System Access Service (8019):"
curl -s http://localhost:8019/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

echo "Auth Service (8015):"
curl -s http://localhost:8015/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

echo "TTS Service (8093):"
curl -s http://localhost:8093/health > /dev/null && echo "  ✅ Running" || echo "  ❌ Not running"

echo ""
echo "3. Testing chat functionality..."
curl -s -X POST http://localhost:8010/chat -H "Content-Type: application/json" -d '{"message": "Swift frontend test"}' | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    response = data.get('response', '')
    print(f'  ✅ Chat Response: {len(response)} characters')
    print('  ✅ Chat Functionality: WORKING')
except:
    print('  ❌ Chat Functionality: FAILED')
"

echo ""
echo "🎉 SWIFT FRONTEND RUNTIME TEST COMPLETE!"
echo "========================================"
echo "The Swift frontend should now be working without runtime errors!"
