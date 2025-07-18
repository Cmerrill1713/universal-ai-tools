#!/bin/bash

echo "Universal AI Tools Integration Test"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✓${NC} $service is running on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $service is not running on port $port"
        return 1
    fi
}

# Function to wait for a service to start
wait_for_service() {
    local port=$1
    local service=$2
    local max_attempts=30
    local attempt=0
    
    echo "Waiting for $service to start on port $port..."
    while [ $attempt -lt $max_attempts ]; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
            echo -e "${GREEN}✓${NC} $service started successfully"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗${NC} $service failed to start within 30 seconds"
    return 1
}

# Check if Supabase is running
echo "1. Checking Supabase..."
if ! check_service 54321 "Supabase"; then
    echo -e "${YELLOW}Starting Supabase...${NC}"
    cd "$(dirname "$0")/.."
    npx supabase start &
    wait_for_service 54321 "Supabase"
fi

# Install backend dependencies
echo ""
echo "2. Installing backend dependencies..."
cd "$(dirname "$0")/.."
npm install

# Start the Socket.IO server
echo ""
echo "3. Starting Socket.IO server..."
npm run dev:socketio &
BACKEND_PID=$!
wait_for_service 9999 "Socket.IO server"

# Install frontend dependencies
echo ""
echo "4. Installing frontend dependencies..."
cd ui
npm install

# Start the frontend
echo ""
echo "5. Starting frontend development server..."
npm run dev &
FRONTEND_PID=$!
wait_for_service 5173 "Frontend"

# Test registration
echo ""
echo "6. Testing service registration..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:9999/api/register \
  -H "Content-Type: application/json" \
  -d '{"service_name": "Test Service", "service_type": "custom"}')

if [ $? -eq 0 ]; then
    API_KEY=$(echo $REGISTER_RESPONSE | jq -r '.api_key')
    SERVICE_ID=$(echo $REGISTER_RESPONSE | jq -r '.service_id')
    
    if [ "$API_KEY" != "null" ] && [ "$SERVICE_ID" != "null" ]; then
        echo -e "${GREEN}✓${NC} Service registered successfully"
        echo "   API Key: ${API_KEY:0:20}..."
        echo "   Service ID: $SERVICE_ID"
    else
        echo -e "${RED}✗${NC} Registration failed"
        echo $REGISTER_RESPONSE
    fi
else
    echo -e "${RED}✗${NC} Failed to connect to registration endpoint"
fi

# Test health check with authentication
echo ""
echo "7. Testing authenticated health check..."
HEALTH_RESPONSE=$(curl -s http://localhost:9999/health \
  -H "X-API-Key: $API_KEY" \
  -H "X-AI-Service: Test Service")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Health check passed"
else
    echo -e "${RED}✗${NC} Health check failed"
fi

# Test WebSocket connection
echo ""
echo "8. Testing WebSocket connection..."
node -e "
const io = require('socket.io-client');
const socket = io('http://localhost:9999', {
  auth: { token: '$API_KEY' }
});

socket.on('connect', () => {
  console.log('✓ WebSocket connected');
  socket.emit('subscribe:memory');
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

socket.on('error', (error) => {
  console.error('✗ WebSocket error:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('✗ WebSocket connection timeout');
  process.exit(1);
}, 5000);
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} WebSocket connection successful"
else
    echo -e "${RED}✗${NC} WebSocket connection failed"
fi

# Summary
echo ""
echo "=================================="
echo "Integration Test Summary"
echo "=================================="
echo ""
echo "Backend URL: http://localhost:9999"
echo "Frontend URL: http://localhost:5173"
echo "API Documentation: http://localhost:9999/api/docs"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Keep the script running
wait $BACKEND_PID $FRONTEND_PID