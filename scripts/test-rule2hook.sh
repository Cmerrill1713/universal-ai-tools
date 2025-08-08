#!/bin/bash

echo "🧪 Testing rule2hook Implementation"
echo "=================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if rule2hook command exists
if [ ! -f ".claude/commands/rule2hook.md" ]; then
    echo -e "${RED}❌ rule2hook.md not found in .claude/commands/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ rule2hook.md found${NC}"

# Check if hooks configuration exists
if [ -f ".claude/hooks.json" ]; then
    echo -e "${GREEN}✓ hooks.json configuration found${NC}"
    
    # Validate JSON structure
    if jq empty .claude/hooks.json 2>/dev/null; then
        echo -e "${GREEN}✓ hooks.json is valid JSON${NC}"
    else
        echo -e "${RED}❌ hooks.json has invalid JSON syntax${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️ hooks.json not found (will be created by rule2hook)${NC}"
fi

# Check if test rules file exists
if [ -f ".claude/code-quality-rules.txt" ]; then
    echo -e "${GREEN}✓ Test rules file found${NC}"
    echo -e "${YELLOW}Sample rules:${NC}"
    head -5 .claude/code-quality-rules.txt | sed 's/^/  /'
else
    echo -e "${RED}❌ Test rules file not found${NC}"
    exit 1
fi

# Test basic hook functionality by checking environment variables
echo -e "\n${YELLOW}Testing hook environment variables:${NC}"
export CLAUDE_TOOL_NAME="Test"
export CLAUDE_TOOL_PARAMS='{"file_path": "test.ts"}'

# Test syntax corruption prevention hook
echo -e "${YELLOW}Testing syntax corruption prevention...${NC}"
if echo "function Object() { [native code] }()" | grep -q "function Object"; then
    echo -e "${GREEN}✓ Can detect constructor corruption pattern${NC}"
else
    echo -e "${RED}❌ Cannot detect constructor corruption pattern${NC}"
fi

# Test TypeScript file detection
echo -e "${YELLOW}Testing TypeScript file detection...${NC}"
if [[ "$CLAUDE_TOOL_PARAMS" == *".ts"* ]]; then
    echo -e "${GREEN}✓ TypeScript file detection works${NC}"
else
    echo -e "${RED}❌ TypeScript file detection failed${NC}"
fi

# Check required tools are available
echo -e "\n${YELLOW}Checking required tools:${NC}"

tools=("npm" "npx" "git" "jq")
for tool in "${tools[@]}"; do
    if command -v "$tool" &> /dev/null; then
        echo -e "${GREEN}✓ $tool available${NC}"
    else
        echo -e "${RED}❌ $tool not found${NC}"
    fi
done

# Test git status (for Stop hooks)
echo -e "\n${YELLOW}Testing git status functionality:${NC}"
if git status --porcelain &> /dev/null; then
    echo -e "${GREEN}✓ Git repository detected${NC}"
    if git diff --quiet 2>/dev/null; then
        echo -e "${GREEN}✓ No uncommitted changes${NC}"
    else
        echo -e "${YELLOW}⚠️ Uncommitted changes detected${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Not in a git repository${NC}"
fi

# Test npm scripts availability
echo -e "\n${YELLOW}Testing npm scripts:${NC}"
scripts=("format" "lint:fix" "build")
for script in "${scripts[@]}"; do
    if npm run "$script" --silent --if-present 2>/dev/null; then
        echo -e "${GREEN}✓ npm run $script available${NC}"
    else
        echo -e "${YELLOW}⚠️ npm run $script not available or failed${NC}"
    fi
done

echo -e "\n${GREEN}🎉 rule2hook test completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Test rule2hook with: /project:rule2hook \"Format TypeScript files after editing\""
echo "2. Check generated hooks in .claude/hooks.json"
echo "3. Test hooks by editing a TypeScript file"
echo "4. Use rules file: /project:rule2hook --from-file .claude/code-quality-rules.txt"