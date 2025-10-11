# Optimized MCP Server Configuration

## Overview

This guide configures each MCP server for its optimal use case:

- **Filesystem + Serena**: Claude's operating tools
- **GitHub**: Code triage and review
- **Brave Search**: Information gathering
- **Context 7**: Context management

## 1. Claude Operating Tools

### Filesystem MCP

**Purpose**: File operations, bulk edits, project management
**Current Status**: ✅ Configured

**Optimal Usage**:

```bash
# Examples of filesystem operations
"Find all TypeScript files with syntax errors"
"Create a new component following existing patterns"
"Rename all instances of a function across the project"
"Show me the project structure"
```

### Serena MCP

**Purpose**: Semantic code understanding and navigation
**Current Status**: ✅ Configured

**Optimal Usage**:

```bash
# Semantic code operations
"Find all classes that extend BaseAgent"
"Show me the call hierarchy for authenticateUser"
"Find all TODO comments in critical paths"
"Analyze dependencies of the memory module"
```

## 2. GitHub for Code Triage

### GitHub MCP

**Purpose**: Issue tracking, PR reviews, cross-repo analysis
**Current Status**: ✅ Configured with token

**Optimal Usage for Triage**:

```bash
# Code triage workflows
"Search GitHub for similar TypeScript parsing errors"
"Find issues related to authentication in this repo"
"Show me recent PRs that modified the agent system"
"Search for best practices for error handling in Express"
```

**Enhanced Configuration** (add to settings):

```json
{
  "github": {
    "command": "node",
    "args": [
      "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@modelcontextprotocol/server-github/dist/index.js"
    ],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN",
      "GITHUB_DEFAULT_OWNER": "christianmerrill",
      "GITHUB_DEFAULT_REPO": "universal-ai-tools"
    }
  }
}
```

## 3. Brave Search for Information

### Brave Search MCP

**Purpose**: Documentation, solutions, latest updates
**Current Status**: ✅ Configured with API key

**Optimal Usage**:

```bash
# Information gathering
"Search for TypeScript 5.0 migration guide"
"Find solutions for esbuild transform errors"
"Search for DSPy framework documentation"
"Find best practices for MCP server implementation"
```

## 4. Context Management

### Context 7 MCP Server

**Purpose**: Advanced context management and persistence
**Status**: ❌ Not installed

**Installation**:

```bash
npm install -g @upstash/context7-mcp
```

**Configuration to add**:

```json
{
  "context7": {
    "command": "node",
    "args": [
      "/opt/homebrew/Cellar/node@22/22.16.0/lib/node_modules/@upstash/context7-mcp/dist/index.js"
    ],
    "env": {
      "UPSTASH_REDIS_REST_URL": "YOUR_UPSTASH_URL",
      "UPSTASH_REDIS_REST_TOKEN": "YOUR_UPSTASH_TOKEN"
    }
  }
}
```

**Note**: Context 7 requires an Upstash Redis account for cloud-based context storage. Get your credentials at https://upstash.com/

**Optimal Usage**:

```bash
# Context management
"Remember this project uses Ollama for LLM services"
"Save the current debugging context"
"What did we discuss about the agent architecture?"
"Recall the syntax error patterns we fixed"
"Store this configuration for future sessions"
"What contexts have I saved for this project?"
```

## Complete Optimized Configuration

Here's your complete optimized `~/.claude/settings.local.json`:

```json
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
      "args": ["run", "--directory", "/Users/christianmerrill/serena-mcp", "serena-mcp-server"],
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
```

## Usage Patterns by Task

### 1. **Debugging & Fixing Errors**

- Use **Serena** to find all error patterns semantically
- Use **GitHub** to search for similar issues and solutions
- Use **Brave Search** for documentation on error fixes
- Use **Context 7** to track which errors have been fixed

### 2. **Code Review & Refactoring**

- Use **GitHub** to review PRs and related changes
- Use **Serena** for understanding code relationships
- Use **Filesystem** for bulk refactoring operations
- Use **Context 7** to maintain refactoring context

### 3. **Feature Development**

- Use **Brave Search** for best practices and examples
- Use **Serena** to understand existing patterns
- Use **Filesystem** to create new files following patterns
- Use **GitHub** to check related implementations

### 4. **Project Understanding**

- Use **Serena** for semantic code exploration
- Use **Context 7** to build and maintain project knowledge
- Use **Filesystem** to navigate project structure
- Use **GitHub** to understand project history

## Quick Reference Commands

```bash
# Operating Tools (Filesystem + Serena)
"Find all files with parsing errors"
"Show me the dependency graph for agent system"
"Rename all occurrences of oldFunction to newFunction"

# Code Triage (GitHub)
"Search my repos for authentication implementations"
"Find PRs that fixed similar syntax errors"
"Show issues labeled as 'bug' in last week"

# Information (Brave Search)
"Search for TypeScript strict mode best practices"
"Find DSPy optimization examples"
"Search for esbuild configuration guides"

# Context (Context 7 - after installation)
"Remember the current error fixing strategy"
"What patterns did we identify for syntax errors?"
"Save this debugging session context"
"Store the project architecture overview"
"Retrieve all saved contexts for this project"
```
