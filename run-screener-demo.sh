#!/bin/bash

# Universal AI Tools - Automated Screener with Recording
# This script handles screen recording and browser automation

echo "🎥 UNIVERSAL AI TOOLS - AUTOMATED SCREENER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  ✅ Start screen recording"
echo "  ✅ Open Chrome browser"
echo "  ✅ Navigate through all UI features"
echo "  ✅ Save video to screener-output/"
echo ""
echo "Press ENTER to start..."
read

# Create output directory
mkdir -p screener-output

# Generate filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VIDEO_FILE="screener-output/universal-ai-tools-demo-${TIMESTAMP}.mov"

echo "📹 Starting screen recording..."
echo "   Output: $VIDEO_FILE"
echo ""
echo "⚠️  To stop recording: Press CTRL+C then CTRL+C again"
echo ""

# Start screen recording in background
screencapture -v -x -T 0 "$VIDEO_FILE" &
RECORDER_PID=$!

# Give recorder time to start
sleep 2

echo "✅ Recording started!"
echo ""
echo "🌐 Opening Chrome and navigating UI..."
echo ""

# Open Chrome with specific URL and window size
open -na "Google Chrome" --args \
  --new-window \
  --window-size=1920,1080 \
  --window-position=0,0 \
  "http://localhost:3000"

# Guide the user through the demo
echo "📍 DEMO GUIDE:"
echo ""
echo "1. Landing Page (wait 3 seconds)"
echo "2. Click 'Chat' in navigation"
echo "3. Type: 'Create a photo organization project for 15,000 photos'"
echo "4. Click Send/Enter"
echo "5. Navigate to Dashboard"
echo "6. Scroll through metrics"
echo "7. Navigate to Projects"
echo "8. Navigate to Agents"
echo "9. Navigate to API Docs"
echo "10. Return to Dashboard"
echo ""
echo "⏱️  Estimated time: 60-90 seconds"
echo ""
echo "Press CTRL+C when demo is complete..."

# Wait for user to stop
trap 'echo ""; echo "⏹️  Stopping recording..."; kill $RECORDER_PID 2>/dev/null; echo "✅ Recording saved to: $VIDEO_FILE"; echo ""; echo "📹 Opening video..."; open "$VIDEO_FILE"; exit 0' INT

# Keep script running
while true; do
  sleep 1
done