#!/bin/bash

# Electron Frontend Regression Prevention Script
# Based on error patterns identified in January 2025
# Usage: ./scripts/regression-check.sh

echo "🔍 Electron Frontend Regression Check - Jan 2025"
echo "=================================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS_FOUND=0
WARNINGS_FOUND=0

# Check 1: Parameter naming inconsistencies
echo "1️⃣ Checking for parameter naming inconsistencies..."
PARAM_ERRORS=$(grep -r "_e =>" src/ | grep -v "_e\." | grep -v node_modules || true)
if [ -n "$PARAM_ERRORS" ]; then
    echo -e "${RED}❌ Parameter naming inconsistencies found:${NC}"
    echo "$PARAM_ERRORS"
    echo ""
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
    echo -e "${GREEN}✅ No parameter naming issues found${NC}"
fi
echo ""

# Check 2: Variable reference errors in catch blocks
echo "2️⃣ Checking for variable reference errors in catch blocks..."
CATCH_ERRORS=$(grep -r "catch (_error)" src/ | xargs -I {} grep -l "error\." {} | grep -v node_modules || true)
if [ -n "$CATCH_ERRORS" ]; then
    echo -e "${RED}❌ Variable reference errors found in files:${NC}"
    echo "$CATCH_ERRORS"
    echo ""
    # Show specific problematic lines
    for file in $CATCH_ERRORS; do
        echo -e "${YELLOW}Checking $file:${NC}"
        grep -n "catch (_error)" "$file" -A 5 | grep "error\." || true
    done
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
    echo -e "${GREEN}✅ No variable reference errors found${NC}"
fi
echo ""

# Check 3: Invalid import statements
echo "3️⃣ Checking for invalid import statements..."
IMPORT_ERRORS=$(grep -r "import.*_[A-Z]" src/ | grep "@heroicons" | grep -v node_modules || true)
if [ -n "$IMPORT_ERRORS" ]; then
    echo -e "${RED}❌ Invalid import statements found:${NC}"
    echo "$IMPORT_ERRORS"
    echo ""
    ERRORS_FOUND=$((ERRORS_FOUND + 1))
else
    echo -e "${GREEN}✅ No invalid import statements found${NC}"
fi
echo ""

# Check 4: TypeScript compilation
echo "4️⃣ Running TypeScript compilation check..."
if command -v npm &> /dev/null; then
    if npm run type-check > /tmp/ts-check.log 2>&1; then
        echo -e "${GREEN}✅ TypeScript compilation passed${NC}"
    else
        echo -e "${RED}❌ TypeScript compilation failed:${NC}"
        cat /tmp/ts-check.log
        ERRORS_FOUND=$((ERRORS_FOUND + 1))
    fi
else
    echo -e "${YELLOW}⚠️ npm not available, skipping TypeScript check${NC}"
    WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
fi
echo ""

# Check 5: ESLint validation (if available)
echo "5️⃣ Running ESLint validation..."
if command -v npm &> /dev/null && npm list eslint > /dev/null 2>&1; then
    if npm run lint > /tmp/eslint-check.log 2>&1; then
        echo -e "${GREEN}✅ ESLint validation passed${NC}"
    else
        echo -e "${RED}❌ ESLint validation failed:${NC}"
        head -20 /tmp/eslint-check.log
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
    fi
else
    echo -e "${YELLOW}⚠️ ESLint not available, skipping lint check${NC}"
    WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
fi
echo ""

# Summary
echo "📊 REGRESSION CHECK SUMMARY"
echo "=========================="
echo -e "Errors Found: ${RED}$ERRORS_FOUND${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS_FOUND${NC}"
echo ""

if [ $ERRORS_FOUND -eq 0 ]; then
    echo -e "${GREEN}🎉 All regression checks passed!${NC}"
    echo "✅ Ready for commit/deployment"
    exit 0
else
    echo -e "${RED}🚨 Regression issues detected!${NC}"
    echo "❌ Fix errors before proceeding"
    echo ""
    echo "💡 Quick fixes:"
    echo "  - Parameter issues: Change 'e.' to '_e.' in event handlers"
    echo "  - Variable issues: Change 'error.' to '_error.' in catch blocks" 
    echo "  - Import issues: Remove '_' prefix from @heroicons imports"
    exit 1
fi