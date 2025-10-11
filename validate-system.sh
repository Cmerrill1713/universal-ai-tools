#!/bin/bash

# System Validation Script
# Runs comprehensive tests to ensure chat and agent systems are working

set -e

echo "🔧 Universal AI Tools - System Validation"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
WARNINGS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -n "Testing $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

# Function to check if a service is running
check_service() {
    local service_name=$1
    local port=$2
    
    echo -n "Checking $service_name (port $port)... "
    
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓ Running${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ Not running${NC}"
        ((FAILED++))
        return 1
    fi
}

# Function to check environment
check_env() {
    local var_name=$1
    local var_value=${!var_name}
    
    echo -n "Checking $var_name... "
    
    if [ -n "$var_value" ]; then
        echo -e "${GREEN}✓ Set${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ Not set (using defaults)${NC}"
        ((WARNINGS++))
    fi
}

echo "1️⃣  Checking Environment Variables"
echo "-----------------------------------"
check_env "NODE_ENV"
check_env "PORT"
check_env "DATABASE_URL"
check_env "SUPABASE_URL"
check_env "SUPABASE_ANON_KEY"
check_env "OPENAI_API_KEY"
check_env "JWT_SECRET"
echo ""

echo "2️⃣  Checking Services"
echo "--------------------"
check_service "Backend API" 9999
check_service "Supabase" 54321
check_service "PostgreSQL" 5432
check_service "Frontend" 5173
echo ""

echo "3️⃣  Checking Backend Health"
echo "---------------------------"
run_test "API Health" "curl -s http://localhost:9999/api/health | grep -q healthy"
run_test "Database Connection" "curl -s http://localhost:9999/api/health | grep -q database"
echo ""

echo "4️⃣  Checking Authentication"
echo "---------------------------"
# Test API key authentication
run_test "API Key Auth" "curl -s -H 'X-API-Key: test-key' -H 'X-AI-Service: test' http://localhost:9999/api/agents"

# Test missing auth
if curl -s http://localhost:9999/api/agents 2>/dev/null | grep -q "error"; then
    echo -e "Auth Rejection... ${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "Auth Rejection... ${RED}✗ FAILED${NC}"
    ((FAILED++))
fi
echo ""

echo "5️⃣  Checking Database Tables"
echo "----------------------------"
# Check if required tables exist
TABLES=("users" "agents" "memories" "ai_service_keys" "ai_services")
for table in "${TABLES[@]}"; do
    if psql -h localhost -p 5432 -U postgres -d postgres -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
        echo -e "Table '$table'... ${GREEN}✓ Exists${NC}"
        ((PASSED++))
    else
        echo -e "Table '$table'... ${RED}✗ Missing${NC}"
        ((FAILED++))
    fi
done
echo ""

echo "6️⃣  Running Quick API Tests"
echo "---------------------------"
# Test Sweet Athena
if [ -n "$API_KEY" ]; then
    run_test "Sweet Athena Status" "curl -s -H 'X-API-Key: $API_KEY' -H 'X-AI-Service: test' http://localhost:9999/api/sweet-athena/status | grep -q success"
    run_test "Agent List" "curl -s -H 'X-API-Key: $API_KEY' -H 'X-AI-Service: test' http://localhost:9999/api/agents | grep -q agents"
else
    echo -e "${YELLOW}⚠ Skipping API tests (API_KEY not set)${NC}"
    ((WARNINGS++))
fi
echo ""

echo "7️⃣  Checking Frontend Build"
echo "---------------------------"
if [ -d "ui/dist" ]; then
    echo -e "Frontend Build... ${GREEN}✓ Found${NC}"
    ((PASSED++))
else
    echo -e "Frontend Build... ${YELLOW}⚠ Not built${NC}"
    ((WARNINGS++))
fi

if [ -f "ui/node_modules/.bin/vite" ]; then
    echo -e "Frontend Dependencies... ${GREEN}✓ Installed${NC}"
    ((PASSED++))
else
    echo -e "Frontend Dependencies... ${RED}✗ Not installed${NC}"
    ((FAILED++))
fi
echo ""

echo "8️⃣  Checking Critical Files"
echo "---------------------------"
FILES=(
    "src/server.ts"
    "ui/src/lib/api.ts"
    "ui/src/pages/Agents.tsx"
    "ui/src/components/SweetAthena/Chat/SimpleChatComponent.tsx"
    ".env.example"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "File $file... ${GREEN}✓ Exists${NC}"
        ((PASSED++))
    else
        echo -e "File $file... ${RED}✗ Missing${NC}"
        ((FAILED++))
    fi
done
echo ""

echo "9️⃣  Running TypeScript Checks"
echo "-----------------------------"
run_test "Backend TypeScript" "npx tsc --noEmit"
run_test "Frontend TypeScript" "cd ui && npx tsc --noEmit"
echo ""

echo "🔟 Running Unit Tests"
echo "--------------------"
if [ -f "jest.config.js" ]; then
    echo "Running backend tests..."
    if npm test -- --passWithNoTests > /dev/null 2>&1; then
        echo -e "Backend Tests... ${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "Backend Tests... ${RED}✗ FAILED${NC}"
        ((FAILED++))
    fi
else
    echo -e "${YELLOW}⚠ Jest not configured${NC}"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "========================================"
echo "📊 Validation Summary"
echo "========================================"
echo -e "✅ Passed:   ${GREEN}$PASSED${NC}"
echo -e "❌ Failed:   ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 System validation PASSED!${NC}"
    echo "The chat and agent systems appear to be properly configured."
    echo ""
    echo "Next steps:"
    echo "1. Start the backend: npm run dev"
    echo "2. Start the frontend: cd ui && npm run dev"
    echo "3. Access the application at http://localhost:5173"
    exit 0
else
    echo -e "${RED}❌ System validation FAILED!${NC}"
    echo ""
    echo "Please fix the above issues before starting the system."
    echo "Common fixes:"
    echo "1. Install dependencies: npm install && cd ui && npm install"
    echo "2. Set up environment: cp .env.example .env"
    echo "3. Run migrations: npm run db:migrate"
    echo "4. Start required services: docker-compose up -d"
    exit 1
fi