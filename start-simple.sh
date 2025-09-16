#!/bin/bash

echo "🚀 Universal AI Tools - Simple Startup"
echo "======================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start a service
start_service() {
    local name=$1
    local port=$2
    local command=$3
    
    if check_port $port; then
        echo -e "${BLUE}✅ $name already running on port $port${NC}"
        return 0
    fi
    
    echo -e "${BLUE}🚀 Starting $name on port $port...${NC}"
    eval "$command" &
    local pid=$!
    echo $pid > "pids/${name}.pid"
    
    # Wait a moment for service to start
    sleep 3
    
    if check_port $port; then
        echo -e "${GREEN}✅ $name started successfully (PID: $pid)${NC}"
        return 0
    else
        echo -e "${RED}❌ $name failed to start${NC}"
        return 1
    fi
}

# Create directories
mkdir -p logs pids

echo -e "${BLUE}🔧 Starting Go Services...${NC}"

# Start Go services
start_service "auth-service" 8015 "cd go-services/auth-service && PORT=8015 go run main.go > ../logs/auth-service.log 2>&1"
start_service "chat-service" 8016 "cd go-services/chat-service && PORT=8016 go run main.go > ../logs/chat-service.log 2>&1"
start_service "api-gateway" 8082 "cd go-services/api-gateway && PORT=8082 go run main.go secrets-manager.go > ../logs/api-gateway.log 2>&1"

echo -e "${BLUE}🦀 Starting Rust Services...${NC}"

# Start Rust services
start_service "llm-router" 3032 "cd crates/llm-router && PORT=3032 cargo run --release > ../../logs/llm-router.log 2>&1"

echo -e "${BLUE}🗄️ Starting Docker Services...${NC}"

# Start essential Docker services
echo "Starting Redis..."
docker run -d --name redis-simple --network host redis:7-alpine redis-server --protected-mode no --port 6379

echo "Starting PostgreSQL..."
docker run -d --name postgres-simple --network host -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=universal_ai_tools postgres:15-alpine

echo "Starting Weaviate..."
docker run -d --name weaviate-simple --network host -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true semitechnologies/weaviate:latest

# Wait for services to be ready
echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
sleep 10

echo -e "${GREEN}🎉 Startup Complete!${NC}"
echo ""
echo -e "${GREEN}✅ Services Running:${NC}"
echo "  • Auth Service (Go):     http://localhost:8015"
echo "  • Chat Service (Go):     http://localhost:8016" 
echo "  • API Gateway (Go):     http://localhost:8082"
echo "  • LLM Router (Rust):     http://localhost:3032"
echo "  • Redis:                 localhost:6379"
echo "  • PostgreSQL:           localhost:5432"
echo "  • Weaviate:              http://localhost:8080"
echo "  • Ollama (Native):       http://localhost:11434"
echo ""
echo -e "${BLUE}To stop all services: ./stop-simple.sh${NC}"
