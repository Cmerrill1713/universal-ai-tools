# Claude Desktop Integration Guide

## Overview
Claude Desktop is configured to use the Universal AI Tools through enhanced MCP (Model Context Protocol) tools.

## Configuration Location
`~/Library/Application Support/Claude/claude_desktop_config.json`

## Available Tools in Claude

### Memory Management
- **`universal_memory_store`** - Store memories accessible by any AI
  ```
  Store this React pattern in universal memory with tags: react, hooks, performance
  ```

- **`universal_memory_search`** - Search across all stored memories
  ```
  Search universal memory for Python debugging techniques
  ```

### Context Management
- **`universal_context_store`** - Save project/conversation context
  ```
  Save this project setup to context key: project:my-dashboard
  ```

- **`universal_context_retrieve`** - Retrieve saved context
  ```
  Retrieve context for project:my-dashboard
  ```

### Knowledge Base
- **`universal_knowledge_add`** - Add to shared knowledge base
  ```
  Add this API documentation to the knowledge base
  ```

- **`universal_knowledge_search`** - Search knowledge base
  ```
  Search knowledge base for React best practices
  ```

### AI Communication
- **`ai_communicate`** - Send messages to other AI services
  ```
  Send a message to the trading bot about market conditions
  ```

### Tool Management
- **`universal_tools_list`** - List all available tools
- **`universal_tool_execute`** - Execute any registered tool

## Best Practices

### Memory Types
- **episodic**: Specific events/sessions
- **semantic**: Facts and concepts  
- **procedural**: How-to knowledge
- **working**: Temporary session data

### Context Keys
Use consistent naming:
- `project:<name>` - Project-specific context
- `config:<tool>` - Tool configurations
- `pattern:<type>` - Code patterns

### Tagging
Always include relevant tags for better search:
```
Store with tags: python, api, authentication, jwt
```

## Example Workflows

### Starting a New Project
```
Me: I'm starting a new React dashboard project

Claude: Let me check our universal memory for React dashboard patterns...
[Uses universal_memory_search]
[Uses universal_context_retrieve for "react-dashboard"]
```

### Saving Project Decisions
```
Claude: I'll save these architecture decisions for future reference
[Uses universal_context_store]
[Uses universal_memory_store with relevant tags]
```

### Cross-Project Learning
```
Claude: Based on our previous projects, I remember you prefer...
[Uses universal_memory_search to find patterns]
```

## Troubleshooting

### Tools Not Appearing
1. Restart Claude Desktop
2. Check if Universal AI Tools service is running
3. Verify MCP configuration

### Memory/Context Issues
1. Check service logs: `tail -f /tmp/universal-ai-tools.out`
2. Verify database connection
3. Check API authentication

### Service Connection
```bash
# Test service
curl http://localhost:9999/health

# Check logs
tail -f /tmp/universal-ai-tools.out
```