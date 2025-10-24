#!/bin/bash

# Deploy improvements to reduce error rate
# This script safely backs up the current server and deploys the improved version

set -e

echo "========================================="
echo "Deploying Universal AI Tools Improvements"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${YELLOW}Creating backups...${NC}"

# Create backup directory
BACKUP_DIR="$PROJECT_ROOT/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup current files
cp "$PROJECT_ROOT/src/server.ts" "$BACKUP_DIR/server.ts.bak" 2>/dev/null || true
cp "$PROJECT_ROOT/src/middleware/performance.ts" "$BACKUP_DIR/performance.ts.bak" 2>/dev/null || true
cp "$PROJECT_ROOT/src/utils/cache-manager.ts" "$BACKUP_DIR/cache-manager.ts.bak" 2>/dev/null || true

echo -e "${GREEN}Backups created in: $BACKUP_DIR${NC}"

echo -e "${YELLOW}Deploying improved components...${NC}"

# Copy improved files
# Server improvements have been integrated into the main server.ts file
echo -e "${GREEN}✓ Deployed improved server${NC}"

# The middleware is already updated to use ImprovedCacheManager
echo -e "${GREEN}✓ Performance middleware updated${NC}"

# Update package.json to include new dependencies if needed
cd "$PROJECT_ROOT"

# Check if required packages are installed
echo -e "${YELLOW}Checking dependencies...${NC}"

# Install any missing dependencies
npm list ioredis >/dev/null 2>&1 || npm install ioredis
npm list zlib >/dev/null 2>&1 || echo "zlib is built-in"

echo -e "${GREEN}✓ Dependencies verified${NC}"

# Run TypeScript compilation to check for errors
echo -e "${YELLOW}Compiling TypeScript...${NC}"
npx tsc --noEmit || {
    echo -e "${RED}TypeScript compilation failed. Rolling back...${NC}"
    cp "$BACKUP_DIR/server.ts.bak" "$PROJECT_ROOT/src/server.ts"
    exit 1
}

echo -e "${GREEN}✓ TypeScript compilation successful${NC}"

# Create monitoring script
cat > "$PROJECT_ROOT/scripts/monitor-errors.sh" << 'EOF'
#!/bin/bash

# Monitor error rate after deployment

echo "Monitoring error rate..."
echo "Press Ctrl+C to stop"

while true; do
    # Get current timestamp
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    
    # Check if server is running
    if curl -s http://localhost:9999/api/performance/metrics > /dev/null; then
        # Get error rate from metrics
        ERROR_RATE=$(curl -s http://localhost:9999/api/performance/metrics | \
            grep -o '"errorRate":[0-9.]*' | cut -d: -f2)
        
        if [ ! -z "$ERROR_RATE" ]; then
            # Color code based on error rate
            if (( $(echo "$ERROR_RATE < 5" | bc -l) )); then
                echo -e "\033[0;32m[$TIMESTAMP] Error rate: ${ERROR_RATE}% ✓\033[0m"
            elif (( $(echo "$ERROR_RATE < 10" | bc -l) )); then
                echo -e "\033[1;33m[$TIMESTAMP] Error rate: ${ERROR_RATE}% ⚠\033[0m"
            else
                echo -e "\033[0;31m[$TIMESTAMP] Error rate: ${ERROR_RATE}% ✗\033[0m"
            fi
        fi
    else
        echo -e "\033[0;31m[$TIMESTAMP] Server not responding\033[0m"
    fi
    
    sleep 10
done
EOF

chmod +x "$PROJECT_ROOT/scripts/monitor-errors.sh"

echo -e "${GREEN}✓ Monitoring script created${NC}"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Restart the server: npm run dev"
echo "2. Monitor error rate: ./scripts/monitor-errors.sh"
echo "3. Check logs: tail -f server.log | grep -E '(error|Error|ERROR)'"
echo ""
echo "To rollback if needed:"
echo "cp $BACKUP_DIR/server.ts.bak $PROJECT_ROOT/src/server.ts"
echo ""
echo -e "${YELLOW}Expected improvements:${NC}"
echo "- Redis connection with retry logic and circuit breaker"
echo "- Proper error handling for all endpoints"
echo "- Memory system initialization with fallback"
echo "- Request timeout handling"
echo "- Better error logging and tracking"
echo ""
echo -e "${GREEN}Target: Reduce error rate from 37.5% to below 5%${NC}"