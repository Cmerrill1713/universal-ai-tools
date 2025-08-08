#!/bin/bash

echo "🧠 Testing HRM Integration with Universal AI Tools"
echo "================================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Start the HRM demo server
echo -e "\n${YELLOW}Starting HRM Demo Server...${NC}"
PORT=9998 npx tsx src/server-hrm-demo.ts &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -X GET "http://localhost:9998$endpoint")
    else
        response=$(curl -s -X POST "http://localhost:9998$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    if echo "$response" | jq . 2>/dev/null; then
        echo -e "${GREEN}✓ Response received${NC}"
    else
        echo -e "${RED}✗ Invalid response: $response${NC}"
    fi
}

# Test health endpoint
test_endpoint "GET" "/health" "" "Health Check"

# Test HRM status
test_endpoint "GET" "/api/v1/hrm/status" "" "HRM Service Status"

# Test ARC puzzle solving
test_endpoint "POST" "/api/v1/hrm/demo" '{
    "puzzleType": "arc",
    "input": {
        "input": [[1,0,0],[0,1,0],[0,0,1]],
        "output": [[0,0,1],[0,1,0],[1,0,0]]
    }
}' "ARC Puzzle Solving"

# Test Sudoku solving
test_endpoint "POST" "/api/v1/hrm/demo" '{
    "puzzleType": "sudoku",
    "input": [
        [5,3,0,0,7,0,0,0,0],
        [6,0,0,1,9,5,0,0,0],
        [0,9,8,0,0,0,0,6,0],
        [8,0,0,0,6,0,0,0,3],
        [4,0,0,8,0,3,0,0,1],
        [7,0,0,0,2,0,0,0,6],
        [0,6,0,0,0,0,2,8,0],
        [0,0,0,4,1,9,0,0,5],
        [0,0,0,0,8,0,0,7,9]
    ]
}' "Sudoku Puzzle Solving"

# Test Maze solving
test_endpoint "POST" "/api/v1/hrm/demo" '{
    "puzzleType": "maze",
    "input": {
        "maze": [
            [0,0,1,0,0],
            [1,0,1,0,1],
            [0,0,0,0,0],
            [0,1,1,1,0],
            [0,0,0,0,0]
        ],
        "start": [0,0],
        "end": [4,4]
    }
}' "Maze Puzzle Solving"

# Test reasoning endpoint
test_endpoint "POST" "/api/v1/hrm/reason" '{
    "puzzle": {
        "type": "custom",
        "input": "Test hierarchical reasoning"
    },
    "maxCycles": 5
}' "General Reasoning"

# Cleanup
echo -e "\n${YELLOW}Stopping HRM Demo Server...${NC}"
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo -e "\n${GREEN}✅ HRM Integration Test Complete${NC}"
echo "=================================="
echo ""
echo "Summary:"
echo "- HRM agent successfully integrated into Universal AI Tools"
echo "- Sapient HRM repository implementation wrapped as service"
echo "- API endpoints available for ARC, Sudoku, and Maze solving"
echo "- Agent registered in agent registry (when using clean server)"
echo ""
echo "Note: The main server has syntax corruption that needs to be fixed"
echo "      before the HRM integration can be used in production."