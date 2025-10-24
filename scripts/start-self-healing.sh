#!/bin/bash

echo "🤖 Starting Universal AI Tools Self-Healing System..."
echo "=================================================="

# Create logs directory if it doesn't exist
mkdir -p logs

# Kill any existing processes
pkill -f "syntax:guard" || true
pkill -f "fix:adaptive" || true
pkill -f "dev:monitor" || true

# Start syntax guardian
echo "🛡️  Starting Syntax Guardian..."
nohup npm run syntax:guard > logs/syntax-guardian.log 2>&1 &
echo $! > logs/syntax-guardian.pid
echo "   PID: $(cat logs/syntax-guardian.pid)"

# Give it a moment to start
sleep 2

# Start adaptive fixer
echo "🔧 Starting Adaptive Auto-Fixer..."
nohup npm run fix:adaptive > logs/adaptive-fixer.log 2>&1 &
echo $! > logs/adaptive-fixer.pid
echo "   PID: $(cat logs/adaptive-fixer.pid)"

# Start error monitor
echo "📊 Starting Real-Time Error Monitor..."
nohup npm run dev:monitor > logs/error-monitor.log 2>&1 &
echo $! > logs/error-monitor.pid
echo "   PID: $(cat logs/error-monitor.pid)"

echo ""
echo "✅ All self-healing services started!"
echo ""
echo "📁 Log files:"
echo "   - logs/syntax-guardian.log"
echo "   - logs/adaptive-fixer.log"
echo "   - logs/error-monitor.log"
echo ""
echo "🛑 To stop all services, run: ./stop-self-healing.sh"
echo ""
echo "📊 To check status: tail -f logs/*.log"