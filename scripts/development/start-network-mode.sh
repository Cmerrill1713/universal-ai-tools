#!/bin/bash

# Start Universal AI Tools in Network Access Mode
# Allows iPhone companion app connectivity

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Universal AI Tools - Network Mode${NC}"

# Get local IP for reference
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo -e "\n${YELLOW}📱 iPhone Connection Info:${NC}"
echo "Connect your iPhone app to: http://${LOCAL_IP}:8082"
echo ""
echo -e "${YELLOW}🔧 Testing URLs:${NC}"
echo "Health Check: http://${LOCAL_IP}:8082/api/health"
echo "Chat API: http://${LOCAL_IP}:8082/api/v1/chat/"
echo "Agents API: http://${LOCAL_IP}:8082/api/v1/agents/"
echo ""

# Set environment variables for network access
export UAT_SERVER_PORT=8082
export UAT_SERVER_HOST="0.0.0.0"
export UAT_ENVIRONMENT="development"
export UAT_SECURITY_REQUIRE_AUTH=false
export UAT_SECURITY_JWT_SECRET="network-dev-secret-key"
export UAT_CONFIG_FILE="config.network.yaml"

# Start the Go API Gateway
cd go-api-gateway

echo -e "${GREEN}🌐 Backend starting on all network interfaces...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""

./main
