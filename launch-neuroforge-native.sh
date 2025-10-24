#!/bin/bash

echo "🚀 Launching NeuroForge AI - Native macOS App"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if Athena Gateway is running
echo "1. Checking Athena Gateway connection..."
if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo "   ✅ Athena Gateway is running on http://localhost:8080"
else
    echo "   ⚠️  Athena Gateway not detected. Starting it now..."
    echo ""
    echo "   Starting Athena-Centric system..."
    cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools
    ./start-athena-unified.sh
    
    echo "   ⏳ Waiting for Athena Gateway to be ready..."
    for i in {1..20}; do
        if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
            echo "   ✅ Athena Gateway is ready!"
            break
        fi
        sleep 2
    done
fi

# Check if macOS automation service is running
echo ""
echo "2. Checking macOS Automation Service..."
if curl -sf http://localhost:9876/health > /dev/null 2>&1; then
    echo "   ✅ macOS Automation Service is running"
else
    echo "   ⚠️  Starting macOS Automation Service..."
    cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools
    python3 browser-opener-service.py > /tmp/macos-automation.log 2>&1 &
    echo $! > /tmp/macos-automation.pid
    sleep 2
    echo "   ✅ macOS Automation Service started"
fi

echo ""
echo "3. Launching NeuroForge AI..."
echo "════════════════════════════════════════════════════════════"
echo ""

# Launch the native app
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/NeuroForgeApp
swift run

echo ""
echo "════════════════════════════════════════════════════════════"
echo "NeuroForge AI has been closed"
echo ""

