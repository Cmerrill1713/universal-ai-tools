#!/bin/bash

# Universal AI Tools - Fully Automated Recording with Demo
# This script starts recording, runs the demo, then stops recording

echo "🎥 UNIVERSAL AI TOOLS - FULLY AUTOMATED RECORDING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create output directory
mkdir -p screener-output
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VIDEO_FILE="screener-output/universal-ai-tools-demo-${TIMESTAMP}.mov"

echo "📹 Starting screen recording..."
echo "   Recording will run for 40 seconds"
echo "   Output: $VIDEO_FILE"
echo ""

# Start screen recording with 45 second timeout (40s demo + 5s buffer)
screencapture -v -x -T 0 "$VIDEO_FILE" &
RECORDER_PID=$!

# Wait for recording to initialize
sleep 3

echo "🔴 Recording active!"
echo ""

# Now run the demo
echo "🌐 Opening Universal AI Tools..."
open -na "Google Chrome" --args \
    --new-window \
    --window-size=1920,1080 \
    --window-position=0,0 \
    "http://localhost:3000"

sleep 5

echo "📍 Starting automated demo navigation..."
echo ""

# Navigate through all pages with timing
echo "   • Landing Page (5 seconds)..."
sleep 5

echo "   • Chat Interface..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/chat"'
sleep 5

echo "   • Dashboard..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/dashboard"'
sleep 5

echo "   • Projects..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/projects"'
sleep 4

echo "   • AI Agents..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/agents"'
sleep 4

echo "   • API Documentation..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/api-docs"'
sleep 4

echo "   • Dashboard Finale..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/dashboard"'
sleep 4

echo ""
echo "✅ Demo complete!"
echo ""

# Now stop the recording by sending interrupt signal
echo "⏹️  Stopping recording..."
kill -INT $RECORDER_PID 2>/dev/null || true

# Wait for video to be saved
sleep 3

# Check if video was created and has content
if [ -f "$VIDEO_FILE" ]; then
    FILE_SIZE=$(ls -lh "$VIDEO_FILE" | awk '{print $5}')
    echo "✅ Video saved successfully!"
    echo "📹 File: $VIDEO_FILE"
    echo "📏 Size: $FILE_SIZE"
    echo ""
    echo "🎬 Opening video..."
    open "$VIDEO_FILE"
else
    echo "❌ Video recording failed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"