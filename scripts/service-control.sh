#!/bin/bash

# Universal AI Tools Service Control Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="universal-ai-tools"
PORT=9999

show_help() {
    echo "🤖 Universal AI Tools Service Control"
    echo "===================================="
    echo ""
    echo "Usage: $0 {start|stop|restart|status|logs|health}"
    echo ""
    echo "Commands:"
    echo "  start     Start the service"
    echo "  stop      Stop the service"
    echo "  restart   Restart the service"
    echo "  status    Show service status"
    echo "  logs      Show service logs"
    echo "  health    Check service health"
    echo ""
}

check_service() {
    if lsof -i :$PORT >/dev/null 2>&1; then
        return 0  # Service is running
    else
        return 1  # Service is not running
    fi
}

start_service() {
    if check_service; then
        echo "✅ Service is already running on port $PORT"
        return 0
    fi
    
    echo "🚀 Starting Universal AI Tools service..."
    cd "$PROJECT_DIR"
    
    # Start in background (using test service for now)
    node test-service.js > /tmp/universal-ai-tools.out 2>&1 &
    
    # Wait for service to start
    for i in {1..10}; do
        if check_service; then
            echo "✅ Service started successfully on port $PORT"
            echo "🌐 Chat UI: http://localhost:$PORT"
            return 0
        fi
        echo "⏳ Waiting for service... ($i/10)"
        sleep 1
    done
    
    echo "❌ Service failed to start. Check logs for details."
    return 1
}

stop_service() {
    if ! check_service; then
        echo "⚠️  Service is not running"
        return 0
    fi
    
    echo "🛑 Stopping Universal AI Tools service..."
    pkill -f "$SERVICE_NAME"
    
    # Wait for service to stop
    for i in {1..5}; do
        if ! check_service; then
            echo "✅ Service stopped successfully"
            return 0
        fi
        echo "⏳ Waiting for service to stop... ($i/5)"
        sleep 1
    done
    
    echo "⚠️  Service may still be running. Try: pkill -9 -f $SERVICE_NAME"
    return 1
}

restart_service() {
    echo "🔄 Restarting Universal AI Tools service..."
    stop_service
    sleep 2
    start_service
}

show_status() {
    echo "📊 Universal AI Tools Status"
    echo "============================"
    echo ""
    
    if check_service; then
        echo "✅ Service: Running on port $PORT"
        
        # Check API health
        if curl -s http://localhost:$PORT/health >/dev/null; then
            echo "✅ API: Responding"
        else
            echo "❌ API: Not responding"
        fi
        
        # Check Ollama
        if curl -s http://localhost:11434/api/tags >/dev/null; then
            echo "✅ Ollama: Available"
        else
            echo "❌ Ollama: Not available"
        fi
        
        # Check Supabase
        if curl -s http://localhost:54321/rest/v1/ >/dev/null; then
            echo "✅ Supabase: Running"
        else
            echo "❌ Supabase: Not running"
        fi
        
    else
        echo "❌ Service: Not running"
    fi
    
    echo ""
    echo "🔗 URLs:"
    echo "  Chat UI: http://localhost:$PORT"
    echo "  API Docs: http://localhost:$PORT/api/docs"
    echo "  Health: http://localhost:$PORT/health"
}

show_logs() {
    echo "📋 Service Logs (last 20 lines)"
    echo "==============================="
    
    if [ -f "/tmp/universal-ai-tools.out" ]; then
        tail -20 /tmp/universal-ai-tools.out
    else
        echo "No logs found at /tmp/universal-ai-tools.out"
    fi
    
    echo ""
    echo "📋 Error Logs"
    echo "============="
    
    if [ -f "/tmp/universal-ai-tools.err" ]; then
        tail -10 /tmp/universal-ai-tools.err
    else
        echo "No error logs found"
    fi
}

check_health() {
    echo "🏥 Health Check"
    echo "==============="
    echo ""
    
    if check_service; then
        echo "Testing API endpoints..."
        
        # Test health endpoint
        if response=$(curl -s http://localhost:$PORT/health); then
            echo "✅ Health endpoint: OK"
            echo "   Response: $response"
        else
            echo "❌ Health endpoint: Failed"
        fi
        
        # Test registration endpoint
        if curl -s http://localhost:$PORT/api/register >/dev/null; then
            echo "✅ Registration endpoint: OK"
        else
            echo "❌ Registration endpoint: Failed"
        fi
        
    else
        echo "❌ Service is not running"
    fi
}

case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        restart_service
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    health)
        check_health
        ;;
    *)
        show_help
        exit 1
        ;;
esac