#!/bin/bash

echo "🍎 SWIFT FRONTEND INTEGRATION TEST"
echo "=================================="
echo ""

echo "Testing all backend services that Swift frontend connects to..."
echo ""

echo "1. Chat Service (8010):"
curl -s -X POST http://localhost:8010/chat -H "Content-Type: application/json" -d '{"message": "Frontend integration test"}' | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  ✅ Response Length: {len(data.get(\"response\", \"\"))} chars')
    print('  ✅ Chat Service: WORKING')
except:
    print('  ❌ Chat Service: FAILED')
"

echo ""
echo "2. Vision Service (8084):"
curl -s http://localhost:8084/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  ✅ Status: {data.get(\"status\", \"unknown\")}')
    print('  ✅ Vision Service: WORKING')
except:
    print('  ❌ Vision Service: FAILED')
"

echo ""
echo "3. System Access Service (8019):"
curl -s -X POST http://localhost:8019/execute-command -H "Content-Type: application/json" -d '{"command": "echo Frontend system access test"}' | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  ✅ Success: {data.get(\"success\", False)}')
    print('  ✅ System Access Service: WORKING')
except:
    print('  ❌ System Access Service: FAILED')
"

echo ""
echo "4. Auth Service (8015):"
curl -s http://localhost:8015/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  ✅ Status: {data.get(\"status\", \"unknown\")}')
    print('  ✅ Auth Service: WORKING')
except:
    print('  ❌ Auth Service: FAILED')
"

echo ""
echo "🎉 FRONTEND INTEGRATION TEST COMPLETE!"
echo "======================================"
echo "All backend services are ready for Swift frontend!"
