#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🚀 Universal AI Tools - Full Stack Test"
echo "======================================"

# Function to check if a port is open
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${GREEN}✓${NC} $service is running on port $port"
        return 0
    else
        echo -e "${RED}✗${NC} $service is NOT running on port $port"
        return 1
    fi
}

# Function to test API endpoint
test_endpoint() {
    local url=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "X-API-Key: test-api-key-123" \
        -H "X-AI-Service: universal-ai-test" \
        "$url")
    
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}✓ Success${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed (HTTP $response)${NC}"
        return 1
    fi
}

# Check backend services
echo -e "\n${YELLOW}1. Checking Backend Services${NC}"
echo "------------------------------"

check_port 9999 "Main API Server"
BACKEND_RUNNING=$?

check_port 11434 "Ollama"
check_port 1234 "LM Studio"
check_port 6379 "Redis"
check_port 5432 "PostgreSQL"

# Test API endpoints if backend is running
if [ $BACKEND_RUNNING -eq 0 ]; then
    echo -e "\n${YELLOW}2. Testing API Endpoints${NC}"
    echo "-------------------------"
    
    test_endpoint "http://localhost:9999/health" "Health Check"
    test_endpoint "http://localhost:9999/api/v1/agents" "Agents Endpoint"
    
    # Test chat endpoint with POST
    echo -n "Testing Chat Endpoint... "
    chat_response=$(curl -s -X POST http://localhost:9999/api/v1/chat \
        -H "Content-Type: application/json" \
        -H "X-API-Key: test-api-key-123" \
        -H "X-AI-Service: universal-ai-test" \
        -d '{"message":"Hello, this is a test"}' \
        -w "\n%{http_code}")
    
    http_code=$(echo "$chat_response" | tail -n1)
    
    if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "Response: $(echo "$chat_response" | head -n-1)"
    fi
else
    echo -e "\n${RED}⚠️  Backend is not running. Please start it with: npm start${NC}"
fi

# Check frontend
echo -e "\n${YELLOW}3. Checking Frontend${NC}"
echo "---------------------"

check_port 3000 "Frontend Dev Server"
FRONTEND_RUNNING=$?

if [ $FRONTEND_RUNNING -ne 0 ]; then
    check_port 5173 "Vite Dev Server (alternate)"
    FRONTEND_RUNNING=$?
fi

# Test frontend if running
if [ $FRONTEND_RUNNING -eq 0 ]; then
    echo -n "Testing Frontend Health... "
    frontend_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
    
    if [ "$frontend_response" == "200" ]; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed (HTTP $frontend_response)${NC}"
    fi
else
    echo -e "\n${RED}⚠️  Frontend is not running. Please start it with: cd ui && npm run dev${NC}"
fi

# Summary
echo -e "\n${YELLOW}4. Summary${NC}"
echo "----------"

if [ $BACKEND_RUNNING -eq 0 ] && [ $FRONTEND_RUNNING -eq 0 ]; then
    echo -e "${GREEN}✓ Both backend and frontend are running!${NC}"
    echo -e "\nYou can access the application at:"
    echo -e "  Frontend: ${GREEN}http://localhost:3000${NC}"
    echo -e "  Backend API: ${GREEN}http://localhost:9999${NC}"
    echo -e "  Health Check: ${GREEN}http://localhost:9999/health${NC}"
else
    echo -e "${RED}⚠️  Some services are not running.${NC}"
    echo -e "\nTo start the full stack:"
    echo -e "  1. Backend: ${YELLOW}npm start${NC}"
    echo -e "  2. Frontend: ${YELLOW}cd ui && npm run dev${NC}"
fi

echo -e "\n======================================"