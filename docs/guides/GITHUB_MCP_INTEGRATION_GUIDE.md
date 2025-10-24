# 🚀 GitHub MCP Integration Guide

## Overview

This comprehensive GitHub MCP (Model Context Protocol) integration provides full GitHub API access through our Supabase backend, enabling agents to interact with repositories, issues, pull requests, commits, and more.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub API    │◄──►│  GitHub MCP      │◄──►│    Supabase     │
│                 │    │  Server (8096)   │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ GitHub Webhook   │
                       │ Handler (8095)   │
                       └──────────────────┘
```

## 📦 Components

### 1. GitHub MCP Server (`src/mcp/github-mcp-server.ts`)
- **Port**: 8096
- **Purpose**: Provides MCP tools for GitHub API access
- **Features**:
  - Repository search and management
  - Issue and PR operations
  - Commit and file access
  - Repository analysis
  - Data storage in Supabase

### 2. GitHub Webhook Handler (`src/services/github-webhook-handler.ts`)
- **Port**: 8095
- **Purpose**: Processes GitHub webhook events
- **Events Supported**:
  - `push` - Commit events
  - `issues` - Issue events
  - `pull_request` - PR events
  - `release` - Release events
  - `repository` - Repository events
  - `create`/`delete` - Branch/tag events
  - `fork` - Fork events
  - `star` - Star events
  - `watch` - Watch events

### 3. Supabase Database Schema (`supabase/migrations/20250115_github_mcp_integration.sql`)
- **Tables**:
  - `github_repositories` - Repository data
  - `github_issues` - Issue data
  - `github_pull_requests` - PR data
  - `github_commits` - Commit data
  - `github_data` - General data storage
  - `github_analysis` - Analysis results
  - `github_webhooks` - Webhook events
  - `github_users` - User data
  - `github_contributors` - Contributor data
  - `github_languages` - Language data
  - `github_topics` - Topic data
  - `github_releases` - Release data

### 4. GitHub MCP Integration Service (`src/services/github-mcp-integration.ts`)
- **Purpose**: High-level integration service
- **Features**:
  - Repository management
  - Issue and PR operations
  - Data querying and analysis
  - Health monitoring

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Required environment variables
export GITHUB_TOKEN="your_github_token"
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
export GITHUB_WEBHOOK_SECRET="your_webhook_secret"
```

### 2. Install Dependencies

```bash
npm install @modelcontextprotocol/sdk @octokit/webhooks-types --legacy-peer-deps
```

### 3. Run Database Migration

```bash
# Apply the GitHub MCP schema
supabase db push
```

### 4. Start Services

```bash
# Start GitHub MCP services
./scripts/start-github-mcp.sh
```

### 5. Test Integration

```bash
# Run comprehensive tests
./scripts/test-github-mcp.sh
```

## 🛠️ Available Tools

### Repository Tools
- `github_search_repositories` - Search repositories with filters
- `github_get_repository` - Get repository details
- `github_analyze_repository` - Analyze repository metrics

### Issue Tools
- `github_list_issues` - List repository issues
- `github_get_issue` - Get issue details
- `github_create_issue` - Create new issues

### Pull Request Tools
- `github_list_pull_requests` - List repository PRs
- `github_get_pull_request` - Get PR details
- `github_create_pull_request` - Create new PRs

### Commit Tools
- `github_list_commits` - List repository commits
- `github_get_commit` - Get commit details

### File Tools
- `github_get_file_contents` - Get file/directory contents

### Data Tools
- `github_store_data` - Store data in Supabase
- `github_analyze_repository` - Perform repository analysis

## 📊 Usage Examples

### Search Repositories

```bash
curl -X POST http://localhost:8096/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_search_repositories",
    "arguments": {
      "query": "language:rust stars:>100",
      "sort": "stars",
      "per_page": 10
    }
  }'
```

### Get Repository Details

```bash
curl -X POST http://localhost:8096/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_get_repository",
    "arguments": {
      "owner": "microsoft",
      "repo": "vscode"
    }
  }'
```

### List Issues

```bash
curl -X POST http://localhost:8096/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_list_issues",
    "arguments": {
      "owner": "microsoft",
      "repo": "vscode",
      "state": "open",
      "per_page": 5
    }
  }'
```

### Analyze Repository

```bash
curl -X POST http://localhost:8096/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "github_analyze_repository",
    "arguments": {
      "owner": "microsoft",
      "repo": "vscode",
      "analysis_type": "overview"
    }
  }'
```

## 🔗 Webhook Setup

### 1. Configure GitHub Webhook

1. Go to your GitHub repository settings
2. Navigate to "Webhooks" section
3. Click "Add webhook"
4. Set Payload URL: `http://your-domain:8095/webhook`
5. Set Content type: `application/json`
6. Set Secret: Your webhook secret
7. Select events:
   - Push
   - Issues
   - Pull requests
   - Releases
   - Repository
   - Create
   - Delete
   - Fork
   - Star
   - Watch

### 2. Test Webhook

```bash
# Test webhook endpoint
curl -X POST http://localhost:8095/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"test": "data"}'
```

## 📈 Repository Analysis

### Health Score Calculation

The system calculates repository health scores based on:

