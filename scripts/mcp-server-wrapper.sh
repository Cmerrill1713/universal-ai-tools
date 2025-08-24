#!/bin/bash

# Universal AI Tools Supabase MCP Server Wrapper
# This script launches the MCP server with proper environment configuration

set -e

# Change to project directory
cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Ensure required environment variables are set
if [ -z "$SUPABASE_URL" ]; then
    export SUPABASE_URL="http://127.0.0.1:54321"
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
fi

# Launch the MCP server using tsx
exec npx tsx src/mcp/supabase-mcp-server.ts