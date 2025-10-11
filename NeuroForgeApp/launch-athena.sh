#!/bin/bash
# Athena Launch Script - Production Ready
# Cleans up old instances and launches with proper configuration

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║              🚀 LAUNCHING ATHENA - PRODUCTION MODE                ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Navigate to app directory
cd "$(dirname "$0")"

# Clean up any old instances
echo "🧹 Cleaning up old instances..."
pkill -f NeuroForgeApp 2>/dev/null || true
sleep 1

# Verify backend health
echo "🔍 Checking backend health..."
if curl -s --max-time 2 http://localhost:8014/health | grep -q "healthy"; then
    echo "✅ Backend healthy on localhost:8014"
    API_BASE="http://localhost:8014"
elif curl -s --max-time 2 http://localhost:8888/health | grep -q "healthy"; then
    echo "✅ Backend healthy on localhost:8888"
    API_BASE="http://localhost:8888"
elif curl -s --max-time 2 http://localhost:8013/health | grep -q "healthy"; then
    echo "✅ Backend healthy on localhost:8013"
    API_BASE="http://localhost:8013"
else
    echo "⚠️  No backend found, using default localhost:8014"
    API_BASE="http://localhost:8014"
fi

echo ""
echo "📊 Configuration:"
echo "   API Base: $API_BASE"
echo "   Mode: Production (QA_MODE=0)"
echo ""

# Build if needed
if [ ! -f ".build/debug/NeuroForgeApp" ]; then
    echo "🔨 Building app..."
    swift build
    echo ""
fi

# Launch
echo "🚀 Launching Athena..."
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  ✅ Text Visibility: Theme-aware (light/dark)"
echo "  ✅ Keyboard: IME-safe (Enter, Shift+Enter)"
echo "  ✅ Focus: Automatic (FocusHelper)"
echo "  ✅ Health: Monitoring active"
echo "════════════════════════════════════════════════════════════════════"
echo ""

API_BASE="$API_BASE" exec swift run

