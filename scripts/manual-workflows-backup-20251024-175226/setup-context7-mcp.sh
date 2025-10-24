#!/bin/bash

echo "🚀 Context 7 MCP Server Setup"
echo "============================="
echo ""

# Check if already installed
if npm list -g @upstash/context7-mcp &> /dev/null; then
    echo "✅ Context 7 MCP is already installed"
    version=$(npm list -g @upstash/context7-mcp | grep "@upstash/context7-mcp" | head -1 | awk -F@ '{print $NF}')
    echo "   Version: $version"
else
    echo "📦 Installing Context 7 MCP Server..."
    npm install -g @upstash/context7-mcp
    
    if [ $? -eq 0 ]; then
        echo "✅ Context 7 MCP installed successfully"
    else
        echo "❌ Failed to install Context 7 MCP"
        exit 1
    fi
fi
echo ""

# Create updated settings file
echo "📝 Creating optimized settings configuration..."
cat > ~/.claude/settings.local.json.optimized << 'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "node",
      "args": [
        "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-filesystem/dist/index.js",
        "/Users/christianmerrill/Desktop"
      ],
      "description": "File operations and project management"
    },
    "github": {
      "command": "node",
      "args": [
        "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-github/dist/index.js"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "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",
        "GITHUB_DEFAULT_OWNER": "christianmerrill",
        "GITHUB_DEFAULT_REPO": "universal-ai-tools"
      },
      "description": "Code triage and GitHub integration"
    },
    "brave-search": {
      "command": "node",
      "args": [
        "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-brave-search/dist/index.js"
      ],
      "env": {
        "BRAVE_API_KEY": "BSACQUwb2YuO-_9SfU6K0Q3O-Eey4r3"
      },
      "description": "Web search for documentation and solutions"
    },
    "serena": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "/Users/christianmerrill/serena-mcp",
        "serena-mcp-server"
      ],
      "env": {
        "SERENA_PROJECTS_DIR": "/Users/christianmerrill/Desktop"
      },
      "description": "Semantic code analysis and navigation"
    },
    "context7": {
      "command": "node",
      "args": [
        "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@upstash/context7-mcp/dist/index.js"
      ],
      "env": {
        "UPSTASH_REDIS_REST_URL": "YOUR_UPSTASH_URL",
        "UPSTASH_REDIS_REST_TOKEN": "YOUR_UPSTASH_TOKEN"
      },
      "description": "Advanced context persistence with Context 7"
    }
  },
  "permissions": {
    "allow": [
      "Bash(cat:*)",
      "filesystem:read",
      "filesystem:write",
      "github:read",
      "brave-search:search",
      "context7:read",
      "context7:write"
    ],
    "deny": []
  }
}
EOF

echo "✅ Created optimized configuration at ~/.claude/settings.local.json.optimized"
echo ""

# Check for Upstash credentials
echo "⚠️  Context 7 requires Upstash Redis credentials"
echo ""
echo "To complete setup:"
echo "1. Sign up for a free Upstash account at https://upstash.com/"
echo "2. Create a new Redis database"
echo "3. Copy your REST URL and TOKEN"
echo "4. Update the configuration file with your credentials:"
echo "   - Replace YOUR_UPSTASH_URL with your REST URL"
echo "   - Replace YOUR_UPSTASH_TOKEN with your REST TOKEN"
echo ""
echo "5. After adding credentials, replace your current settings:"
echo "   cp ~/.claude/settings.local.json ~/.claude/settings.local.json.backup"
echo "   cp ~/.claude/settings.local.json.optimized ~/.claude/settings.local.json"
echo ""
echo "6. Restart Claude Code completely"
echo ""

# Create a quick reference guide
cat > ~/Desktop/universal-ai-tools/MCP_QUICK_REFERENCE.md << 'EOF'
# MCP Quick Reference Guide

## Available MCP Servers

### 1. Filesystem (Claude Operating Tools)
```
"Find all TypeScript files with errors"
"Create new component following patterns"
"Bulk rename functions across project"
```

### 2. Serena (Semantic Code Search)
```
"Find all classes extending BaseAgent"
"Show call hierarchy for function X"
"Analyze module dependencies"
```

### 3. GitHub (Code Triage)
```
"Search GitHub for similar error fixes"
"Find recent PRs modifying agents"
"Show open issues labeled 'bug'"
```

### 4. Brave Search (Information)
```
"Search for TypeScript 5 migration guide"
"Find DSPy framework documentation"
"Search for Express best practices"
```

### 5. Context 7 (Context Management)
```
"Remember this debugging strategy"
"What contexts have I saved?"
"Store current project understanding"
```

## Workflow Examples

### Debugging Session
1. Use Serena: "Find all syntax error patterns"
2. Use GitHub: "Search for similar issues"
3. Use Brave: "Find documentation for fix"
4. Use Context 7: "Save this solution for later"

### Code Review
1. Use GitHub: "Show recent PRs for review"
2. Use Serena: "Analyze code relationships"
3. Use Filesystem: "Apply suggested changes"
4. Use Context 7: "Remember review feedback"

### Feature Development
1. Use Brave: "Search for implementation examples"
2. Use Serena: "Find similar patterns in codebase"
3. Use Filesystem: "Create new feature files"
4. Use Context 7: "Track feature requirements"
EOF

echo "📚 Created MCP Quick Reference at ~/Desktop/universal-ai-tools/MCP_QUICK_REFERENCE.md"
echo ""
echo "✨ Setup complete! Next steps above."