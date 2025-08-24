# MCP Server Configuration Fix

## Issue
The MCP server for Supabase was not starting in Claude Desktop due to incorrect configuration.

## Root Cause
The configuration was pointing to a wrapper script instead of directly running the MCP server with `npx tsx`.

## Solution Applied

### Updated Configuration
Changed from using wrapper script to direct execution:

```json
"supabase": {
  "command": "npx",
  "args": [
    "tsx",
    "/Users/christianmerrill/Desktop/universal-ai-tools/src/mcp/supabase-mcp-server.ts"
  ],
  "env": {
    "SUPABASE_URL": "http://127.0.0.1:54321",
    "SUPABASE_SERVICE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
  }
}
```

## Files Modified
- `/Users/christianmerrill/Library/Application Support/Claude/claude_desktop_config.json`

## Backup Created
- `/Users/christianmerrill/Library/Application Support/Claude/claude_desktop_config.json.working-backup`

## Testing
Verified the MCP server starts correctly with:
```bash
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Ufcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
npx tsx src/mcp/supabase-mcp-server.ts
```

## Next Steps
1. **Restart Claude Desktop** to apply the configuration changes
2. The Supabase MCP server should now appear as connected in Claude

## Architecture Clarification
- **Supabase**: Runs in Docker containers (PostgreSQL database and services)
- **MCP Server**: Runs locally as a client that connects to Supabase
- **Claude Desktop**: Uses the MCP server to save/retrieve context via stdio communication