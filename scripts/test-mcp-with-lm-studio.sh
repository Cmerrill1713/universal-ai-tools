#!/bin/bash

echo "🚀 MCP Server Test Script for LM Studio Integration"
echo "=================================================="
echo

# Check if MCP server is running
echo "1. Checking MCP server health..."
HEALTH=$(curl -s http://localhost:3456/health)
if [ $? -eq 0 ]; then
    echo "✅ MCP server is running:"
    echo "$HEALTH" | jq
else
    echo "❌ MCP server is not accessible at http://localhost:3456"
    echo "   Run: docker-compose -f docker-compose.mcp.yml up -d"
    exit 1
fi

echo
echo "2. Available MCP tools:"
curl -s http://localhost:3456/api/mcp/tools | jq '.tools[].name'

echo
echo "3. Testing context save (in-memory mode):"
SAVE_RESULT=$(curl -s -X POST http://localhost:3456/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "method": "save_context",
    "params": {
      "content": "LM Studio integration test: The user is working on a TypeScript project",
      "category": "project_context",
      "metadata": {
        "source": "lm_studio_test",
        "model": "your-model-name"
      }
    }
  }')
echo "$SAVE_RESULT" | jq

echo
echo "4. Testing context retrieval:"
SEARCH_RESULT=$(curl -s -X POST http://localhost:3456/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "method": "get_recent_context",
    "params": {
      "limit": 5
    }
  }')
echo "$SEARCH_RESULT" | jq

echo
echo "5. LM Studio Configuration Instructions:"
echo "========================================="
echo
echo "Add this to your LM Studio system prompt or model instructions:"
echo
cat << 'EOF'
You have access to an MCP (Model Context Protocol) server that provides persistent memory across conversations.

Available MCP endpoints at http://localhost:3456:

1. Save important context:
   curl -X POST http://localhost:3456/api/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"method":"save_context","params":{"content":"...","category":"..."}}'

2. Search previous context:
   curl -X POST http://localhost:3456/api/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"method":"search_context","params":{"query":"..."}}'

3. Get recent context:
   curl -X POST http://localhost:3456/api/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"method":"get_recent_context","params":{"limit":10}}'

4. Save code patterns:
   curl -X POST http://localhost:3456/api/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"method":"save_code_pattern","params":{"pattern_type":"...","before_code":"...","after_code":"...","description":"...","error_types":[...]}}'

Use these endpoints to maintain context and learn from previous interactions.
EOF

echo
echo "6. Example Python script for LM Studio custom code:"
echo "===================================================="
echo
cat << 'EOF'
import requests
import json

class MCPClient:
    def __init__(self, base_url="http://localhost:3456"):
        self.base_url = base_url
    
    def save_context(self, content, category, metadata=None):
        """Save context to MCP server"""
        response = requests.post(
            f"{self.base_url}/api/mcp/execute",
            json={
                "method": "save_context",
                "params": {
                    "content": content,
                    "category": category,
                    "metadata": metadata or {}
                }
            }
        )
        return response.json()
    
    def search_context(self, query, limit=10):
        """Search for context"""
        response = requests.post(
            f"{self.base_url}/api/mcp/execute",
            json={
                "method": "search_context",
                "params": {
                    "query": query,
                    "limit": limit
                }
            }
        )
        return response.json()
    
    def get_recent_context(self, category=None, limit=20):
        """Get recent context entries"""
        params = {"limit": limit}
        if category:
            params["category"] = category
        
        response = requests.post(
            f"{self.base_url}/api/mcp/execute",
            json={
                "method": "get_recent_context",
                "params": params
            }
        )
        return response.json()

# Usage example:
mcp = MCPClient()

# Save context about current conversation
mcp.save_context(
    content="User is debugging TypeScript compilation errors",
    category="current_task",
    metadata={"priority": "high", "session": "2025-08-02"}
)

# Search for relevant context
results = mcp.search_context("TypeScript errors")
print(json.dumps(results, indent=2))
EOF

echo
echo "🎉 MCP server is ready for use with LM Studio!"
echo "   Server URL: http://localhost:3456"
echo "   WebSocket: ws://localhost:3456/ws"
echo