#!/bin/bash

# Universal AI Tools - Production Configuration Validator
# This script validates all production configuration requirements

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "Universal AI Tools - Production Configuration Validator"
echo "=================================================="
echo ""

# Track validation status
VALIDATION_PASSED=true
WARNINGS=0
ERRORS=0

# Function to check environment variable
check_env_var() {
    local var_name=$1
    local min_length=${2:-0}
    local is_required=${3:-true}
    
    if [ -z "${!var_name}" ]; then
        if [ "$is_required" = true ]; then
            echo -e "${RED}❌ Missing required variable: $var_name${NC}"
            ((ERRORS++))
            VALIDATION_PASSED=false
        else
            echo -e "${YELLOW}⚠️  Optional variable not set: $var_name${NC}"
            ((WARNINGS++))
        fi
    else
        if [ $min_length -gt 0 ] && [ ${#!var_name} -lt $min_length ]; then
            echo -e "${RED}❌ $var_name is too short (minimum $min_length characters)${NC}"
            ((ERRORS++))
            VALIDATION_PASSED=false
        else
            # Check for default/example values
            if [[ "${!var_name}" == *"your-"* ]] || [[ "${!var_name}" == *"example"* ]] || [[ "${!var_name}" == *"change-me"* ]]; then
                echo -e "${RED}❌ $var_name contains default/example value${NC}"
                ((ERRORS++))
                VALIDATION_PASSED=false
            else
                echo -e "${GREEN}✅ $var_name is properly configured${NC}"
            fi
        fi
    fi
}

# Function to check URL format
check_url() {
    local var_name=$1
    local url="${!var_name}"
    
    if [ -n "$url" ]; then
        if [[ ! "$url" =~ ^https?:// ]]; then
            echo -e "${RED}❌ $var_name is not a valid URL: $url${NC}"
            ((ERRORS++))
            VALIDATION_PASSED=false
        else
            echo -e "${GREEN}✅ $var_name URL format is valid${NC}"
        fi
    fi
}

# Function to test connectivity
test_connection() {
    local service_name=$1
    local test_command=$2
    
    echo -n "Testing $service_name connection... "
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${RED}❌ Connection failed${NC}"
        ((ERRORS++))
        VALIDATION_PASSED=false
    fi
}

echo "1. Checking Required Environment Variables"
echo "=========================================="

# Core configuration
check_env_var "NODE_ENV" 0 true
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}⚠️  NODE_ENV is not set to 'production' (current: $NODE_ENV)${NC}"
    ((WARNINGS++))
fi

check_env_var "PORT" 0 true
check_env_var "HOST" 0 false

# Database configuration
check_env_var "SUPABASE_URL" 0 true
check_url "SUPABASE_URL"
check_env_var "SUPABASE_SERVICE_KEY" 40 true
check_env_var "SUPABASE_ANON_KEY" 40 false

# Security configuration
check_env_var "JWT_SECRET" 32 true
check_env_var "ENCRYPTION_KEY" 32 true

# Redis configuration
check_env_var "REDIS_URL" 0 true
check_url "REDIS_URL"
check_env_var "REDIS_PASSWORD" 16 false

echo ""
echo "2. Checking Optional Environment Variables"
echo "=========================================="

# AI Service API Keys
check_env_var "OPENAI_API_KEY" 20 false
check_env_var "ANTHROPIC_API_KEY" 20 false
check_env_var "GOOGLE_AI_API_KEY" 20 false

# Local LLM
check_env_var "OLLAMA_URL" 0 false
check_url "OLLAMA_URL"

# Performance settings
check_env_var "MAX_CONCURRENT_REQUESTS" 0 false
check_env_var "REQUEST_TIMEOUT" 0 false
check_env_var "MEMORY_CACHE_SIZE" 0 false

# Backup configuration
check_env_var "BACKUP_ENCRYPTION_PASSWORD" 16 false
check_env_var "AWS_ACCESS_KEY_ID" 0 false
check_env_var "AWS_SECRET_ACCESS_KEY" 0 false
check_env_var "S3_BACKUP_BUCKET" 0 false

echo ""
echo "3. Testing Service Connectivity"
echo "================================"

# Test Supabase connection
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_KEY" ]; then
    test_connection "Supabase" "curl -s -o /dev/null -w '%{http_code}' -H 'apikey: $SUPABASE_SERVICE_KEY' '$SUPABASE_URL/rest/v1/' | grep -q '200'"
fi

# Test Redis connection
if [ -n "$REDIS_URL" ]; then
    # Extract host and port from Redis URL
    REDIS_HOST=$(echo $REDIS_URL | sed -E 's|redis://([^:]+):([^@]+)@([^:]+):([0-9]+).*|\3|' 2>/dev/null || echo "localhost")
    REDIS_PORT=$(echo $REDIS_URL | sed -E 's|redis://([^:]+):([^@]+)@([^:]+):([0-9]+).*|\4|' 2>/dev/null || echo "6379")
    test_connection "Redis" "nc -zv $REDIS_HOST $REDIS_PORT 2>&1"
fi

# Test Ollama connection
if [ -n "$OLLAMA_URL" ]; then
    test_connection "Ollama" "curl -s -o /dev/null -w '%{http_code}' '$OLLAMA_URL/api/tags' | grep -q '200'"
fi

echo ""
echo "4. Checking System Requirements"
echo "================================"

# Check available memory
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
if [ $TOTAL_MEM -lt 4096 ]; then
    echo -e "${YELLOW}⚠️  System has less than 4GB RAM (${TOTAL_MEM}MB). Recommended: 4GB+${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ Sufficient memory available (${TOTAL_MEM}MB)${NC}"
fi

# Check available disk space
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo -e "${YELLOW}⚠️  Disk usage is high (${DISK_USAGE}%). Consider freeing up space.${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ Disk usage is acceptable (${DISK_USAGE}%)${NC}"
fi

# Check Docker availability
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker is installed${NC}"
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose is available${NC}"
    else
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        ((ERRORS++))
        VALIDATION_PASSED=false
    fi
else
    echo -e "${RED}❌ Docker is not installed${NC}"
    ((ERRORS++))
    VALIDATION_PASSED=false
fi

echo ""
echo "5. Security Checks"
echo "=================="

# Check file permissions
if [ -f .env ]; then
    PERM=$(stat -c "%a" .env 2>/dev/null || stat -f "%p" .env | cut -c 4-6)
    if [ "$PERM" != "600" ] && [ "$PERM" != "640" ]; then
        echo -e "${YELLOW}⚠️  .env file has insecure permissions ($PERM). Run: chmod 600 .env${NC}"
        ((WARNINGS++))
    else
        echo -e "${GREEN}✅ .env file permissions are secure${NC}"
    fi
fi

# Check for SSL certificates
if [ -d "./nginx/ssl" ]; then
    if [ -f "./nginx/ssl/cert.pem" ] && [ -f "./nginx/ssl/key.pem" ]; then
        echo -e "${GREEN}✅ SSL certificates found${NC}"
    else
        echo -e "${RED}❌ SSL certificates missing in ./nginx/ssl/${NC}"
        ((ERRORS++))
        VALIDATION_PASSED=false
    fi
else
    echo -e "${YELLOW}⚠️  SSL directory not found. Ensure certificates are properly configured.${NC}"
    ((WARNINGS++))
fi

echo ""
echo "6. Configuration File Checks"
echo "============================"

# Check for required configuration files
REQUIRED_FILES=(
    "docker-compose.prod.yml"
    "Dockerfile.prod"
    "nginx/nginx.prod.conf"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ Found: $file${NC}"
    else
        echo -e "${RED}❌ Missing: $file${NC}"
        ((ERRORS++))
        VALIDATION_PASSED=false
    fi
done

echo ""
echo "7. AI Service Configuration"
echo "==========================="

# Check if at least one AI service is configured
AI_SERVICES=0
[ -n "$OPENAI_API_KEY" ] && ((AI_SERVICES++))
[ -n "$ANTHROPIC_API_KEY" ] && ((AI_SERVICES++))
[ -n "$GOOGLE_AI_API_KEY" ] && ((AI_SERVICES++))
[ -n "$GROQ_API_KEY" ] && ((AI_SERVICES++))
[ -n "$COHERE_API_KEY" ] && ((AI_SERVICES++))

if [ $AI_SERVICES -eq 0 ] && [ "$USE_LOCAL_MODELS" != "true" ]; then
    echo -e "${YELLOW}⚠️  No AI service API keys configured and local models not enabled${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✅ AI services configured: $AI_SERVICES remote + local models ${USE_LOCAL_MODELS:-false}${NC}"
fi

echo ""
echo "=================================================="
echo "Validation Summary"
echo "=================================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! System is ready for production deployment.${NC}"
    exit 0
else
    echo -e "Errors: ${RED}$ERRORS${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo ""
    
    if [ $ERRORS -gt 0 ]; then
        echo -e "${RED}❌ Production deployment blocked due to errors.${NC}"
        echo "Please fix the errors above before deploying to production."
        exit 1
    else
        echo -e "${YELLOW}⚠️  Production deployment possible but with warnings.${NC}"
        echo "Consider addressing the warnings for optimal production setup."
        exit 0
    fi
fi