#!/bin/bash

# Universal AI Tools - Simple Demo Recorder
# Uses macOS built-in screen recording

echo "🎥 UNIVERSAL AI TOOLS - DEMO RECORDER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "INSTRUCTIONS:"
echo "1. Press Cmd+Shift+5 to open screen recording"
echo "2. Click 'Record Entire Screen' or select an area"
echo "3. Click 'Record' button"
echo "4. This script will navigate the UI automatically"
echo "5. Click Stop button in menu bar when done"
echo ""
echo "Press ENTER when you've started recording..."
read

echo "🌐 Opening Universal AI Tools UI..."

# Open Chrome with the app
open -na "Google Chrome" --args \
    --new-window \
    --window-size=1920,1080 \
    --window-position=0,0 \
    "http://localhost:3000"

sleep 5

echo "📍 Navigating to Chat..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/chat"'
sleep 5

echo "📍 Navigating to Dashboard..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/dashboard"'
sleep 5

echo "📍 Navigating to Projects..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/projects"'
sleep 4

echo "📍 Navigating to AI Agents..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/agents"'
sleep 4

echo "📍 Navigating to API Docs..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/api-docs"'
sleep 4

echo "📍 Returning to Dashboard for finale..."
osascript -e 'tell application "Google Chrome" to set URL of active tab of window 1 to "http://localhost:3000/dashboard"'
sleep 3

echo ""
echo "✅ Demo navigation complete!"
echo ""
echo "⏹️  Click the Stop button in the menu bar to stop recording"
echo "💾 Save your video when prompted"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"