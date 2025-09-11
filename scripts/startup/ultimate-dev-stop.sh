#!/bin/bash

echo "🛑 Stopping Ultimate Developer Environment..."

# Stop services using PID file
if [ -f logs/ultimate-dev.pid ]; then
    while read pid; do
        kill $pid 2>/dev/null && echo "✅ Stopped process $pid"
    done < logs/ultimate-dev.pid
    rm logs/ultimate-dev.pid
fi

# Also stop self-healing services
if [ -f ./stop-self-healing.sh ]; then
    ./stop-self-healing.sh
fi

# Kill any remaining processes by name
pkill -f "dev:smart" 2>/dev/null
pkill -f "dev:diagnose" 2>/dev/null
pkill -f "test:performance" 2>/dev/null
pkill -f "view:memories" 2>/dev/null

echo "✅ All services stopped"