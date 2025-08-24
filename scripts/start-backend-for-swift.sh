#!/bin/bash

# Start backend services for Swift app
# This script is called by the Swift frontend to start all required backend services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 Starting Universal AI Tools Backend Services..."
echo "📂 Project root: $PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID file to track services
PID_FILE="$PROJECT_ROOT/.backend-services.pid"

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1  # Port is in use
    else
        return 0  # Port is available
    fi
}

# Function to start a service
start_service() {
    local name=$1
    local dir=$2
    local command=$3
    local port=$4
    
    echo -e "${YELLOW}Starting $name on port $port...${NC}"
    
    # Check if port is already in use
    if ! check_port $port; then
        echo -e "${GREEN}✓ $name already running on port $port${NC}"
        return 0
    fi
    
    # Start the service
    cd "$dir"
    if [[ "$name" == "rust-ai-core" ]]; then
        # Rust AI Core needs special environment variable
        AI_CORE_PORT=$port RUST_LOG=info $command > "$PROJECT_ROOT/logs/$name.log" 2>&1 &
    elif [[ "$command" == "cargo"* ]]; then
        # Other Rust services
        RUST_LOG=info PORT=$port $command > "$PROJECT_ROOT/logs/$name.log" 2>&1 &
    elif [[ "$command" == "go"* ]]; then
        # Go service
        PORT=$port $command > "$PROJECT_ROOT/logs/$name.log" 2>&1 &
    else
        # Other service
        PORT=$port $command > "$PROJECT_ROOT/logs/$name.log" 2>&1 &
    fi
    
    local pid=$!
    echo "$name:$pid" >> "$PID_FILE"
    
    # Wait a moment for service to start
    sleep 2
    
    # Check if service started successfully
    if ! check_port $port; then
        echo -e "${GREEN}✓ $name started successfully (PID: $pid)${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to start $name${NC}"
        return 1
    fi
}

# Create logs directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/logs"

# Clear previous PID file
> "$PID_FILE"

# Start Go API Gateway (port 8082)
if check_port 8082; then
    start_service "go-api-gateway" \
        "$PROJECT_ROOT/go-api-gateway" \
        "go run cmd/main.go" \
        8082
else
    echo -e "${GREEN}✓ Go API Gateway already running on port 8082${NC}"
fi

# Start Rust AI Core (port 8083)
if check_port 8083; then
    start_service "rust-ai-core" \
        "$PROJECT_ROOT/rust-services/ai-core" \
        "cargo run --release" \
        8083
else
    echo -e "${GREEN}✓ Rust AI Core already running on port 8083${NC}"
fi

# Start Rust LLM Router (port 8003)
if check_port 8003; then
    start_service "rust-llm-router" \
        "$PROJECT_ROOT/rust-services/llm-router" \
        "cargo run --release" \
        8003
else
    echo -e "${GREEN}✓ Rust LLM Router already running on port 8003${NC}"
fi

# Start Go WebSocket Service (port 8080)
if check_port 8080; then
    start_service "go-websocket" \
        "$PROJECT_ROOT/rust-services/go-websocket" \
        "go run ." \
        8080
else
    echo -e "${GREEN}✓ Go WebSocket Service already running on port 8080${NC}"
fi

# Optional: Start Supabase if not running
if check_port 54321; then
    echo -e "${YELLOW}Starting Supabase (optional)...${NC}"
    cd "$PROJECT_ROOT"
    supabase start > "$PROJECT_ROOT/logs/supabase.log" 2>&1 &
    echo -e "${GREEN}✓ Supabase starting...${NC}"
else
    echo -e "${GREEN}✓ Supabase already running on port 54321${NC}"
fi

echo ""
echo -e "${GREEN}✅ All backend services started successfully!${NC}"
echo ""
echo "Service Status:"
echo "  • Go API Gateway:     http://localhost:8082/api/v1/health"
echo "  • Rust AI Core:       http://localhost:8083/health"
echo "  • Rust LLM Router:    http://localhost:8003/health"
echo "  • Go WebSocket:       ws://localhost:8080/ws"
echo "  • Supabase:           http://localhost:54321"
echo ""
echo "Logs available in: $PROJECT_ROOT/logs/"
echo "PID tracking file: $PID_FILE"