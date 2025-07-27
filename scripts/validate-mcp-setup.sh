#!/bin/bash

echo "================================================"
echo "MCP (Model Context Protocol) Setup Validation"
echo "================================================"
echo

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        echo "  $3"
    fi
}

echo "1. Checking MCP Server Installations"
echo "-----------------------------------"

# Check each MCP server
servers=(
    "@modelcontextprotocol/server-filesystem"
    "@modelcontextprotocol/server-github"
    "@modelcontextprotocol/server-brave-search"
    "@modelcontextprotocol/server-puppeteer"
)

for server in "${servers[@]}"; do
    if npm list -g "$server" &>/dev/null; then
        version=$(npm list -g "$server" 2>/dev/null | grep "$server" | head -1 | grep -o '@[0-9.]*' | tail -1)
        check_status 0 "$server $version"
    else
        check_status 1 "$server" "Not installed. Run: npm install -g $server"
    fi
done

echo
echo "2. Checking MCP Server Executables"
echo "---------------------------------"

# Check executable files
executables=(
    "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"
    "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-github/dist/index.js"
    "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-brave-search/dist/index.js"
    "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-puppeteer/dist/index.js"
)

for exe in "${executables[@]}"; do
    if [ -f "$exe" ] && [ -x "$exe" ]; then
        check_status 0 "$(basename $(dirname $(dirname $exe)))/dist/index.js"
    else
        check_status 1 "$(basename $(dirname $(dirname $exe)))/dist/index.js" "Executable not found or not executable"
    fi
done

echo
echo "3. Checking Configuration Files"
echo "------------------------------"

# Check Claude configuration files
if [ -f ~/.claude/settings.local.json ]; then
    if python3 -m json.tool < ~/.claude/settings.local.json &>/dev/null; then
        check_status 0 "~/.claude/settings.local.json (valid JSON)"
    else
        check_status 1 "~/.claude/settings.local.json" "Invalid JSON format"
    fi
else
    check_status 1 "~/.claude/settings.local.json" "File not found"
fi

if [ -f .claude.json ]; then
    if python3 -m json.tool < .claude.json &>/dev/null; then
        check_status 0 ".claude.json (valid JSON)"
    else
        check_status 1 ".claude.json" "Invalid JSON format"
    fi
else
    check_status 1 ".claude.json" "File not found"
fi

echo
echo "4. Checking API Keys Configuration"
echo "---------------------------------"

# Check for API keys in settings
if [ -f ~/.claude/settings.local.json ]; then
    if grep -q "GITHUB_PERSONAL_ACCESS_TOKEN" ~/.claude/settings.local.json; then
        if grep -q '"GITHUB_PERSONAL_ACCESS_TOKEN": ""' ~/.claude/settings.local.json; then
            check_status 1 "GitHub API Token" "Token is empty"
        else
            check_status 0 "GitHub API Token (configured)"
        fi
    else
        check_status 1 "GitHub API Token" "Not configured"
    fi

    if grep -q "BRAVE_API_KEY" ~/.claude/settings.local.json; then
        if grep -q '"BRAVE_API_KEY": ""' ~/.claude/settings.local.json; then
            check_status 1 "Brave API Key" "Key is empty"
        else
            check_status 0 "Brave API Key (configured)"
        fi
    else
        check_status 1 "Brave API Key" "Not configured"
    fi
fi

echo
echo "5. Checking Additional Dependencies"
echo "----------------------------------"

# Check for uv (for Serena)
if command -v uv &>/dev/null; then
    uv_version=$(uv --version 2>/dev/null | head -1)
    check_status 0 "uv $uv_version"
else
    check_status 1 "uv" "Not installed. Serena MCP server requires uv"
fi

# Check for Serena directory
if [ -d ~/serena-mcp ]; then
    check_status 0 "Serena MCP directory exists"
else
    check_status 1 "Serena MCP directory" "~/serena-mcp not found"
fi

# Check for Chrome (for Puppeteer)
if [ -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    check_status 0 "Google Chrome (for Puppeteer)"
else
    check_status 1 "Google Chrome" "Not found at expected location for Puppeteer"
fi

echo
echo "6. Environment Setup"
echo "-------------------"

# Check Node.js version
if command -v node &>/dev/null; then
    node_version=$(node --version)
    check_status 0 "Node.js $node_version"
else
    check_status 1 "Node.js" "Not installed"
fi

# Check npm version
if command -v npm &>/dev/null; then
    npm_version=$(npm --version)
    check_status 0 "npm $npm_version"
else
    check_status 1 "npm" "Not installed"
fi

echo
echo "7. MCP Server Status Summary"
echo "---------------------------"

echo -e "${YELLOW}Configured MCP Servers:${NC}"
echo "• Filesystem - Access to project files"
echo "• GitHub - Repository and code access"
echo "• Brave Search - Web search capabilities"
echo "• Puppeteer - Browser automation"
echo "• Serena - Semantic code search"

echo
echo "================================================"
echo "Setup validation complete!"
echo "================================================"