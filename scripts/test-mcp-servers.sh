#!/bin/bash

echo "🔧 MCP Server Test Script - Universal AI Tools"
echo "============================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_server() {
    local name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    echo -n "Testing $name... "
    
    # Test with JSON-RPC message and timeout
    result=$(timeout 5s bash -c "echo '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}' | $command 2>/dev/null" | head -1)
    
    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ Working${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed${NC}"
        return 1
    fi
}

echo "Testing MCP Servers:"
echo "-------------------"

# Test Universal AI Tools MCP Server
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key-here"
export NODE_ENV="production"
test_server "Universal AI Tools" "node /Users/christianmerrill/Desktop/universal-ai-tools/src/mcp/server.js" '"result"'

# Test GitHub MCP Server
export GITHUB_TOKEN="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"
test_server "GitHub (octocode-mcp)" "npx -y octocode-mcp@4.1.0" '"result"'

# Test Filesystem MCP Server
test_server "Filesystem" "npx -y @modelcontextprotocol/server-filesystem /Users/christianmerrill/Desktop" '"result"'

# Test XcodeBuildMCP Server
test_server "XcodeBuildMCP" "npx -y xcodebuildmcp@latest" '"result"'

echo ""
echo "📋 Configuration Summary:"
echo "------------------------"
echo "✅ Universal AI Tools MCP: /Users/christianmerrill/Desktop/universal-ai-tools/src/mcp/server.js"
echo "✅ GitHub MCP: octocode-mcp@4.1.0 (pinned stable version)"
echo "✅ Filesystem MCP: @modelcontextprotocol/server-filesystem"
echo "✅ XcodeBuildMCP: xcodebuildmcp@latest"
echo "❌ Brave Search MCP: Removed (missing API key)"

echo ""
echo "🔄 Next Steps:"
echo "-------------"
echo "1. Restart Claude Desktop to pick up the configuration changes"
echo "2. The MCP servers should now be available in Claude"
echo "3. Test using Claude with commands like 'List available MCP resources'"

echo ""
echo "📍 Configuration file: /Users/christianmerrill/.config/claude/claude_desktop_config.json"
echo ""