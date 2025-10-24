#!/bin/bash

# Universal AI Tools - Production Readiness Validation
# Comprehensive check of all systems before production deployment

echo "🏥 Universal AI Tools - Production Readiness Validation"
echo "====================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

print_status() {
  echo -e "${GREEN}✅ PASS${NC} $1"
  ((PASSED++))
}

print_warning() {
  echo -e "${YELLOW}⚠️  WARN${NC} $1"
  ((WARNINGS++))
}

print_error() {
  echo -e "${RED}❌ FAIL${NC} $1" 
  ((FAILED++))
}

print_info() {
  echo -e "${BLUE}ℹ️  INFO${NC} $1"
}

print_section() {
  echo ""
  echo -e "${BLUE}📋 $1${NC}"
  echo "----------------------------------------"
}

# Configuration
BASE_URL=${BASE_URL:-"http://localhost:9999"}
API_KEY=${API_KEY:-"test-api-key"}

print_info "Testing against: $BASE_URL"
print_info "Using API key: ${API_KEY:0:10}..."

# Section 1: Environment & Configuration
print_section "Environment & Configuration"

# Check Node.js version
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  if [[ "$NODE_VERSION" =~ v1[4-9]|v2[0-9] ]]; then
    print_status "Node.js version: $NODE_VERSION"
  else
    print_error "Node.js version too old: $NODE_VERSION (requires v14+)"
  fi
else
  print_error "Node.js not found"
fi

# Check npm packages
if [[ -f package.json ]]; then
  if [[ -d node_modules ]]; then
    print_status "Dependencies installed"
  else
    print_error "Dependencies not installed (run npm install)"
  fi
else
  print_error "package.json not found"
fi

# Check TypeScript compilation
if [[ -d dist ]]; then
  print_status "TypeScript compiled (dist/ exists)"
else
  print_warning "TypeScript not compiled (run npm run build)"
fi

