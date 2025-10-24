#!/bin/bash

# Intelligent Syntax Fix Runner
# Runs the TypeScript-based intelligent syntax fixer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧠 Universal AI Tools - Intelligent Agent-Based Syntax Fixer${NC}"
echo -e "${CYAN}This system uses specialized agents to fix different types of parsing errors${NC}"
echo

# Check if we have the required tools
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js${NC}"
    exit 1
fi

if ! command -v tsx &> /dev/null; then
    echo -e "${YELLOW}📦 Installing tsx for TypeScript execution...${NC}"
    npm install -g tsx
fi

echo -e "${BLUE}🚀 Running intelligent syntax fixer...${NC}"

# Run the TypeScript-based intelligent fixer
npx tsx intelligent-syntax-fixer.ts

echo -e "${GREEN}✅ Intelligent syntax fixing completed!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Run ${BLUE}npm run lint${NC} to check remaining errors"
echo -e "  2. Run ${BLUE}npm run build${NC} to test compilation" 
echo -e "  3. Run ${BLUE}npm test${NC} to verify functionality"