- **Stars Factor** (0-30 points): Based on star count
- **Recent Activity** (0-25 points): Days since last update
- **Issue Health** (0-25 points): Ratio of closed to total issues
- **PR Health** (0-20 points): Ratio of merged to total PRs

### Analysis Types

- `overview` - Basic repository information and health score
- `activity` - Recent commits and releases
- `contributors` - Contributor statistics
- `languages` - Language distribution
- `issues` - Issue analysis and trends
- `prs` - Pull request analysis and trends

## 🔍 Data Querying

### Supabase Functions

```sql
-- Get repository health score
SELECT get_repository_health_score('microsoft/vscode');

-- Search repositories
SELECT * FROM search_github_repositories('rust', 'Rust', 100, 50);

-- Get repository statistics
SELECT * FROM get_repository_stats('microsoft/vscode');
```

### Repository Summary View

```sql
-- Get comprehensive repository summary
SELECT * FROM github_repository_summary 
WHERE full_name = 'microsoft/vscode';
```

## 🛡️ Security

### Authentication
- GitHub token required for API access
- Webhook signature verification
- Supabase RLS policies enabled

### Rate Limiting
- GitHub API rate limits respected
- Automatic retry with exponential backoff
- Request queuing for high-volume operations

### Data Privacy
- All data stored in Supabase
- RLS policies control access
- Sensitive data encrypted

## 📊 Monitoring

### Health Checks

```bash
# MCP Server health
curl http://localhost:8096/health

# Webhook handler health
curl http://localhost:8095/health
```

### Logs

```bash
# View MCP server logs
tail -f logs/github-mcp-server.log

# View webhook handler logs
tail -f logs/github-webhook-handler.log
```

### Metrics

- Repository count
- Issue count
- PR count
- Commit count
- Analysis count
- Webhook events processed

## 🔧 Configuration

### MCP Configuration (`mcp-config-github.json`)

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["src/mcp/github-mcp-server.ts"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    }
  }
}
```

### Environment Variables

```bash
# Required
GITHUB_TOKEN=ghp_...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
GITHUB_WEBHOOK_SECRET=your_secret

# Optional
GITHUB_MCP_PORT=8096
GITHUB_WEBHOOK_PORT=8095
```

## 🚨 Troubleshooting

### Common Issues

1. **MCP Server Not Starting**
   - Check GitHub token validity
   - Verify Supabase connection
   - Check port availability

2. **Webhook Handler Not Receiving Events**
   - Verify webhook URL accessibility
   - Check webhook secret
   - Ensure GitHub webhook is configured

3. **Database Connection Issues**
   - Verify Supabase URL and key
   - Check network connectivity
   - Ensure database schema is applied

### Debug Commands

```bash
# Check service status
ps aux | grep github

# Test API connectivity
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user

# Test Supabase connectivity
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/github_repositories?select=count"
```

## 🎯 Next Steps

1. **Agent Integration**: Connect GitHub MCP with existing agents
2. **Advanced Analysis**: Implement ML-based repository analysis
3. **Automation**: Create automated workflows based on GitHub events
4. **Dashboard**: Build GitHub analytics dashboard
5. **Notifications**: Implement real-time notifications for GitHub events

## 📚 API Reference

### MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `github_search_repositories` | Search repositories | `query`, `sort`, `order`, `per_page`, `page` |
| `github_get_repository` | Get repository details | `owner`, `repo` |
| `github_list_issues` | List repository issues | `owner`, `repo`, `state`, `labels`, `assignee` |
| `github_get_issue` | Get issue details | `owner`, `repo`, `issue_number` |
| `github_create_issue` | Create new issue | `owner`, `repo`, `title`, `body`, `labels`, `assignees` |
| `github_list_pull_requests` | List repository PRs | `owner`, `repo`, `state`, `head`, `base` |
| `github_get_pull_request` | Get PR details | `owner`, `repo`, `pull_number` |
| `github_create_pull_request` | Create new PR | `owner`, `repo`, `title`, `head`, `base`, `body`, `draft` |
| `github_list_commits` | List repository commits | `owner`, `repo`, `sha`, `path`, `author`, `since`, `until` |
| `github_get_commit` | Get commit details | `owner`, `repo`, `sha` |
| `github_get_file_contents` | Get file contents | `owner`, `repo`, `path`, `ref` |
| `github_store_data` | Store data in Supabase | `data_type`, `data`, `repository_id`, `tags` |
| `github_analyze_repository` | Analyze repository | `owner`, `repo`, `analysis_type` |

### Webhook Events

| Event | Description | Data Stored |
|-------|-------------|-------------|
| `push` | Commit events | Commits table |
| `issues` | Issue events | Issues table |
| `pull_request` | PR events | Pull requests table |
| `release` | Release events | Releases table |
| `repository` | Repository events | Repositories table |
| `create` | Branch/tag creation | Data table |
| `delete` | Branch/tag deletion | Data table |
| `fork` | Repository fork | Data table |
| `star` | Repository star | Data table |
| `watch` | Repository watch | Data table |

This comprehensive GitHub MCP integration provides a powerful foundation for AI agents to interact with GitHub repositories, analyze data, and automate workflows through our Supabase backend.
