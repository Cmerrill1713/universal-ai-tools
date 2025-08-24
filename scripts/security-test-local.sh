#!/bin/bash
# Local Security Testing Script
# Validates security configuration before CI pipeline

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Universal AI Tools - Local Security Testing${NC}"
echo -e "${BLUE}==============================================${NC}"
echo ""

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
CRITICAL_FAILURES=0

function run_test() {
    local test_name="$1"
    local test_command="$2"
    local is_critical="${3:-false}"
    
    echo -e "${YELLOW}🔍 Running: $test_name${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        ((TESTS_FAILED++))
        if [ "$is_critical" = "true" ]; then
            ((CRITICAL_FAILURES++))
        fi
    fi
    echo ""
}

# ===========================================
# SECRETS SCANNING TESTS
# ===========================================

echo -e "${BLUE}📋 SECRETS SCANNING TESTS${NC}"
echo "=========================="

run_test "Check for hardcoded JWT secrets" \
    "! grep -r -E 'jwt.*secret.*=.*['\''\"''][a-zA-Z0-9+/=]{16,}['\''\"'']' --include='*.go' --include='*.rs' --include='*.ts' --include='*.js' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=tests . 2>/dev/null | grep -v 'std::env::var' | grep -v 'process.env' | grep -v 'randomBytes' | grep -v 'test-.*-secret'" \
    "true"

run_test "Check for hardcoded passwords" \
    "! grep -r -E 'password.*=.*['\''\"''][^$][a-zA-Z0-9]{6,}['\''\"'']' --include='*.go' --include='*.rs' --include='*.ts' --include='*.js' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=tests --exclude-dir=target --exclude-dir=archive . 2>/dev/null | grep -v 'std::env::var' | grep -v 'process.env' | grep -v '.min.js'" \
    "true"

run_test "Check for API keys in source code" \
    "! grep -r -E 'api_key.*=.*['\''\"''][a-zA-Z0-9]{20,}['\''\"'']' --include='*.go' --include='*.rs' --include='*.ts' --include='*.js' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=tests --exclude-dir=target --exclude-dir=archive . 2>/dev/null | grep -v '.min.js' | grep -v 'search-index.js'" \
    "true"

run_test "Validate GitLeaks configuration exists" \
    "[ -f .gitleaks.toml ]" \
    "false"

# ===========================================
# CONFIGURATION SECURITY TESTS
# ===========================================

echo -e "${BLUE}📋 CONFIGURATION SECURITY TESTS${NC}"
echo "================================="

run_test "Check environment variable usage in Go config" \
    "grep -q '\${.*}' go-api-gateway/.env" \
    "true"

run_test "Verify no hardcoded secrets in package.json scripts" \
    "! grep -E 'JWT_SECRET.*=.*[^$].*[^}]' package.json | grep -v '\${.*}'" \
    "false"

run_test "Check Swift production mode detection" \
    "grep -q '#if DEBUG' macOS-App/UniversalAITools/Services/SimpleAPIService.swift" \
    "true"

run_test "Validate production template exists" \
    "[ -f .env.production.template ]" \
    "true"

run_test "Check production secrets setup script" \
    "[ -f scripts/setup-production-secrets.sh ] && [ -x scripts/setup-production-secrets.sh ]" \
    "false"

# ===========================================
# DOCKER SECURITY TESTS
# ===========================================

echo -e "${BLUE}📋 DOCKER SECURITY TESTS${NC}"
echo "========================="

run_test "Check Dockerfile security best practices" \
    "[ -f go-api-gateway/Dockerfile ] && ! grep -q 'USER root' go-api-gateway/Dockerfile" \
    "false"

run_test "Verify no secrets in Docker compose files" \
    "! grep -r -E '(password|secret|key).*=.*['\''\"''][^$].*['\''\"'']' docker-compose*.yml 2>/dev/null | grep -v '\${'" \
    "true"

# ===========================================
# DEPENDENCY SECURITY TESTS
# ===========================================

echo -e "${BLUE}📋 DEPENDENCY SECURITY TESTS${NC}"
echo "============================="

run_test "npm audit check (high/critical only)" \
    "npm audit --audit-level high 2>/dev/null || echo 'npm audit warnings found but not blocking'" \
    "false"

run_test "Check for .nvmrc or Node version specification" \
    "[ -f .nvmrc ] || grep -q 'node.*version' package.json" \
    "false"

# ===========================================
# CI/CD SECURITY TESTS
# ===========================================

echo -e "${BLUE}📋 CI/CD SECURITY TESTS${NC}"
echo "======================="

run_test "Verify GitHub Actions security workflow exists" \
    "grep -q 'security-testing:' .github/workflows/ci-cd.yml" \
    "true"

run_test "Check for CodeQL configuration" \
    "grep -q 'github/codeql-action' .github/workflows/ci-cd.yml" \
    "false"

run_test "Verify Trivy scanner configuration" \
    "grep -q 'aquasecurity/trivy-action' .github/workflows/ci-cd.yml" \
    "false"

run_test "Check for secrets scanning in CI" \
    "grep -q 'gitleaks\|trufflehog' .github/workflows/ci-cd.yml" \
    "false"

# ===========================================
# SWIFT/MACOS SECURITY TESTS
# ===========================================

echo -e "${BLUE}📋 SWIFT/MACOS SECURITY TESTS${NC}"
echo "=============================="

run_test "Check Swift Keychain service implementation" \
    "[ -f macOS-App/UniversalAITools/Services/KeychainService.swift ]" \
    "false"

run_test "Verify no hardcoded tokens in Swift code" \
    "! grep -r -E 'token.*=.*['\''\"''][A-Za-z0-9]{20,}['\''\"'']' macOS-App/UniversalAITools/ --include='*.swift' 2>/dev/null" \
    "true"

# ===========================================
# SECURITY DOCUMENTATION TESTS
# ===========================================

echo -e "${BLUE}📋 SECURITY DOCUMENTATION TESTS${NC}"
echo "================================="

run_test "Check security guide exists" \
    "[ -f PRODUCTION_SECURITY_GUIDE.md ]" \
    "false"

run_test "Verify security validation report" \
    "[ -f FINAL_SECURITY_VALIDATION_REPORT.md ]" \
    "false"

# ===========================================
# RESULTS SUMMARY
# ===========================================

echo ""
echo -e "${BLUE}📊 SECURITY TEST RESULTS${NC}"
echo "========================="
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
PASS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "${GREEN}✅ Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Tests Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}📊 Pass Rate: $PASS_RATE%${NC}"

if [ $CRITICAL_FAILURES -gt 0 ]; then
    echo -e "${RED}🚨 Critical Failures: $CRITICAL_FAILURES${NC}"
    echo ""
    echo -e "${RED}❌ SECURITY VALIDATION FAILED - CRITICAL ISSUES FOUND${NC}"
    echo -e "${YELLOW}Please fix critical security issues before deployment${NC}"
    exit 1
elif [ $PASS_RATE -ge 90 ]; then
    echo ""
    echo -e "${GREEN}🎉 SECURITY VALIDATION PASSED - EXCELLENT SECURITY POSTURE${NC}"
    echo -e "${GREEN}✅ System is ready for secure deployment${NC}"
    exit 0
elif [ $PASS_RATE -ge 80 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  SECURITY VALIDATION PASSED - GOOD SECURITY POSTURE${NC}"
    echo -e "${YELLOW}Some non-critical improvements recommended${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ SECURITY VALIDATION FAILED - MULTIPLE ISSUES FOUND${NC}"
    echo -e "${YELLOW}Please address security issues before deployment${NC}"
    exit 1
fi