# Check environment files
if [[ -f .env ]]; then
  print_status ".env file exists"
  
  # Check critical environment variables
  source .env
  
  if [[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON_KEY" ]]; then
    print_status "Supabase configuration present"
  else
    print_error "Supabase configuration missing"
  fi
  
  if [[ -n "$JWT_SECRET" && ${#JWT_SECRET} -gt 32 ]]; then
    print_status "JWT secret configured (${#JWT_SECRET} chars)"
  else
    print_error "JWT secret missing or too short"
  fi
  
else
  print_error ".env file not found"
fi

# Section 2: Database Connectivity  
print_section "Database Connectivity"

# Test Supabase connection
SUPABASE_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY")
if [[ "$SUPABASE_TEST" == "200" ]]; then
  print_status "Supabase endpoint accessible"
else
  print_error "Supabase endpoint not accessible (HTTP $SUPABASE_TEST)"
fi

# Section 3: Core API Endpoints
print_section "Core API Endpoints"

# Test basic health endpoint
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [[ "$HEALTH_CODE" == "200" ]]; then
  print_status "Health endpoint accessible"
else
  print_error "Health endpoint failed (HTTP $HEALTH_CODE)"
fi

# Test detailed health endpoint
HEALTH_DETAILED=$(curl -s "$BASE_URL/health/detailed")
if echo "$HEALTH_DETAILED" | grep -q "services"; then
  print_status "Detailed health endpoint working"
  
  # Parse service status
  if echo "$HEALTH_DETAILED" | grep -q '"database.*up"'; then
    print_status "Database service healthy"
  else
    print_warning "Database service may be down"
  fi
  
  if echo "$HEALTH_DETAILED" | grep -q '"redis.*up"'; then
    print_status "Redis service healthy"  
  else
    print_warning "Redis service may be down"
  fi
  
else
  print_error "Detailed health endpoint not working"
fi

# Test system status endpoint
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/status")
if [[ "$STATUS_CODE" == "200" ]]; then
  print_status "System status endpoint accessible"
else
  print_error "System status endpoint failed (HTTP $STATUS_CODE)"
fi

# Test authenticated endpoints
AGENTS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/agents" -H "X-API-Key: $API_KEY")
if [[ "$AGENTS_CODE" == "200" ]]; then
  print_status "Authenticated API endpoints working"
else
  print_error "Authenticated API endpoints failed (HTTP $AGENTS_CODE)"
fi

# Section 4: Security Configuration
print_section "Security Configuration"

# Check SSL/HTTPS configuration
if curl -s -k "$BASE_URL" | grep -q "Universal AI Tools"; then
  print_status "Application responds to HTTP requests"
  
  # Check if HTTPS is also available
  HTTPS_URL=$(echo "$BASE_URL" | sed 's/http:/https:/')
  if curl -s -k "$HTTPS_URL/health" &> /dev/null; then
    print_status "HTTPS also available"
  else
    print_warning "HTTPS not available (development setup)"
  fi
else
  print_error "Application not responding to HTTP requests"
fi

# Check security headers
SECURITY_HEADERS=$(curl -s -I "$BASE_URL/health")
if echo "$SECURITY_HEADERS" | grep -qi "x-frame-options"; then
  print_status "Security headers present"
else
  print_warning "Security headers missing"
fi

# Check rate limiting
RATE_LIMIT_TEST=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/agents" -H "X-API-Key: invalid-key")
if [[ "$RATE_LIMIT_TEST" == "401" || "$RATE_LIMIT_TEST" == "403" ]]; then
  print_status "API authentication working"
else
  print_warning "API authentication may be bypassed"
fi

# Section 5: Performance & Monitoring
print_section "Performance & Monitoring"

# Check response times
RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "$BASE_URL/health")
if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
  print_status "Health endpoint response time: ${RESPONSE_TIME}s"
else
  print_warning "Health endpoint slow response time: ${RESPONSE_TIME}s"
fi

# Check memory usage (if server is accessible)
if command -v ps &> /dev/null; then
  NODE_MEMORY=$(ps aux | grep 'node.*server' | grep -v grep | awk '{sum+=$6} END {print sum/1024}')
  if [[ -n "$NODE_MEMORY" && $(echo "$NODE_MEMORY > 0" | bc -l) ]]; then
    if (( $(echo "$NODE_MEMORY < 1000" | bc -l) )); then
      print_status "Memory usage reasonable: ${NODE_MEMORY}MB"
    else
      print_warning "High memory usage: ${NODE_MEMORY}MB"
    fi
  else
    print_warning "Could not determine memory usage"
  fi
fi

# Section 6: External Service Dependencies
print_section "External Service Dependencies"

# Test Ollama connection
if curl -s "http://localhost:11434/api/tags" &> /dev/null; then
  print_status "Ollama service accessible"
else
  print_warning "Ollama service not accessible"
fi

# Test LM Studio connection  
if curl -s "http://localhost:1234/v1/models" &> /dev/null; then
  print_status "LM Studio service accessible"
else
  print_warning "LM Studio service not accessible"
fi

# Test Redis connection
if command -v redis-cli &> /dev/null && redis-cli ping &> /dev/null; then
  print_status "Redis service accessible"
else
  print_warning "Redis service not accessible"
fi

# Section 7: File System & Permissions
print_section "File System & Permissions"

# Check log directory
if [[ -d logs ]]; then
  if [[ -w logs ]]; then
    print_status "Logs directory writable"
  else
    print_error "Logs directory not writable"
  fi
else
  print_warning "Logs directory missing (will be created automatically)"
fi

# Check uploads directory
if [[ -d uploads ]]; then
  if [[ -w uploads ]]; then
    print_status "Uploads directory writable"
  else
    print_error "Uploads directory not writable"
  fi
else
  print_warning "Uploads directory missing (will be created automatically)"
fi

# Check SSL certificates (if HTTPS enabled)
if [[ -f ssl/certificate.crt && -f ssl/private.key ]]; then
  print_status "SSL certificates present"
  
  # Check certificate expiration
  CERT_EXPIRY=$(openssl x509 -in ssl/certificate.crt -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -n "$CERT_EXPIRY" ]]; then
    print_status "SSL certificate expires: $CERT_EXPIRY"
  fi
else
  print_warning "SSL certificates not found (HTTP only)"
fi

# Section 8: Advanced Features
print_section "Advanced Features"

# Test vision endpoints
VISION_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/vision/health")
if [[ "$VISION_CODE" == "200" ]]; then
  print_status "Vision API accessible"
else
  print_warning "Vision API not accessible (HTTP $VISION_CODE)"
fi

# Test MLX endpoints (Apple Silicon)
if [[ "$(uname -m)" == "arm64" && "$(uname)" == "Darwin" ]]; then
  MLX_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/mlx/health")
  if [[ "$MLX_CODE" == "200" ]]; then
    print_status "MLX API accessible (Apple Silicon optimized)"
  else
    print_warning "MLX API not accessible (HTTP $MLX_CODE)"
  fi
else
  print_info "MLX API (Apple Silicon only) - skipping on this platform"
fi

# Test WebSocket endpoints
if command -v wscat &> /dev/null; then
  WS_URL=$(echo "$BASE_URL" | sed 's/http/ws/')/ws/test
  if timeout 5 wscat -c "$WS_URL" -x &> /dev/null; then
    print_status "WebSocket endpoints accessible"
  else
    print_warning "WebSocket endpoints not accessible"
  fi
else
  print_warning "wscat not available for WebSocket testing"
fi

# Section 9: Production Configuration
print_section "Production Configuration"

if [[ -f .env.production ]]; then
  print_status "Production environment file exists"
else
  print_warning "Production environment file missing"
fi

# Check for development-specific configurations
if grep -q "NODE_ENV=development" .env 2>/dev/null; then
  print_warning "Still in development mode (set NODE_ENV=production)"
else
  print_status "Production mode configured"
fi

# Check for placeholder API keys
if grep -q "your-.*-key" .env* 2>/dev/null; then
  print_error "Placeholder API keys detected - update with real keys"
else
  print_status "No placeholder API keys detected"
fi

# Summary
print_section "Validation Summary"

TOTAL=$((PASSED + FAILED + WARNINGS))
PASS_RATE=$((PASSED * 100 / TOTAL))

echo "📊 Results:"
echo "   ✅ Passed: $PASSED"
echo "   ❌ Failed: $FAILED"
echo "   ⚠️  Warnings: $WARNINGS"
echo "   📈 Pass Rate: $PASS_RATE%"
echo ""

if [[ $FAILED -eq 0 && $WARNINGS -le 5 ]]; then
  echo -e "${GREEN}🎉 PRODUCTION READY${NC}"
  echo "Your application is ready for production deployment!"
  echo ""
  echo "Next steps:"
  echo "  1. Run production setup: sudo ./scripts/production-setup.sh"
  echo "  2. Configure production API keys in Supabase Vault"
  echo "  3. Set up monitoring and alerting"
  echo "  4. Configure automated backups"
  
  exit 0
elif [[ $FAILED -eq 0 ]]; then
  echo -e "${YELLOW}⚠️ READY WITH WARNINGS${NC}"
  echo "Your application can be deployed but has some warnings."
  echo "Consider addressing the warnings above before production."
  
  exit 1
else
  echo -e "${RED}❌ NOT READY${NC}"
  echo "Your application has critical issues that must be resolved."
  echo "Please fix the failed checks above before deploying."
  
  exit 2
fi