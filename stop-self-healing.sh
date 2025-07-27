#!/bin/bash

echo "🛑 Stopping Self-Healing Services..."

# Stop processes using PIDs
if [ -f logs/syntax-guardian.pid ]; then
    kill $(cat logs/syntax-guardian.pid) 2>/dev/null && echo "✅ Stopped Syntax Guardian"
    rm logs/syntax-guardian.pid
fi

if [ -f logs/adaptive-fixer.pid ]; then
    kill $(cat logs/adaptive-fixer.pid) 2>/dev/null && echo "✅ Stopped Adaptive Fixer"
    rm logs/adaptive-fixer.pid
fi

if [ -f logs/error-monitor.pid ]; then
    kill $(cat logs/error-monitor.pid) 2>/dev/null && echo "✅ Stopped Error Monitor"
    rm logs/error-monitor.pid
fi

# Also kill by process name as backup
pkill -f "syntax:guard" 2>/dev/null
pkill -f "fix:adaptive" 2>/dev/null
pkill -f "dev:monitor" 2>/dev/null

echo "✅ All self-healing services stopped"