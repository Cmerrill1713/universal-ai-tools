#!/bin/bash

# Comprehensive code cleaning script
# This script runs all available linters and formatters

set -e

echo "🧹 Starting comprehensive code cleanup..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# TypeScript/JavaScript cleanup
echo -e "\n${YELLOW}📦 TypeScript/JavaScript Cleanup${NC}"
echo "Running ESLint auto-fix..."
npx eslint src tests --ext .ts,.tsx --fix || true

echo "Running Prettier..."
npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,md}" || true

echo "Running unused imports cleanup..."
npm run fix:imports || true

echo "Running intelligent auto-fix..."
npm run fix:intelligent || true

# Python cleanup
echo -e "\n${YELLOW}🐍 Python Cleanup${NC}"
echo "Running Black formatter..."
black . --exclude="node_modules|ui/node_modules|build|dist" || true

echo "Running Ruff auto-fix..."
ruff check . --fix --exclude="node_modules,ui/node_modules,build,dist" || true

echo "Running isort for import sorting..."
isort . --skip node_modules --skip ui/node_modules --skip build --skip dist || true

# Security fixes
echo -e "\n${YELLOW}🔒 Security Fixes${NC}"
echo "Running npm audit fix..."
npm audit fix || true

# Type checking
echo -e "\n${YELLOW}🔍 Type Checking${NC}"
echo "Running TypeScript compiler check..."
npm run type-check || true

echo "Running MyPy for Python..."
mypy src/services/dspy-orchestrator/*.py --ignore-missing-imports || true

# Final report
echo -e "\n${GREEN}✅ Code cleanup complete!${NC}"
echo -e "${YELLOW}📊 Generating quality report...${NC}"

# Count remaining issues
ESLINT_ERRORS=$(npx eslint src tests --ext .ts,.tsx --format compact | grep -c "Error" || echo "0")
TS_ERRORS=$(npm run type-check 2>&1 | grep -c "error TS" || echo "0")
PYTHON_ERRORS=$(ruff check . --exclude="node_modules,ui/node_modules,build,dist" 2>&1 | grep -c "error" || echo "0")

echo -e "\n${YELLOW}📈 Quality Summary:${NC}"
echo "- ESLint errors remaining: $ESLINT_ERRORS"
echo "- TypeScript errors remaining: $TS_ERRORS"
echo "- Python errors remaining: $PYTHON_ERRORS"

if [ "$ESLINT_ERRORS" -eq "0" ] && [ "$TS_ERRORS" -eq "0" ] && [ "$PYTHON_ERRORS" -eq "0" ]; then
    echo -e "\n${GREEN}🎉 All code quality checks passed!${NC}"
else
    echo -e "\n${RED}⚠️  Some issues remain. Run 'npm run quality:report' for details.${NC}"
fi