#!/bin/bash

# Quick Setup Script for Universal AI Tools
# This script will start the backend and frontend servers

echo "🚀 Universal AI Tools - Quick Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if backend dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

# Check if frontend dependencies are installed
if [ ! -d "ui/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd ui && npm install && cd ..
fi

# Create a simple API key entry (for testing)
echo -e "${GREEN}Setting up test API key...${NC}"
cat > setup-api-key.sql << 'EOF'
-- Create test service if not exists
INSERT INTO ai_services (id, name, type, endpoint, configuration, is_active)
VALUES ('test-service', 'Test Service', 'test', 'http://localhost:9999', '{}', true)
ON CONFLICT (id) DO NOTHING;

-- Create test API key if not exists
INSERT INTO ai_service_keys (service_id, encrypted_key, name, is_active)
VALUES ('test-service', 'universal-ai-tools-production-key-2025', 'Test API Key', true)
ON CONFLICT (encrypted_key) DO NOTHING;
EOF

# Try to apply the SQL (it may fail if tables don't exist yet)
echo "Attempting to set up API key in database..."
curl -s -X POST "http://localhost:54321/rest/v1/rpc/exec_sql" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json" \
  -d @setup-api-key.sql > /dev/null 2>&1

echo ""
echo -e "${GREEN}Starting servers...${NC}"
echo ""

# Function to check if port is in use
check_port() {
    lsof -i :$1 > /dev/null 2>&1
}

# Kill existing processes on our ports
if check_port 9999; then
    echo "Stopping existing process on port 9999..."
    lsof -ti:9999 | xargs kill -9 2>/dev/null
    sleep 2
fi

if check_port 5173; then
    echo "Stopping existing process on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Start backend server
echo -e "${GREEN}Starting backend server on port 9999...${NC}"
npm run dev > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -s http://localhost:9999/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is running!${NC}"
        break
    fi
    sleep 1
done

# Start frontend server
echo -e "${GREEN}Starting frontend server on port 5173...${NC}"
cd ui && npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "Waiting for frontend to start..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is running!${NC}"
        break
    fi
    sleep 1
done

# Clean up temporary file
rm -f setup-api-key.sql

echo ""
echo "=================================="
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "=================================="
echo ""
echo "Services running:"
echo "- Backend API: http://localhost:9999/api"
echo "- Frontend UI: http://localhost:5173"
echo ""
echo "Test credentials:"
echo "- API Key: universal-ai-tools-production-key-2025"
echo "- Service: local-ui"
echo ""
echo "Available pages:"
echo "- Chat: http://localhost:5173/chat"
echo "- Agents: http://localhost:5173/agents"
echo "- Sweet Athena: http://localhost:5173/sweet-athena"
echo ""
echo "Logs:"
echo "- Backend: ./backend.log"
echo "- Frontend: ./frontend.log"
echo ""
echo "To stop servers:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Or press Ctrl+C to stop both servers now..."

# Keep script running and handle cleanup
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

# Keep the script running
while true; do
    sleep 1
done