#!/bin/bash

echo "🔍 Sweet Athena Diagnostic Report"
echo "================================="
echo "Time: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
ISSUES=()

echo "1. Process Status"
echo "-----------------"
# Check UE5
if pgrep -f "UnrealEditor" > /dev/null; then
    echo -e "${GREEN}✓ Unreal Engine is running${NC}"
else
    echo -e "${RED}✗ Unreal Engine is NOT running${NC}"
    ISSUES+=("UE5 not running")
fi

# Check backend
if pgrep -f "tsx.*server" > /dev/null; then
    echo -e "${GREEN}✓ Backend server is running${NC}"
else
    echo -e "${RED}✗ Backend server is NOT running${NC}"
    ISSUES+=("Backend not running")
fi

echo ""
echo "2. Port Status"
echo "--------------"
# Check ports
PORTS=(9999 8080 8081 8888 8765 8766)
for port in "${PORTS[@]}"; do
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Port $port is in use${NC}"
    else
        echo -e "${YELLOW}○ Port $port is free${NC}"
    fi
done

echo ""
echo "3. API Tests"
echo "------------"
# Test health endpoint
if curl -s http://localhost:9999/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health endpoint responding${NC}"
else
    echo -e "${RED}✗ Health endpoint not responding${NC}"
    ISSUES+=("API not responding")
fi

# Test Sweet Athena endpoint
if curl -s -H "x-api-key: universal-ai-tools-production-key-2025" http://localhost:9999/api/v1/sweet-athena/status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Sweet Athena API responding${NC}"
else
    echo -e "${YELLOW}○ Sweet Athena API not responding${NC}"
fi

echo ""
echo "4. File Checks"
echo "--------------"
# Check critical files
FILES=(
    "$HOME/UE5-SweetAthena/SweetAthenaUE5Project.uproject"
    "$HOME/UE5-SweetAthena/Scripts/StartPixelStreaming.sh"
    "$HOME/Desktop/sweet-athena-viewer.html"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $(basename $file) exists${NC}"
    else
        echo -e "${RED}✗ $(basename $file) missing${NC}"
        ISSUES+=("Missing file: $file")
    fi
done

echo ""
echo "5. Environment Check"
echo "-------------------"
# Check env vars
if grep -q "PIXEL_STREAMING_URL" .env; then
    echo -e "${GREEN}✓ Pixel Streaming configured in .env${NC}"
else
    echo -e "${RED}✗ Pixel Streaming not configured${NC}"
    ISSUES+=("Missing env config")
fi

echo ""
echo "6. Recent Errors"
echo "----------------"
# Check for recent errors
if [ -f /tmp/sweet-athena-backend.log ]; then
    ERROR_COUNT=$(tail -100 /tmp/sweet-athena-backend.log | grep -c "ERROR" || echo "0")
    echo "Found $ERROR_COUNT errors in last 100 log lines"
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "Last error:"
        tail -100 /tmp/sweet-athena-backend.log | grep "ERROR" | tail -1
    fi
fi

echo ""
echo "================================="
echo "Diagnosis Summary"
echo "================================="
if [ ${#ISSUES[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ No critical issues found${NC}"
else
    echo -e "${RED}❌ Found ${#ISSUES[@]} issue(s):${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "   - $issue"
    done
fi

echo ""
echo "📝 Recommendations:"
if [[ " ${ISSUES[@]} " =~ "Backend not running" ]]; then
    echo "1. Start backend: npm run dev"
fi
if [[ " ${ISSUES[@]} " =~ "UE5 not running" ]]; then
    echo "2. Launch UE5: ./launch-photorealistic-sweet-athena.sh"
fi
if [[ " ${ISSUES[@]} " =~ "API not responding" ]]; then
    echo "3. Check logs: tail -f /tmp/sweet-athena-backend.log"
fi

echo ""
echo "🔧 Quick Fix Command:"
echo "pkill -f 'node.*server' && pkill -f UnrealEditor && sleep 2 && ./launch-photorealistic-sweet-athena.sh"