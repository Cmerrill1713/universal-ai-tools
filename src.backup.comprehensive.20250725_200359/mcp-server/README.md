# Universal AI Tools MCP Server

This is a simplified MCP (Model Context Protocol) server for Universal AI Tools that enables Claude to interact with your agent ecosystem.

## Status

✅ **Working** - The simplified version is now functional and ready to use.

## Setup

1. **Install dependencies:**

   ```bash
   cd src/mcp-server
   npm install
   ```

2. **Build the server:**

   ```bash
   npx esbuild universal-ai-tools-mcp-simple.ts --bundle --platform=node --format=esm --outfile=universal-ai-tools-mcp-simple.js --external:@modelcontextprotocol/sdk
   ```

3. **Test the server:**
   ```bash
   node universal-ai-tools-mcp-simple.js
   ```

## Configuration

To use this MCP server with Claude, add the following to your `~/.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "universal-ai-tools": {
      "command": "node",
      "args": [
        "/absolute/path/to/universal-ai-tools/src/mcp-server/universal-ai-tools-mcp-simple.js"
      ]
    }
  }
}
```

## Available Tools

The simplified version provides these tools:

1. **test_connection** - Test the MCP server connection
2. **get_project_info** - Get information about the Universal AI Tools project

## Notes

- The full version (`universal-ai-tools-mcp.ts`) requires fixing syntax errors in dependent files first
- The simplified version (`universal-ai-tools-mcp-simple.ts`) works independently without dependencies on the main codebase
- Once the main codebase syntax errors are fixed, the full version can be rebuilt to provide complete agent orchestration capabilities
