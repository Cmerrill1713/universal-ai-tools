#!/bin/bash

# Universal AI Tools - Complete Screener Video Creator
# This script handles everything: screen recording + browser automation

echo "🎥 UNIVERSAL AI TOOLS - AUTOMATED VIDEO DEMO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create output directory
mkdir -p screener-output

# Generate filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
VIDEO_FILE="screener-output/universal-ai-tools-demo-${TIMESTAMP}.mov"

echo "📹 Starting screen recording in 3 seconds..."
echo "   The recording will capture your entire screen"
echo "   Video will be saved to: $VIDEO_FILE"
echo ""

# Countdown
for i in 3 2 1; do
    echo "   Starting in $i..."
    sleep 1
done

# Start QuickTime screen recording using AppleScript
osascript <<EOF &
tell application "QuickTime Player"
    activate
    new screen recording
    delay 2
    tell application "System Events"
        keystroke " " -- Start recording
    end tell
end tell
EOF

# Give QuickTime time to start recording
sleep 3

echo "✅ Recording started!"
echo ""
echo "🌐 Now opening Chrome and demonstrating features..."
echo ""

# Open Chrome with the UI
open -na "Google Chrome" --args \
    --new-window \
    --window-size=1920,1080 \
    --window-position=0,0 \
    "http://localhost:3000"

# Wait for page to load
sleep 5

# Use AppleScript to navigate through the demo
osascript <<'DEMO_SCRIPT'
tell application "Google Chrome"
    activate
    
    -- Ensure we're on the landing page
    delay 3
    
    -- Navigate to Chat
    set URL of active tab of window 1 to "http://localhost:3000/chat"
    delay 4
    
    -- Navigate to Dashboard
    set URL of active tab of window 1 to "http://localhost:3000/dashboard"
    delay 4
    
    -- Scroll down on dashboard
    tell application "System Events"
        repeat 2 times
            key code 125 using {command down} -- Page Down
            delay 2
        end repeat
    end tell
    
    -- Navigate to Projects
    set URL of active tab of window 1 to "http://localhost:3000/projects"
    delay 4
    
    -- Navigate to Agents
    set URL of active tab of window 1 to "http://localhost:3000/agents"
    delay 4
    
    -- Navigate to API Docs
    set URL of active tab of window 1 to "http://localhost:3000/api-docs"
    delay 4
    
    -- Back to Dashboard for finale
    set URL of active tab of window 1 to "http://localhost:3000/dashboard"
    delay 3
end tell
DEMO_SCRIPT

echo ""
echo "📍 Demo navigation complete!"
echo ""
echo "⏹️  Stop the recording now:"
echo "   1. Click on QuickTime Player"
echo "   2. Click the Stop button in the menu bar"
echo "   3. Save the video as: $VIDEO_FILE"
echo ""
echo "Press ENTER when you've saved the recording..."
read

# Open the saved video
if [ -f "$VIDEO_FILE" ]; then
    echo "✅ Opening your video..."
    open "$VIDEO_FILE"
else
    echo "💡 Tip: Make sure to save the video to: $VIDEO_FILE"
fi

echo ""
echo "🎬 Demo complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"