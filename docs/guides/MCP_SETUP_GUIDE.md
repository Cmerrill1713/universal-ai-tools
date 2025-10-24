# MCP (Model Context Protocol) Setup Guide

This guide will help you set up MCP servers for enhanced Claude Code functionality.

## Prerequisites

1. **Node.js** - Required for running MCP servers via npx
2. **API Keys** - You'll need to obtain API keys for some services

## MCP Servers Configured

### 1. GitHub MCP Server

Provides access to GitHub repositories, issues, pull requests, and more.

**Setup:**

1. Create a GitHub Personal Access Token:
   - Go to https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo`, `read:org`, `read:user`
   - Copy the token

2. Update the token in `~/.claude/settings.local.json`:
   - Replace `YOUR_GITHUB_TOKEN` with your actual token

### 2. Brave Search MCP Server

Enables web search capabilities using Brave Search API.

**Setup:**

1. Get a Brave Search API key:
   - Visit https://brave.com/search/api/
   - Sign up for an account
   - Create an API key
   - Copy the key

2. Update the key in `~/.claude/settings.local.json`:
   - Replace `YOUR_BRAVE_API_KEY` with your actual key

### 3. Filesystem MCP Server

Provides enhanced file system operations.

**Setup:**

- Already configured to use your project directory
- No additional setup needed

### 4. Serena MCP Server

Advanced semantic code retrieval and editing capabilities.

**Setup:**

1. Install Serena globally:

   ```bash
   npm install -g serena
   ```

2. Verify installation:
   ```bash
   serena --version
   ```

## Installing MCP Servers

Run these commands to ensure all MCP servers are available:

```bash
# Install MCP servers globally for better performance
npm install -g @modelcontextprotocol/server-github
npm install -g @modelcontextprotocol/server-brave-search
npm install -g @modelcontextprotocol/server-filesystem
npm install -g serena
```

## Updating Your Configuration

1. Open `~/.claude/settings.local.json`
2. Replace the placeholder values:
   - `YOUR_GITHUB_TOKEN` - Your GitHub Personal Access Token
   - `YOUR_BRAVE_API_KEY` - Your Brave Search API key

## Testing MCP Servers

After configuration, restart Claude Code and run:

```
/mcp
```

You should see the configured MCP servers listed.

## Available MCP Commands

Once configured, you can use these enhanced capabilities:

### GitHub Commands

- Search repositories
- Read issues and pull requests
- Access code across repositories

### Brave Search Commands

- Search the web for documentation
- Find code examples
- Research solutions

### Filesystem Commands

- Advanced file operations
- Bulk file modifications
- Pattern-based file searches

### Serena Commands

- Semantic code search
- Context-aware code editing
- Intelligent code navigation

## Troubleshooting

If MCP servers don't appear:

1. Restart Claude Code
2. Check that API keys are correctly set
3. Ensure Node.js is installed
4. Run `/doctor` to diagnose issues

## Security Notes

- Keep your API keys secure
- Don't commit the settings file to version control
- Regularly rotate your API keys
- Use minimal required permissions for tokens
