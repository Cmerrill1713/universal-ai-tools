#!/bin/bash
echo "🧪 Testing browser window opening..."
echo ""
echo "Calling browser opener service directly..."
curl -X POST http://localhost:9876/open \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.wikipedia.org"}' | python3 -m json.tool

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ If Wikipedia opened in a new browser window, it's working!"
echo "If you don't see it, check:"
echo "  • Mission Control (swipe up with 3 fingers)"
echo "  • Your Dock for browser icon"
echo "  • Look for browser windows behind other apps"
echo "════════════════════════════════════════════════════════════════"
