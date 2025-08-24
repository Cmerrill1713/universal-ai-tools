#!/bin/bash

echo "🔍 Checking UE5 Plugin Status"
echo "============================="
echo ""

# Required plugins for Sweet Athena
REQUIRED_PLUGINS=(
    "PixelStreaming"
    "MetaHuman"
    "LiveLink"
    "LiveLinkControlRig"
    "LiveLinkFace"
    "AudioCapture"
    "ConvAI"
    "VoiceChat"
    "WebBrowserWidget"
    "JsonBlueprint"
    "HTTPBlueprint"
    "WebSocket"
)

echo "📋 Required Plugins for Sweet Athena:"
echo ""

# Check project file
PROJECT_FILE="$HOME/UE5-SweetAthena/SweetAthenaUE5Project.uproject"
if [ -f "$PROJECT_FILE" ]; then
    echo "✅ Project file found"
    echo ""
    echo "Plugins listed in project:"
    for plugin in "${REQUIRED_PLUGINS[@]}"; do
        if grep -q "\"Name\": \"$plugin\"" "$PROJECT_FILE"; then
            echo "  ✅ $plugin - Configured"
        else
            echo "  ❌ $plugin - Not in project file"
        fi
    done
else
    echo "❌ Project file not found!"
fi

echo ""
echo "🛠️ To Enable Missing Plugins in UE5:"
echo "1. In UE5, go to Edit → Plugins"
echo "2. Search and enable these plugins:"
echo ""
echo "Critical for Pixel Streaming:"
echo "  • Pixel Streaming (Built-in & Marketplace)"
echo "  • WebRTC"
echo "  • Video I/O Framework"
echo ""
echo "For MetaHuman Avatar:"
echo "  • MetaHuman"
echo "  • Live Link Face"
echo "  • Live Link Control Rig"
echo "  • Groom"
echo "  • Alembic Groom Importer"
echo ""
echo "For Voice/Audio:"
echo "  • Convai Plugin (from Marketplace)"
echo "  • Audio Capture"
echo "  • Voice Chat"
echo ""
echo "3. After enabling, restart UE5 when prompted"
echo ""
echo "🎯 Quick Fix Commands:"
echo ""
echo "If Pixel Streaming isn't working, in UE5 console type:"
echo "  PixelStreaming.WebRTC.StartStreaming"
echo "  PixelStreaming.WebRTC.PixelStreamingIP=localhost"
echo "  PixelStreaming.WebRTC.PixelStreamingPort=8888"