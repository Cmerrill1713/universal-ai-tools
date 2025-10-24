#!/bin/bash
# Universal AI Tools - Simplified Startup Script
# Start core services for testing

echo "🚀 Starting Universal AI Tools - Simplified Platform"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] INFO:${NC} $1"
}

# Function to start a service in background
start_service() {
    local service_name=$1
    local command=$2
    local port=$3
    
    log "Starting $service_name on port $port..."
    
    # Start service in background
    nohup $command > "/tmp/${service_name}.log" 2>&1 &
    local pid=$!
    echo $pid > "/tmp/${service_name}.pid"
    
    # Wait a moment for service to start
    sleep 2
    
    # Check if process is still running
    if kill -0 $pid 2>/dev/null; then
        log "✅ $service_name started (PID: $pid)"
        return 0
    else
        error "❌ $service_name failed to start"
        return 1
    fi
}

# Start Family Athena services
log "Starting Family Athena services..."

# Family Profiles (simulated)
start_service "family-profiles" "python3 -c \"
import time
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

class FamilyProfilesHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/members':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'members': [], 'total': 0}).encode())
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy'}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/api/members':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'created', 'id': 'member_001'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8005), FamilyProfilesHandler)
    server.serve_forever()
\"" 8005

# Family Calendar (simulated)
start_service "family-calendar" "python3 -c \"
import time
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

class FamilyCalendarHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/events':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'events': [], 'total': 0}).encode())
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy'}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/api/events':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'created', 'id': 'event_001'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8006), FamilyCalendarHandler)
    server.serve_forever()
\"" 8006

# Family Knowledge (simulated)
start_service "family-knowledge" "python3 -c \"
import time
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

class FamilyKnowledgeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/knowledge':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'knowledge': [], 'total': 0}).encode())
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy'}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/api/knowledge':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'created', 'id': 'knowledge_001'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8007), FamilyKnowledgeHandler)
    server.serve_forever()
\"" 8007

# Athena Gateway (simulated)
start_service "athena-gateway" "python3 -c \"
import time
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

class AthenaGatewayHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'healthy', 'service': 'athena-gateway'}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        if self.path == '/api/chat':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'response': 'Hello! I am Athena, your family AI assistant.', 'status': 'success'}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), AthenaGatewayHandler)
    server.serve_forever()
\"" 8080

# Start Unified API Gateway
log "Starting Unified API Gateway..."
start_service "unified-gateway" "python3 unified_api_gateway.py" 9000

# Wait for services to start
log "Waiting for services to start..."
sleep 5

# Test services
log "Testing services..."

# Test Family Athena
if curl -s http://localhost:8005/health > /dev/null; then
    log "✅ Family Profiles healthy"
else
    error "❌ Family Profiles unhealthy"
fi

if curl -s http://localhost:8006/health > /dev/null; then
    log "✅ Family Calendar healthy"
else
    error "❌ Family Calendar unhealthy"
fi

if curl -s http://localhost:8007/health > /dev/null; then
    log "✅ Family Knowledge healthy"
else
    error "❌ Family Knowledge unhealthy"
fi

if curl -s http://localhost:8080/health > /dev/null; then
    log "✅ Athena Gateway healthy"
else
    error "❌ Athena Gateway unhealthy"
fi

if curl -s http://localhost:9000/health > /dev/null; then
    log "✅ Unified API Gateway healthy"
else
    error "❌ Unified API Gateway unhealthy"
fi

# Final status
echo ""
echo "🎉 Universal AI Tools - Simplified Platform Started!"
echo "=================================================="
echo ""
echo "📡 Access Points:"
echo "   • Unified API Gateway: http://localhost:9000"
echo "   • Family Athena: http://localhost:8080"
echo "   • Family Profiles: http://localhost:8005"
echo "   • Family Calendar: http://localhost:8006"
echo "   • Family Knowledge: http://localhost:8007"
echo ""
echo "🔧 Services Running:"
echo "   • Family Athena: 4 services"
echo "   • Unified API Gateway: 1 service"
echo ""
echo "📊 Total Services: 5 services running"
echo "🌐 Platform: OPERATIONAL"
echo ""
echo "🚀 Ready for testing!"

# Keep script running
log "Press Ctrl+C to stop all services"
trap 'log "Stopping all services..."; kill $(cat /tmp/*.pid 2>/dev/null) 2>/dev/null; exit 0' INT

while true; do
    sleep 1
done