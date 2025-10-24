# Claude MCP (Model Context Protocol) Integration Guide

## Overview

MCP (Model Context Protocol) enables Claude to interact with external tools and services, extending its capabilities beyond basic text generation.

## Current MCP Setup Status

### ✅ Configured MCP Servers:

1. **GitHub MCP Server**
   - Status: Configured
   - Token: Active
   - Capabilities: Repository access, issues, PRs, code search

2. **Brave Search MCP Server**
   - Status: Configured
   - API Key: Active
   - Capabilities: Web search, documentation lookup

3. **Filesystem MCP Server**
   - Status: Configured
   - Root: `/Users/christianmerrill/Desktop/universal-ai-tools`
   - Capabilities: Enhanced file operations

4. **Serena MCP Server**
   - Status: Configured
   - Location: `~/serena-mcp`
   - Capabilities: Semantic code search, intelligent editing

## How to Use MCP in Claude Code

### 1. Check MCP Status

```
/mcp
```

This command shows all configured MCP servers.

### 2. Using MCP Capabilities

#### GitHub Integration

- Search repositories: "Search GitHub for React hooks examples"
- Read issues: "Show me open issues in my repository"
- Analyze code: "Find all TypeScript files with syntax errors"

#### Web Search (Brave)

- Documentation: "Search for Next.js 14 app router documentation"
- Solutions: "Find solutions for TypeScript parsing errors"
- Latest info: "Search for latest MCP server implementations"

#### Filesystem Operations

- Bulk operations: "Find all files containing '\_error' pattern"
- Advanced search: "List all TypeScript files modified in last 24 hours"
- Pattern matching: "Find files matching specific patterns"

#### Semantic Code Search (Serena)

- Symbol search: "Find all class definitions extending BaseAgent"
- Relationship mapping: "Show me all functions that call authenticateUser"
- Smart editing: "Update all import statements for common-constants"

## Configuration File Location

Your MCP configuration is stored in:

```
~/.claude/settings.local.json
```

## Adding New MCP Servers

To add a new MCP server:

1. Install the server package:

   ```bash
   npm install -g @modelcontextprotocol/server-name
   ```

2. Add to configuration:

   ```json
   {
     "mcpServers": {
       "new-server": {
         "command": "node",
         "args": ["/path/to/server/index.js"],
         "env": {
           "API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

3. Restart Claude Code

## Available MCP Servers

### Official Servers

- `@modelcontextprotocol/server-github` - GitHub integration
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-filesystem` - File operations
- `@modelcontextprotocol/server-slack` - Slack integration
- `@modelcontextprotocol/server-memory` - Persistent memory

### Community Servers

- `serena` - Semantic code search
- `mcp-server-sqlite` - SQLite database operations
- `mcp-server-postgres` - PostgreSQL operations
- `mcp-server-git` - Advanced git operations

## Troubleshooting

### MCP Servers Not Loading

1. Restart Claude Code
2. Check server paths exist
3. Verify API keys are valid
4. Run `/doctor` for diagnostics

### Server Crashes

1. Check logs in Claude Code console
2. Verify Node.js version compatibility
3. Ensure all dependencies installed
4. Check environment variables

### Permission Issues

1. Add required permissions to `settings.local.json`
2. Ensure file paths are accessible
3. Check API rate limits

## Security Considerations

1. **API Keys**: Store securely, never commit to version control
2. **Permissions**: Only grant necessary permissions
3. **File Access**: Limit filesystem server to project directories
4. **Token Rotation**: Regularly update API tokens

## Best Practices

1. **Use MCP for Complex Tasks**
   - Searching across multiple files
   - Analyzing code patterns
   - Bulk operations

2. **Combine MCP Servers**
   - Use GitHub + Brave for comprehensive research
   - Use Filesystem + Serena for code refactoring

3. **Performance Tips**
   - MCP operations can be slower than direct tool use
   - Use for tasks that benefit from semantic understanding
   - Cache results when possible

## Current Project Integration

For the Universal AI Tools project, MCP enhances:

- Finding all syntax error patterns across 300+ files
- Semantic search for agent implementations
- Web search for TypeScript solutions
- GitHub integration for related projects

## Next Steps

1. Restart Claude Code to activate all MCP servers
2. Use `/mcp` to verify servers are loaded
3. Leverage MCP for Phase 1 syntax error fixes
4. Use semantic search to find all error patterns efficiently
