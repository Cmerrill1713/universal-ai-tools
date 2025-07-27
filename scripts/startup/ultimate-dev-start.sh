#!/bin/bash

echo "🚀 Starting Ultimate Developer Environment..."
echo "=========================================="

# Function to start service in background
start_service() {
    local name=$1
    local command=$2
    echo "Starting $name..."
    nohup $command > "logs/${name}.log" 2>&1 &
    echo $! >> logs/ultimate-dev.pid
}

# Create logs directory
mkdir -p logs

# Clear previous PIDs
> logs/ultimate-dev.pid

# 1. Self-Healing Services (if not already running)
if ! pgrep -f "syntax:guard" > /dev/null; then
    ./start-self-healing.sh
fi

# 2. Smart Development Server
start_service "smart-server" "npm run dev:smart"

# 3. Enhanced Diagnostics
start_service "diagnostics" "npm run dev:diagnose"

# 4. Performance Monitor
start_service "perf-monitor" "npm run test:performance -- --watch"

# 5. AI Memory Visualizer
start_service "memory-viz" "npm run view:memories -- --server"

# Wait for services to start
sleep 5

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Access points:"
echo "   - Main App: http://localhost:8080"
echo "   - Diagnostics: http://localhost:8081"
echo "   - Performance: http://localhost:8082"
echo "   - AI Memory: http://localhost:8083"
echo ""
echo "📁 Logs available in ./logs/"
echo ""
echo "🛑 To stop all: ./scripts/startup/ultimate-dev-stop.sh"