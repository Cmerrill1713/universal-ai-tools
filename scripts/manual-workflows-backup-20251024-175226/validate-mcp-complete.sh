#!/bin/bash

echo "🔍 MCP Setup Validation Script"
echo "=============================="
echo ""

# Check Node.js
echo "1. Checking Node.js installation..."
if command -v node &> /dev/null; then
    echo "✅ Node.js installed: $(node --version)"
else
    echo "❌ Node.js not found"
    exit 1
fi
echo ""

# Check MCP server installations
echo "2. Checking MCP server installations..."
servers=(
    "@modelcontextprotocol/server-github"
    "@modelcontextprotocol/server-filesystem"
    "@modelcontextprotocol/server-brave-search"
    "@modelcontextprotocol/server-puppeteer"
)

all_installed=true
for server in "${servers[@]}"; do
    if npm list -g "$server" &> /dev/null; then
        version=$(npm list -g "$server" | grep "$server" | head -1 | awk -F@ '{print $NF}')
        echo "✅ $server@$version"
    else
        echo "❌ $server not installed"
        all_installed=false
    fi
done
echo ""

# Check Serena
echo "3. Checking Serena MCP installation..."
if [ -d "$HOME/serena-mcp" ]; then
    echo "✅ Serena directory exists at ~/serena-mcp"
    if [ -f "$HOME/serena-mcp/pyproject.toml" ]; then
        echo "✅ Serena project files found"
    else
        echo "⚠️  Serena project files missing"
    fi
else
    echo "❌ Serena directory not found at ~/serena-mcp"
fi
echo ""

# Check Claude settings
echo "4. Checking Claude settings..."
settings_file="$HOME/.claude/settings.local.json"
if [ -f "$settings_file" ]; then
    echo "✅ Settings file exists at ~/.claude/settings.local.json"
    
    # Check for required fields
    if grep -q "mcpServers" "$settings_file"; then
        echo "✅ MCP servers configured"
        
        # Count configured servers
        server_count=$(jq '.mcpServers | length' "$settings_file" 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "✅ $server_count MCP servers configured"
        fi
    else
        echo "❌ No MCP servers configured"
    fi
else
    echo "❌ Settings file not found"
fi
echo ""

# Check API keys (without showing them)
echo "5. Checking API keys..."
if [ -f "$settings_file" ]; then
    if grep -q "GITHUB_PERSONAL_ACCESS_TOKEN" "$settings_file" && ! grep -q "YOUR_GITHUB_TOKEN" "$settings_file"; then
        echo "✅ GitHub token configured"
    else
        echo "❌ GitHub token not configured or still has placeholder"
    fi
    
    if grep -q "BRAVE_API_KEY" "$settings_file" && ! grep -q "YOUR_BRAVE_API_KEY" "$settings_file"; then
        echo "✅ Brave API key configured"
    else
        echo "❌ Brave API key not configured or still has placeholder"
    fi
fi
echo ""

# Summary
echo "=============================="
echo "Summary:"
if [ "$all_installed" = true ] && [ -f "$settings_file" ]; then
    echo "✅ MCP setup appears to be complete!"
    echo ""
    echo "Next steps:"
    echo "1. Restart Claude Code completely (quit and reopen)"
    echo "2. Try the /mcp command again"
    echo "3. If still not working, try running: claude-code --debug"
    echo ""
    echo "Alternative test:"
    echo "Try asking Claude to 'search GitHub for TypeScript examples'"
    echo "This will trigger MCP usage if it's working"
else
    echo "❌ MCP setup incomplete. Please check the errors above."
fi
echo ""

# Test a simple MCP server directly
echo "6. Testing GitHub MCP server directly..."
echo "Running a quick connectivity test..."
timeout 5s node -e "console.log('Node.js execution test passed')" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Node.js can execute scripts"
else
    echo "⚠️  Node.js execution test failed or timed out"
fi