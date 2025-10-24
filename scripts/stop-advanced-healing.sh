#!/bin/bash

echo "🛑 Stopping Advanced Universal AI Tools Healing System..."
echo "========================================================"

# Function to stop a service by PID file
stop_service() {
    local service_name=$1
    local pid_file=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "🔴 Stopping $service_name (PID: $pid)..."
            kill "$pid"
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                echo "   Force stopping $service_name..."
                kill -9 "$pid"
            fi
            echo "   ✅ $service_name stopped"
        else
            echo "   ⚠️ $service_name was not running"
        fi
        rm -f "$pid_file"
    else
        echo "   ⚠️ No PID file for $service_name"
    fi
}

# Stop all healing services
echo "🔄 Stopping healing services..."
stop_service "Adaptive Auto-Fixer" "logs/adaptive-fixer.pid"
stop_service "Advanced Healing System" "logs/advanced-healing.pid"
stop_service "Predictive Healing Agent" "logs/predictive-healing.pid"
stop_service "Adaptive Model Optimizer" "logs/model-optimizer.pid"
stop_service "Vision Browser Debugger" "logs/vision-debugger.pid"

# Kill any remaining processes by name
echo "🧹 Cleaning up remaining processes..."
pkill -f "syntax:guard" && echo "   ✅ Syntax Guardian stopped" || echo "   ℹ️ Syntax Guardian was not running"
pkill -f "fix:adaptive" && echo "   ✅ Adaptive Fixer stopped" || echo "   ℹ️ Adaptive Fixer was not running"
pkill -f "dev:monitor" && echo "   ✅ Error Monitor stopped" || echo "   ℹ️ Error Monitor was not running"
pkill -f "advanced-healing-system" && echo "   ✅ Advanced Healing stopped" || echo "   ℹ️ Advanced Healing was not running"
pkill -f "predictive-healing-agent" && echo "   ✅ Predictive Agent stopped" || echo "   ℹ️ Predictive Agent was not running"
pkill -f "adaptive-model-optimizer" && echo "   ✅ Model Optimizer stopped" || echo "   ℹ️ Model Optimizer was not running"
pkill -f "vision-browser-debugger" && echo "   ✅ Vision Debugger stopped" || echo "   ℹ️ Vision Debugger was not running"

echo ""
echo "✅ All Advanced Healing Services Stopped"
echo "========================================"
echo ""
echo "📊 Final Status:"
echo "   • All healing processes terminated"
echo "   • Learning data preserved in logs/healing-memory.json"
echo "   • Log files archived for analysis"
echo ""
echo "📁 Preserved data:"
echo "   - logs/healing-memory.json     (AI learning data)"
echo "   - logs/adaptive-fixer.log      (Fix history)"
echo "   - logs/advanced-healing.log    (Diagnostic history)"
echo "   - logs/predictive-healing.log  (Prediction history)"
echo "   - logs/model-optimizer.log     (MLX fine-tuning history)"
echo "   - logs/vision-debugger.log     (Browser analysis history)"
echo "   - logs/screenshots/            (Vision analysis screenshots)"
echo ""
echo "🔄 To restart: ./start-advanced-healing.sh"
echo "🗑️ To clean logs: rm -f logs/*.log"