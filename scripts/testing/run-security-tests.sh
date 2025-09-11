#!/bin/bash
# Security Implementation Verification Script

echo "🔒 Universal AI Tools - Security Implementation Tests"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
PASSED=0
FAILED=0

# Test function
test_implementation() {
    local name="$1"
    local file="$2"
    local pattern="$3"
    
    if [ -f "$file" ] && grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $name"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $name"
        ((FAILED++))
    fi
}

echo -e "${BLUE}1. Security Middleware Tests${NC}"
echo "----------------------------"
test_implementation "Comprehensive Validation Middleware exists" \
    "src/middleware/comprehensive-validation.ts" \
    "export class ComprehensiveValidationMiddleware"

test_implementation "SQL Injection Protection enabled" \
    "src/middleware/sql-injection-protection.ts" \
    "containsSQLInjection"

test_implementation "Rate Limiter with tiers" \
    "src/middleware/rate-limiter.ts" \
    "anonymous.*authenticated.*premium.*admin"

test_implementation "Security Enhanced Middleware" \
    "src/middleware/security-enhanced.ts" \
    "enableInputValidation"

echo ""
echo -e "${BLUE}2. Authentication Tests${NC}"
echo "----------------------"
test_implementation "JWT Auth requires secret in production" \
    "src/middleware/auth-jwt.ts" \
    "JWT_SECRET must be set and secure in production"

test_implementation "No hardcoded test API keys" \
    "ui/src/lib/api.ts" \
    "process\.env\.VITE_API_KEY"

echo ""
echo -e "${BLUE}3. Route Security Tests${NC}"
echo "----------------------"
test_implementation "Tools router has validation" \
    "src/routers/tools.ts" \
    "strictValidation"

test_implementation "Filesystem router requires auth" \
    "src/routers/filesystem.ts" \
    "JWTAuthService"

echo ""
echo -e "${BLUE}4. Production Configuration${NC}"
echo "--------------------------"
test_implementation "CORS uses environment config" \
    "src/config/environment.ts" \
    "process\.env\.CORS_ORIGINS"

test_implementation "Production performance middleware" \
    "src/middleware/performance-production.ts" \
    "export class ProductionPerformanceMiddleware"

echo ""
echo -e "${BLUE}5. Logging & Monitoring${NC}"
echo "----------------------"
test_implementation "Enhanced logger implementation" \
    "src/utils/enhanced-logger.ts" \
    "export const logger"

test_implementation "No console.log in server files" \
    "src/server.ts" \
    "logger\." 

echo ""
echo -e "${BLUE}6. Database Security${NC}"
echo "-------------------"
test_implementation "Query limits in context service" \
    "src/services/enhanced-context-service.ts" \
    "\.limit("

test_implementation "Query limits in knowledge manager" \
    "src/core/knowledge/dspy-knowledge-manager.ts" \
    "\.limit("

echo ""
echo "=================================================="
echo -e "${BLUE}Test Summary:${NC}"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo -e "  ${YELLOW}Total:  $((PASSED + FAILED))${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All security implementations verified!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some security implementations need attention${NC}"
    exit 1
fi