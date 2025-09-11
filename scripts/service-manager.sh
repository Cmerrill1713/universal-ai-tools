#!/bin/bash
# Universal AI Tools Service Manager

PLIST_PATH="$HOME/Library/LaunchAgents/com.universal.ai-tools.plist"
APP_PATH="/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources"
SERVICE_URL="http://localhost:9999"
SUPABASE_URL="http://localhost:54321"

show_usage() {
    echo "Universal AI Tools Service Manager"
    echo "================================="
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start      Start the service"
    echo "  stop       Stop the service"
    echo "  restart    Restart the service"
    echo "  status     Check service status"
    echo "  install    Install auto-start (login)"
    echo "  uninstall  Remove auto-start"
    echo "  logs       Show service logs"
    echo "  open       Open the web interface"
    echo "  dashboard  Open Supabase dashboard"
    echo ""
}

check_dependencies() {
    echo "🔍 Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install from https://nodejs.org"
        exit 1
    fi
    echo "   ✅ Node.js: $(node --version)"
    
    # Check if Supabase is running
    if ! curl -s "$SUPABASE_URL/health" &> /dev/null; then
        echo "⚠️  Supabase not running. Starting..."
        cd "$APP_PATH" && supabase start
        if [ $? -ne 0 ]; then
            echo "❌ Failed to start Supabase. Please run 'supabase start' manually"
            exit 1
        fi
    fi
    echo "   ✅ Supabase running"
    
    # Check if app files exist
    if [ ! -f "$APP_PATH/dist/server.js" ]; then
        echo "⚠️  Application not built. Building..."
        cd "$APP_PATH" && npm run build
        if [ $? -ne 0 ]; then
            echo "❌ Build failed"
            exit 1
        fi
    fi
    echo "   ✅ Application built"
}

start_service() {
    echo "🚀 Starting Universal AI Tools service..."
    check_dependencies
    
    cd "$APP_PATH"
    
    # Check if already running
    if curl -s "$SERVICE_URL/health" &> /dev/null; then
        echo "   ⚠️  Service already running at $SERVICE_URL"
        return 0
    fi
    
    # Start the service
    nohup node dist/server.js > /tmp/universal-ai-tools.log 2>&1 &
    echo $! > /tmp/universal-ai-tools.pid
    
    # Wait a moment and check if it started
    sleep 3
    if curl -s "$SERVICE_URL/health" &> /dev/null; then
        echo "   ✅ Service started successfully"
        echo "   🌐 Web interface: $SERVICE_URL"
        echo "   📊 Dashboard: Open supabase_dashboard.html"
    else
        echo "   ❌ Service failed to start. Check logs: tail -f /tmp/universal-ai-tools.log"
        exit 1
    fi
}

stop_service() {
    echo "🛑 Stopping Universal AI Tools service..."
    
    # Kill by PID file
    if [ -f /tmp/universal-ai-tools.pid ]; then
        PID=$(cat /tmp/universal-ai-tools.pid)
        if ps -p $PID > /dev/null; then
            kill $PID
            echo "   ✅ Service stopped (PID: $PID)"
        fi
        rm -f /tmp/universal-ai-tools.pid
    fi
    
    # Kill any remaining processes
    pkill -f "node.*server.js" 2>/dev/null || true
    echo "   ✅ Service stopped"
}

service_status() {
    echo "📊 Universal AI Tools Service Status"
    echo "===================================="
    
    # Check service
    if curl -s "$SERVICE_URL/health" &> /dev/null; then
        echo "🟢 Service: Running at $SERVICE_URL"
    else
        echo "🔴 Service: Not running"
    fi
    
    # Check Supabase
    if curl -s "$SUPABASE_URL/health" &> /dev/null; then
        echo "🟢 Supabase: Running at $SUPABASE_URL"
    else
        echo "🔴 Supabase: Not running"
    fi
    
    # Check LaunchAgent
    if [ -f "$PLIST_PATH" ]; then
        if launchctl list | grep -q "com.universal.ai-tools"; then
            echo "🟢 Auto-start: Enabled and loaded"
        else
            echo "🟡 Auto-start: Enabled but not loaded"
        fi
    else
        echo "🔴 Auto-start: Disabled"
    fi
    
    echo ""
    echo "💾 Disk Usage:"
    du -sh "$APP_PATH" 2>/dev/null | sed 's/^/   /'
    
    echo ""
    echo "📈 Memory Usage:"
    ps aux | grep -E "(node|supabase)" | grep -v grep | awk '{print "   " $11 ": " $4"% CPU, " $6/1024"MB RAM"}'
}

install_autostart() {
    echo "⚙️  Installing auto-start service..."
    
    if [ ! -f "$PLIST_PATH" ]; then
        echo "❌ LaunchAgent plist not found. Run create_service_integration.py first"
        exit 1
    fi
    
    # Load the service
    launchctl load "$PLIST_PATH"
    echo "   ✅ Auto-start enabled"
    echo "   ℹ️  Service will start automatically on login"
}

uninstall_autostart() {
    echo "🗑️  Uninstalling auto-start service..."
    
    if [ -f "$PLIST_PATH" ]; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        rm -f "$PLIST_PATH"
        echo "   ✅ Auto-start disabled and removed"
    else
        echo "   ⚠️  Auto-start was not installed"
    fi
}

show_logs() {
    echo "📋 Service Logs (press Ctrl+C to stop)"
    echo "======================================"
    
    if [ -f /tmp/universal-ai-tools.log ]; then
        tail -f /tmp/universal-ai-tools.log
    else
        echo "No logs found. Service may not be running."
    fi
}

open_interface() {
    echo "🌐 Opening Universal AI Tools interface..."
    open "$SERVICE_URL"
}

open_dashboard() {
    echo "📊 Opening Supabase dashboard..."
    open "$APP_PATH/supabase_dashboard.html"
}

# Main command handling
case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service
        sleep 2
        start_service
        ;;
    status)
        service_status
        ;;
    install)
        install_autostart
        ;;
    uninstall)
        uninstall_autostart
        ;;
    logs)
        show_logs
        ;;
    open)
        open_interface
        ;;
    dashboard)
        open_dashboard
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
