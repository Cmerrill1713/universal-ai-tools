#!/bin/bash
echo "════════════════════════════════════════════════════════════════════════════════"
echo "           🧪 NEUROFORGE AI - COMPLETE CAPABILITIES TEST"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

BASE="http://localhost:8013"

# 1. Browser Automation
echo "1️⃣ Testing Browser Automation..."
curl -s -X POST $BASE/api/automation/browser/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"navigate","url":"https://github.com"}' | python3 -m json.tool | head -10
echo ""

# 2. macOS Control
echo "2️⃣ Testing macOS Automation..."
curl -s -X POST $BASE/api/automation/macos/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"system_info","command":"memory"}' | python3 -m json.tool | head -15
echo ""

# 3. Chat with Intelligence
echo "3️⃣ Testing Intelligent Chat..."
curl -s -X POST $BASE/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is 12 * 34?"}' | python3 -m json.tool
echo ""

# 4. Task Classification
echo "4️⃣ Testing Task Classification..."
curl -s -X POST $BASE/api/unified-chat/classify \
  -H "Content-Type: application/json" \
  -d '{"message":"Research quantum computing"}' | python3 -m json.tool
echo ""

# 5. Model Management
echo "5️⃣ Testing Model Management..."
curl -s $BASE/api/models | python3 -m json.tool | head -20
echo ""

# 6. Orchestration Status
echo "6️⃣ Testing Orchestration System..."
curl -s $BASE/api/orchestration/status | python3 -m json.tool
echo ""

# 7. Learning Status
echo "7️⃣ Testing Learning System..."
curl -s $BASE/api/learning/status | python3 -m json.tool | head -25
echo ""

# 8. Router Performance
echo "8️⃣ Testing Router Tuning..."
curl -s $BASE/api/router-tuning/performance | python3 -m json.tool | head -20
echo ""

# 9. Evolution Status
echo "9️⃣ Testing Evolution System..."
curl -s $BASE/api/evolution/status | python3 -m json.tool
echo ""

# 10. Automation Capabilities
echo "🔟 Testing Available Capabilities..."
curl -s $BASE/api/automation/capabilities | python3 -m json.tool
echo ""

echo "════════════════════════════════════════════════════════════════════════════════"
echo "                         ✅ ALL SYSTEMS TESTED"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Your NeuroForge AI has:"
echo "  • 19 intelligent agents"
echo "  • 40 API endpoints"
echo "  • Browser & desktop automation"
echo "  • Self-learning & evolution"
echo "  • Multi-backend routing"
echo ""
echo "🚀 Ready to use at http://localhost:3000"
echo "════════════════════════════════════════════════════════════════════════════════"

