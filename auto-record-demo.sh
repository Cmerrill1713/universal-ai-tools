#!/bin/bash

# Universal AI Tools - Fully Automated Screen Recording Demo
# Records screen while navigating through the UI

echo "🎥 UNIVERSAL AI TOOLS - AUTOMATED SCREEN RECORDING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Setup
mkdir -p screener-output
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VIDEO_FILE="screener-output/universal-ai-tools-demo-${TIMESTAMP}.mov"

echo "📹 This script will:"
echo "   1. Start recording your screen"
echo "   2. Open Chrome and navigate through the UI"
echo "   3. Save the video automatically"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Start screen recording in background (60 second timeout)
echo "🔴 Recording started..."
screencapture -v -x -T 60 "$VIDEO_FILE" &
RECORDER_PID=$!

# Wait for recorder to initialize
sleep 2

# Open Chrome
echo "🌐 Opening Chrome..."
open -na "Google Chrome" --args \
    --new-window \
    --window-size=1920,1080 \
    --window-position=0,0 \
    "http://localhost:3000"

# Wait for initial load
sleep 5

# Navigate through pages using AppleScript
echo "📍 Navigating through UI features..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/chat"'
sleep 4

osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/dashboard"'
sleep 4

osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/projects"'
sleep 4

osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/agents"'
sleep 4

osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/api-docs"'
sleep 4

osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/dashboard"'
sleep 3

echo "✅ Demo navigation complete!"
echo ""

# Stop recording
echo "⏹️  Stopping recording..."
kill -INT $RECORDER_PID 2>/dev/null

# Wait for file to be written
sleep 2

# Check if video was created
if [ -f "$VIDEO_FILE" ]; then
    echo "✅ Video saved successfully!"
    echo "📹 Location: $VIDEO_FILE"
    echo ""
    echo "🎬 Opening video..."
    open "$VIDEO_FILE"
else
    echo "❌ Video file not found. The recording may have failed."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"