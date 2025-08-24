#!/bin/bash

# Configure Universal AI Tools Backend for Network Access
# Enables iPhone companion app to connect via cellular/WiFi

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m' 
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🌐 Configuring Universal AI Tools for Network Access${NC}"
echo -e "${BLUE}====================================================${NC}"

# Get network information
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || echo "Unable to detect")

echo -e "\n${YELLOW}📊 Network Information:${NC}"
echo "Local IP Address: $LOCAL_IP"
echo "External IP Address: $EXTERNAL_IP"

# Create network configuration
echo -e "\n${YELLOW}🔧 Creating Network Configuration...${NC}"

cat > /Users/christianmerrill/Desktop/universal-ai-tools/config.network.yaml << EOF
# Network Access Configuration for Universal AI Tools
# Enables remote iPhone companion app connectivity

# Server Configuration
server:
  port: 8082
  host: "0.0.0.0"  # Listen on all network interfaces
  read_timeout: 30
  write_timeout: 30
  idle_timeout: 120
  max_connections: 2000

# Security Configuration for Network Access
security:
  cors_allowed_origins:
    - "http://localhost:3000"
    - "http://${LOCAL_IP}:3000"
    - "capacitor://localhost"
    - "ionic://localhost"
    - "http://localhost"
    - "http://${LOCAL_IP}"
    - "*"  # Allow all origins for development
  trusted_proxies:
    - "127.0.0.1"
    - "${LOCAL_IP}"
    - "192.168.0.0/16"
    - "10.0.0.0/8"
    - "172.16.0.0/12"
  require_auth: false  # Disable auth for initial setup
  rate_limit_per_minute: 200  # Higher limit for mobile usage

# Database Configuration (local)
database:
  postgresql:
    host: "localhost"
    port: 54322  # Supabase local port
    database: "postgres"
    username: "postgres" 
    password: "postgres"
  redis:
    host: "localhost"
    port: 6379
  neo4j:
    uri: "bolt://localhost:7687"
    username: "neo4j"

# Mobile-Optimized Settings
migration:
  enable_compatibility_mode: true
  enable_testing: true

# Logging
logging:
  level: "info"
  format: "json"
  enable_caller: true

# Environment
environment: "development"
version: "1.0.0"
EOF

echo -e "${GREEN}✅ Network configuration created${NC}"

# Create startup script for network mode
echo -e "\n${YELLOW}📱 Creating Network Startup Script...${NC}"

cat > /Users/christianmerrill/Desktop/universal-ai-tools/start-network-mode.sh << 'EOF'
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
EOF

chmod +x /Users/christianmerrill/Desktop/universal-ai-tools/start-network-mode.sh

# Create iPhone connection test script
echo -e "\n${YELLOW}📲 Creating iPhone Connection Test...${NC}"

cat > /Users/christianmerrill/Desktop/universal-ai-tools/test-iphone-connection.sh << 'EOF'
#!/bin/bash

# Test iPhone Connection to Backend
# Run this to verify network connectivity

LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
BASE_URL="http://${LOCAL_IP}:8082"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📱 Testing iPhone Connection to Backend${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "Testing connection to: $BASE_URL"
echo ""

test_endpoint() {
    local endpoint="$1"
    local description="$2"
    
    printf "%-40s" "Testing $description..."
    
    if curl -s -f "$BASE_URL$endpoint" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Test core endpoints
test_endpoint "/api/health" "Health Check"
test_endpoint "/api/v1/health/ready" "Readiness Check"
test_endpoint "/api/v1/agents/" "Agents API"
test_endpoint "/api/v1/chat/" "Chat API"

echo ""
echo -e "${YELLOW}📱 iPhone Setup Instructions:${NC}"
echo "1. In iOS app ServiceSettings, set:"
echo "   goAPIGatewayURL = \"$BASE_URL\""
echo ""
echo "2. Test connection from iPhone by opening:"
echo "   Safari: $BASE_URL/api/health"
echo ""
echo -e "${YELLOW}🔗 Connection URLs for iPhone:${NC}"
echo "Health: $BASE_URL/api/health"
echo "Chat: $BASE_URL/api/v1/chat/"
echo "Agents: $BASE_URL/api/v1/agents/"
EOF

chmod +x /Users/christianmerrill/Desktop/universal-ai-tools/test-iphone-connection.sh

# Create cellular access guide
echo -e "\n${YELLOW}📡 Creating Cellular Access Guide...${NC}"

cat > /Users/christianmerrill/Desktop/universal-ai-tools/CELLULAR_ACCESS_SETUP.md << EOF
# Cellular Access Setup Guide
## Universal AI Tools iPhone Companion

### 🏠 Home Network Setup (Completed ✅)
- Backend configured to accept network connections
- CORS enabled for mobile access  
- Rate limiting optimized for cellular usage

### 📱 iPhone App Connection
Your iPhone app should connect to:
\`\`\`
Local WiFi: http://${LOCAL_IP}:8082
\`\`\`

### 🌐 Cellular Access Options

#### Option 1: Tailscale (Recommended - Easiest)
1. **Install Tailscale on home computer:**
   \`\`\`bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   \`\`\`

2. **Install Tailscale app on iPhone from App Store**

3. **Connect both devices to same Tailscale network**

4. **iPhone connects to Tailscale IP:**
   \`\`\`
   goAPIGatewayURL = "http://100.x.x.x:8082"  // Tailscale IP
   \`\`\`

#### Option 2: Dynamic DNS + Port Forwarding
1. **Router Configuration:**
   - Forward external port 8082 → ${LOCAL_IP}:8082
   - Enable UPnP if available

2. **Dynamic DNS Service (choose one):**
   - Duck DNS (free): https://www.duckdns.org
   - No-IP (free): https://www.noip.com
   - DynDNS (paid): https://dyn.com

3. **iPhone connects to:**
   \`\`\`
   goAPIGatewayURL = "http://yourname.duckdns.org:8082"
   \`\`\`

#### Option 3: VPN Server (Most Secure)
1. **Install WireGuard on home computer:**
   \`\`\`bash
   sudo apt install wireguard
   # Configure WireGuard server
   \`\`\`

2. **iPhone connects via WireGuard VPN**

3. **Uses local IP through VPN tunnel:**
   \`\`\`
   goAPIGatewayURL = "http://${LOCAL_IP}:8082"  // Same as home WiFi!
   \`\`\`

### 🧪 Testing Cellular Connection
1. **Turn off iPhone WiFi**
2. **Open Safari and visit: http://your-setup:8082/api/health**
3. **Should see: {"status":"healthy"}**

### 🚀 Remote App Building
Once cellular access is working, you can:
- Ask iPhone to start building apps while you're out
- Monitor progress via push notifications  
- Review completed code when you get home

### 🔒 Security Notes
- Development mode has auth disabled for setup
- Enable authentication for production use
- Consider API key authentication for cellular access
- Use HTTPS in production (Let's Encrypt + reverse proxy)

### 📊 Performance Expectations
- **Home WiFi**: 20-50ms response time
- **Cellular + Tailscale**: 100-300ms response time  
- **Cellular + Port Forward**: 50-150ms response time
- **Cellular + VPN**: 100-400ms response time

All options provide excellent experience for remote app development!
EOF

echo -e "${GREEN}✅ Cellular access guide created${NC}"

echo -e "\n${BLUE}🎉 Network Access Configuration Complete!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo -e "${YELLOW}📋 Next Steps:${NC}"
echo "1. Test local network access:"
echo "   ./start-network-mode.sh"
echo ""
echo "2. Verify iPhone connectivity:"
echo "   ./test-iphone-connection.sh"  
echo ""
echo "3. Set up cellular access:"
echo "   Read: CELLULAR_ACCESS_SETUP.md"
echo ""
echo -e "${YELLOW}📱 Your iPhone should connect to:${NC}"
echo "   http://${LOCAL_IP}:8082"
echo ""
echo -e "${GREEN}🚀 Ready to create iOS companion app!${NC}"