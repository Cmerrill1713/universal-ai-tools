#!/bin/bash
# Stop Robust Workflows Script

echo "🛑 STOPPING ROBUST WORKFLOW SYSTEM"
echo "================================="

# Stop background processes
echo "🧹 Stopping background processes..."

if [ -f /workspace/health-monitor.pid ]; then
    HEALTH_PID=$(cat /workspace/health-monitor.pid)
    kill $HEALTH_PID 2>/dev/null && echo "✅ Health monitor stopped" || echo "⚠️  Health monitor not running"
    rm -f /workspace/health-monitor.pid
fi

if [ -f /workspace/maintenance.pid ]; then
    MAINTENANCE_PID=$(cat /workspace/maintenance.pid)
    kill $MAINTENANCE_PID 2>/dev/null && echo "✅ Auto maintenance stopped" || echo "⚠️  Auto maintenance not running"
    rm -f /workspace/maintenance.pid
fi

# Stop services
echo "🚫 Stopping services..."

if [ -f /workspace/athena.pid ]; then
    ATHENA_PID=$(cat /workspace/athena.pid)
    kill $ATHENA_PID 2>/dev/null && echo "✅ Athena Gateway stopped" || echo "⚠️  Athena Gateway not running"
    rm -f /workspace/athena.pid
fi

if [ -f /workspace/family.pid ]; then
    FAMILY_PID=$(cat /workspace/family.pid)
    kill $FAMILY_PID 2>/dev/null && echo "✅ Family Athena stopped" || echo "⚠️  Family Athena not running"
    rm -f /workspace/family.pid
fi

if [ -f /workspace/universal.pid ]; then
    UNIVERSAL_PID=$(cat /workspace/universal.pid)
    kill $UNIVERSAL_PID 2>/dev/null && echo "✅ Universal AI Tools stopped" || echo "⚠️  Universal AI Tools not running"
    rm -f /workspace/universal.pid
fi

# Clean up any remaining processes
echo "🧹 Cleaning up remaining processes..."
pkill -f "python3.*http.server" 2>/dev/null && echo "✅ Cleaned up HTTP servers" || echo "ℹ️  No HTTP servers to clean up"

echo ""
echo "✅ ROBUST WORKFLOW SYSTEM STOPPED"
echo "================================="
echo "All workflows and services have been stopped."
echo "The system is now in a clean state."