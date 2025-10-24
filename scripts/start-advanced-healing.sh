#!/bin/bash

echo "🧬 Starting Advanced Universal AI Tools Healing System..."
echo "========================================================="

# Create logs directory if it doesn't exist
mkdir -p logs

# Kill any existing processes
echo "🔄 Stopping existing healing processes..."
pkill -f "syntax:guard" || true
pkill -f "fix:adaptive" || true
pkill -f "dev:monitor" || true
pkill -f "advanced-healing" || true
pkill -f "predictive-healing" || true

# Wait a moment for processes to stop
sleep 2

echo ""
echo "🚀 Starting Advanced Healing Services..."
echo "==========================================="

# Start basic adaptive fixer (already working)
echo "🔧 Starting Adaptive Auto-Fixer..."
nohup npm run fix:adaptive > logs/adaptive-fixer.log 2>&1 &
echo $! > logs/adaptive-fixer.pid
echo "   PID: $(cat logs/adaptive-fixer.pid) ✅"

# Start advanced healing system
echo "🧬 Starting Advanced Healing System..."
nohup tsx src/services/advanced-healing-system.ts > logs/advanced-healing.log 2>&1 &
echo $! > logs/advanced-healing.pid
echo "   PID: $(cat logs/advanced-healing.pid) ✅"

# Start predictive healing agent
echo "🔮 Starting Predictive Healing Agent..."
nohup tsx src/services/predictive-healing-agent.ts > logs/predictive-healing.log 2>&1 &
echo $! > logs/predictive-healing.pid
echo "   PID: $(cat logs/predictive-healing.pid) ✅"

# Start adaptive model optimizer
echo "🧠 Starting Adaptive Model Optimizer..."
nohup tsx src/services/adaptive-model-optimizer.ts > logs/model-optimizer.log 2>&1 &
echo $! > logs/model-optimizer.pid
echo "   PID: $(cat logs/model-optimizer.pid) ✅"

# Start vision browser debugger
echo "👁️ Starting Vision Browser Debugger..."
nohup tsx src/services/vision-browser-debugger.ts > logs/vision-debugger.log 2>&1 &
echo $! > logs/vision-debugger.pid
echo "   PID: $(cat logs/vision-debugger.pid) ✅"

# Give services time to initialize
echo ""
echo "⏳ Initializing healing systems..."
sleep 5

echo ""
echo "✅ Advanced Healing System Activated!"
echo "======================================"
echo ""
echo "🤖 Active Healing Services:"
echo "   • Adaptive Auto-Fixer     - Basic fixes every 1 minute"
echo "   • Advanced Healing System - AI diagnostics every 2 minutes"
echo "   • Predictive Agent        - ML predictions every 3 minutes"
echo "   • Model Optimizer         - MLX fine-tuning with learned patterns"
echo "   • Vision Debugger         - Browser dev tools analysis via computer vision"
echo ""
echo "🧠 Capabilities:"
echo "   • Syntax error detection and auto-fix"
echo "   • Performance issue analysis"
echo "   • Security vulnerability scanning"
echo "   • Memory leak detection"
echo "   • Predictive failure analysis"
echo "   • Pattern learning and adaptation"
echo "   • MLX model fine-tuning with healing insights"
echo "   • Automatic model conversion (Ollama/HuggingFace → MLX)"
echo "   • Computer vision browser debugging"
echo "   • Console error detection via screenshots"
echo "   • Network issue analysis from dev tools"
echo "   • UI/UX problem identification"
echo ""
echo "📊 Monitoring:"
echo "   • Real-time system diagnostics"
echo "   • Proactive issue prevention"
echo "   • Self-improving algorithms"
echo "   • Automated code quality optimization"
echo ""
echo "📁 Log files:"
echo "   - logs/adaptive-fixer.log      (Basic auto-fixes)"
echo "   - logs/advanced-healing.log    (AI diagnostics)"
echo "   - logs/predictive-healing.log  (ML predictions)"
echo "   - logs/model-optimizer.log     (MLX fine-tuning)"
echo "   - logs/vision-debugger.log     (Browser vision analysis)"
echo "   - logs/healing-memory.json     (Learning data)"
echo "   - logs/screenshots/            (Vision analysis screenshots)"
echo ""
echo "🛑 To stop all services: ./stop-advanced-healing.sh"
echo "📊 To check status: tail -f logs/*.log"
echo "🔍 To view healing memory: cat logs/healing-memory.json"
echo ""
echo "🌟 Your codebase is now under advanced AI protection!"