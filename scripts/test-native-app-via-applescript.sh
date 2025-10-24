#!/bin/bash

echo "🧪 Testing Native Swift App via AppleScript"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if app is running
if ps aux | grep -v grep | grep -q "NeuroForgeApp"; then
    echo "✅ Native app is running"
else
    echo "❌ Native app is not running"
    exit 1
fi

echo ""
echo "📱 Testing App Window Interaction"
echo "──────────────────────────────────────────────────────────"

# Try to bring app to front and test UI
osascript << 'APPLESCRIPT'
tell application "System Events"
    set appName to "NeuroForgeApp"
    
    -- Check if app is running
    if exists process appName then
        tell process appName
            set frontmost to true
            delay 1
            
            -- Try to find text field and type
            try
                set textFields to text fields of window 1
                if (count of textFields) > 0 then
                    set value of text field 1 of window 1 to "What is 2 + 2?"
                    delay 0.5
                    
                    -- Try to click send button
                    try
                        click button "Send message" of window 1
                        return "✅ Successfully sent test message: 'What is 2 + 2?'"
                    on error errMsg
                        return "⚠️  Found text field but couldn't click send button: " & errMsg
                    end try
                else
                    return "⚠️  No text fields found in window"
                end if
            on error errMsg
                return "❌ Could not interact with UI: " & errMsg
            end try
        end tell
    else
        return "❌ App not found in process list"
    end if
end tell
APPLESCRIPT

echo ""
echo "📊 Checking App Logs"
echo "──────────────────────────────────────────────────────────"
tail -20 /tmp/neuroforge-app.log 2>/dev/null || echo "No logs available"

echo ""
echo "🌐 Checking Network Activity"
echo "──────────────────────────────────────────────────────────"
lsof -i -P | grep NeuroForge || echo "No active connections"

echo ""
echo "════════════════════════════════════════════════════════════"

