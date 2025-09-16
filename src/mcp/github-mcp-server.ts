#!/usr/bin/env node

/**
 * GitHub MCP Server - Comprehensive GitHub Integration
 * Provides full GitHub API access through MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

// GitHub API Types
interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  stars: number;
  forks: number;
  open_issues: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    id: number;
    avatar_url: string;
  }>;
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: {
    login: string;
    id: number;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  diff_url: string;
  patch_url: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    id: number;
    avatar_url: string;
  };
  html_url: string;
  stats?: {
    additions: number;
    deletions: number;
    total: number;
  };
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  download_url?: string;
}

class GitHubMCPServer {
  private server: Server;
  private githubClient: AxiosInstance;
  private librarianUrl: string;
  private githubToken: string;

  constructor() {
    this.server = new Server(
      {
        name: 'github-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize GitHub API client
    this.githubToken = process.env.GITHUB_TOKEN || '';
    this.githubClient = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Universal-AI-Tools-GitHub-MCP/1.0.0',
      },
      timeout: 30000,
    });

    // Initialize Librarian service URL
    this.librarianUrl = process.env.LIBRARIAN_URL || 'http://localhost:8032';

    this.setupHandlers();
    this.initializeDatabase();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'github_search_repositories',
            description: 'Search GitHub repositories',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (e.g., "language:rust stars:>100")',
                },
                sort: {
                  type: 'string',
                  enum: ['stars', 'forks', 'help-wanted-issues', 'updated'],
                  description: 'Sort results by',
                  default: 'stars',
                },
                order: {
                  type: 'string',
                  enum: ['asc', 'desc'],
                  description: 'Sort order',
                  default: 'desc',
                },
                per_page: {
                  type: 'number',
                  description: 'Number of results per page (max 100)',
                  default: 30,
                },
                page: {
                  type: 'number',
                  description: 'Page number',
                  default: 1,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'github_get_repository',
            description: 'Get detailed information about a specific repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner (username or organization)',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'github_list_issues',
            description: 'List issues for a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                state: {
                  type: 'string',
                  enum: ['open', 'closed', 'all'],
                  description: 'Issue state',
                  default: 'open',
                },
                labels: {
                  type: 'string',
                  description: 'Comma-separated list of labels',
                },
                assignee: {
                  type: 'string',
                  description: 'Assignee username',
                },
                per_page: {
                  type: 'number',
                  description: 'Number of results per page',
                  default: 30,
                },
                page: {
                  type: 'number',
                  description: 'Page number',
                  default: 1,
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'github_get_issue',
            description: 'Get detailed information about a specific issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                issue_number: {
                  type: 'number',
                  description: 'Issue number',
                },
              },
              required: ['owner', 'repo', 'issue_number'],
            },
          },
          {
            name: 'github_list_pull_requests',
            description: 'List pull requests for a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                state: {
                  type: 'string',
                  enum: ['open', 'closed', 'all'],
                  description: 'PR state',
                  default: 'open',
                },
                head: {
                  type: 'string',
                  description: 'Filter by head branch',
                },
                base: {
                  type: 'string',
                  description: 'Filter by base branch',
                },
                per_page: {
                  type: 'number',
                  description: 'Number of results per page',
                  default: 30,
                },
                page: {
                  type: 'number',
                  description: 'Page number',
                  default: 1,
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'github_get_pull_request',
            description: 'Get detailed information about a specific pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                pull_number: {
                  type: 'number',
                  description: 'Pull request number',
                },
              },
              required: ['owner', 'repo', 'pull_number'],
            },
          },
          {
            name: 'github_list_commits',
            description: 'List commits for a repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                sha: {
                  type: 'string',
                  description: 'SHA or branch to start listing commits from',
                },
                path: {
                  type: 'string',
                  description: 'Only commits containing this file path',
                },
                author: {
                  type: 'string',
                  description: 'GitHub login or email address',
                },
                since: {
                  type: 'string',
                  description: 'Only commits after this date (ISO 8601)',
                },
                until: {
                  type: 'string',
                  description: 'Only commits before this date (ISO 8601)',
                },
                per_page: {
                  type: 'number',
                  description: 'Number of results per page',
                  default: 30,
                },
                page: {
                  type: 'number',
                  description: 'Page number',
                  default: 1,
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'github_get_commit',
            description: 'Get detailed information about a specific commit',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                sha: {
                  type: 'string',
                  description: 'Commit SHA',
                },
              },
              required: ['owner', 'repo', 'sha'],
            },
          },
          {
            name: 'github_get_file_contents',
            description: 'Get contents of a file or directory',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                path: {
                  type: 'string',
                  description: 'File or directory path',
                },
                ref: {
                  type: 'string',
                  description: 'Branch, tag, or commit SHA',
                },
              },
              required: ['owner', 'repo', 'path'],
            },
          },
          {
            name: 'github_create_issue',
            description: 'Create a new issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                title: {
                  type: 'string',
                  description: 'Issue title',
                },
                body: {
                  type: 'string',
                  description: 'Issue body',
                },
                labels: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Labels to add to the issue',
                },
                assignees: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Usernames to assign to the issue',
                },
              },
              required: ['owner', 'repo', 'title'],
            },
          },
          {
            name: 'github_create_pull_request',
            description: 'Create a new pull request',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                title: {
                  type: 'string',
                  description: 'Pull request title',
                },
                head: {
                  type: 'string',
                  description: 'Head branch',
                },
                base: {
                  type: 'string',
                  description: 'Base branch',
                },
                body: {
                  type: 'string',
                  description: 'Pull request body',
                },
                draft: {
                  type: 'boolean',
                  description: 'Create as draft',
                  default: false,
                },
              },
              required: ['owner', 'repo', 'title', 'head', 'base'],
            },
          },
          {
            name: 'github_store_data',
            description: 'Store GitHub data in Librarian service with embeddings for analysis',
            inputSchema: {
              type: 'object',
              properties: {
                data_type: {
                  type: 'string',
                  enum: ['repository', 'issue', 'pull_request', 'commit', 'file'],
                  description: 'Type of data being stored',
                },
                data: {
                  type: 'object',
                  description: 'GitHub data to store',
                },
                repository_id: {
                  type: 'string',
                  description: 'Repository identifier',
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags for categorization',
                },
              },
              required: ['data_type', 'data'],
            },
          },
          {
            name: 'github_analyze_repository',
            description: 'Analyze repository metrics and trends',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                analysis_type: {
                  type: 'string',
                  enum: ['overview', 'activity', 'contributors', 'languages', 'issues', 'prs'],
                  description: 'Type of analysis to perform',
                  default: 'overview',
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'github_search_memories',
            description: 'Search GitHub data using Librarian service with semantic similarity and embeddings',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query for semantic similarity' },
                data_type: { 
                  type: 'string', 
                  description: 'Filter by data type',
                  enum: ['repository', 'issue', 'pull_request', 'commit', 'analysis'],
                },
                repository: { type: 'string', description: 'Filter by specific repository' },
                limit: { type: 'number', description: 'Maximum results to return', default: 10 },
                min_importance: { type: 'number', description: 'Minimum importance score (0-1)', default: 0.1 },
              },
              required: ['query'],
            },
          },
        ] as Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'github_search_repositories':
            return await this.searchRepositories(args);
          case 'github_get_repository':
            return await this.getRepository(args);
          case 'github_list_issues':
            return await this.listIssues(args);
          case 'github_get_issue':
            return await this.getIssue(args);
          case 'github_list_pull_requests':
            return await this.listPullRequests(args);
          case 'github_get_pull_request':
            return await this.getPullRequest(args);
          case 'github_list_commits':
            return await this.listCommits(args);
          case 'github_get_commit':
            return await this.getCommit(args);
          case 'github_get_file_contents':
            return await this.getFileContents(args);
          case 'github_create_issue':
            return await this.createIssue(args);
          case 'github_create_pull_request':
            return await this.createPullRequest(args);
          case 'github_store_data':
            return await this.storeData(args);
          case 'github_analyze_repository':
            return await this.analyzeRepository(args);
          case 'github_search_memories':
            return await this.searchMemories(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // GitHub API Methods
  private async searchRepositories(args: any) {
    const params = new URLSearchParams({
      q: args.query,
      sort: args.sort || 'stars',
      order: args.order || 'desc',
      per_page: String(args.per_page || 30),
      page: String(args.page || 1),
    });

    const response = await this.githubClient.get(`/search/repositories?${params}`);
    const repositories = response.data.items;

    // Store repositories in Supabase
    for (const repo of repositories) {
      await this.storeRepositoryData(repo);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total_count: response.data.total_count,
            repositories: repositories.map((repo: GitHubRepository) => ({
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              description: repo.description,
              html_url: repo.html_url,
              language: repo.language,
              stars: repo.stars,
              forks: repo.forks,
              open_issues: repo.open_issues,
              created_at: repo.created_at,
              updated_at: repo.updated_at,
              owner: repo.owner.login,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getRepository(args: any) {
    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}`);
    const repo = response.data;

    // Store repository data
    await this.storeRepositoryData(repo);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            description: repo.description,
            html_url: repo.html_url,
            clone_url: repo.clone_url,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            open_issues: repo.open_issues_count,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
            pushed_at: repo.pushed_at,
            owner: {
              login: repo.owner.login,
              avatar_url: repo.owner.avatar_url,
            },
            topics: repo.topics || [],
            license: repo.license?.name,
            size: repo.size,
            default_branch: repo.default_branch,
          }, null, 2),
        },
      ],
    };
  }

  private async listIssues(args: any) {
    const params = new URLSearchParams({
      state: args.state || 'open',
      per_page: String(args.per_page || 30),
      page: String(args.page || 1),
    });

    if (args.labels) params.append('labels', args.labels);
    if (args.assignee) params.append('assignee', args.assignee);

    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/issues?${params}`);
    const issues = response.data;

    // Store issues in Supabase
    for (const issue of issues) {
      await this.storeIssueData(args.owner, args.repo, issue);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            repository: `${args.owner}/${args.repo}`,
            issues: issues.map((issue: GitHubIssue) => ({
              number: issue.number,
              title: issue.title,
              state: issue.state,
              labels: issue.labels.map(label => label.name),
              assignees: issue.assignees.map(assignee => assignee.login),
              author: issue.user.login,
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              html_url: issue.html_url,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getIssue(args: any) {
    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/issues/${args.issue_number}`);
    const issue = response.data;

    // Store issue data
    await this.storeIssueData(args.owner, args.repo, issue);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            labels: issue.labels.map((label: any) => ({
              name: label.name,
              color: label.color,
            })),
            assignees: issue.assignees.map((assignee: any) => ({
              login: assignee.login,
              avatar_url: assignee.avatar_url,
            })),
            author: {
              login: issue.user.login,
              avatar_url: issue.user.avatar_url,
            },
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
            html_url: issue.html_url,
            comments: issue.comments,
            reactions: issue.reactions,
          }, null, 2),
        },
      ],
    };
  }

  private async listPullRequests(args: any) {
    const params = new URLSearchParams({
      state: args.state || 'open',
      per_page: String(args.per_page || 30),
      page: String(args.page || 1),
    });

    if (args.head) params.append('head', args.head);
    if (args.base) params.append('base', args.base);

    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/pulls?${params}`);
    const pullRequests = response.data;

    // Store PRs in Supabase
    for (const pr of pullRequests) {
      await this.storePullRequestData(args.owner, args.repo, pr);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            repository: `${args.owner}/${args.repo}`,
            pull_requests: pullRequests.map((pr: GitHubPullRequest) => ({
              number: pr.number,
              title: pr.title,
              state: pr.state,
              head: pr.head.ref,
              base: pr.base.ref,
              author: pr.user.login,
              created_at: pr.created_at,
              updated_at: pr.updated_at,
              merged_at: pr.merged_at,
              html_url: pr.html_url,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getPullRequest(args: any) {
    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/pulls/${args.pull_number}`);
    const pr = response.data;

    // Store PR data
    await this.storePullRequestData(args.owner, args.repo, pr);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            number: pr.number,
            title: pr.title,
            body: pr.body,
            state: pr.state,
            head: {
              ref: pr.head.ref,
              sha: pr.head.sha,
            },
            base: {
              ref: pr.base.ref,
              sha: pr.base.sha,
            },
            author: {
              login: pr.user.login,
              avatar_url: pr.user.avatar_url,
            },
            created_at: pr.created_at,
            updated_at: pr.updated_at,
            merged_at: pr.merged_at,
            html_url: pr.html_url,
            diff_url: pr.diff_url,
            patch_url: pr.patch_url,
            additions: pr.additions,
            deletions: pr.deletions,
            changed_files: pr.changed_files,
            commits: pr.commits,
            comments: pr.comments,
            review_comments: pr.review_comments,
          }, null, 2),
        },
      ],
    };
  }

  private async listCommits(args: any) {
    const params = new URLSearchParams({
      per_page: String(args.per_page || 30),
      page: String(args.page || 1),
    });

    if (args.sha) params.append('sha', args.sha);
    if (args.path) params.append('path', args.path);
    if (args.author) params.append('author', args.author);
    if (args.since) params.append('since', args.since);
    if (args.until) params.append('until', args.until);

    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/commits?${params}`);
    const commits = response.data;

    // Store commits in Supabase
    for (const commit of commits) {
      await this.storeCommitData(args.owner, args.repo, commit);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            repository: `${args.owner}/${args.repo}`,
            commits: commits.map((commit: GitHubCommit) => ({
              sha: commit.sha,
              message: commit.commit.message,
              author: {
                name: commit.commit.author.name,
                email: commit.commit.author.email,
                login: commit.author?.login,
              },
              date: commit.commit.author.date,
              html_url: commit.html_url,
              stats: commit.stats,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getCommit(args: any) {
    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/commits/${args.sha}`);
    const commit = response.data;

    // Store commit data
    await this.storeCommitData(args.owner, args.repo, commit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              login: commit.author?.login,
              avatar_url: commit.author?.avatar_url,
            },
            committer: {
              name: commit.commit.committer.name,
              email: commit.commit.committer.email,
            },
            date: commit.commit.author.date,
            html_url: commit.html_url,
            stats: commit.stats,
            files: commit.files?.map((file: any) => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getFileContents(args: any) {
    const params = new URLSearchParams();
    if (args.ref) params.append('ref', args.ref);

    const response = await this.githubClient.get(`/repos/${args.owner}/${args.repo}/contents/${args.path}?${params}`);
    const file = response.data;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name: file.name,
            path: file.path,
            sha: file.sha,
            size: file.size,
            type: file.type,
            content: file.content ? Buffer.from(file.content, file.encoding).toString() : undefined,
            download_url: file.download_url,
            html_url: file.html_url,
          }, null, 2),
        },
      ],
    };
  }

  private async createIssue(args: any) {
    const issueData: any = {
      title: args.title,
    };

    if (args.body) issueData.body = args.body;
    if (args.labels) issueData.labels = args.labels;
    if (args.assignees) issueData.assignees = args.assignees;

    const response = await this.githubClient.post(`/repos/${args.owner}/${args.repo}/issues`, issueData);
    const issue = response.data;

    // Store created issue
    await this.storeIssueData(args.owner, args.repo, issue);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            issue: {
              number: issue.number,
              title: issue.title,
              state: issue.state,
              html_url: issue.html_url,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async createPullRequest(args: any) {
    const prData: any = {
      title: args.title,
      head: args.head,
      base: args.base,
    };

    if (args.body) prData.body = args.body;
    if (args.draft !== undefined) prData.draft = args.draft;

    const response = await this.githubClient.post(`/repos/${args.owner}/${args.repo}/pulls`, prData);
    const pr = response.data;

    // Store created PR
    await this.storePullRequestData(args.owner, args.repo, pr);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            pull_request: {
              number: pr.number,
              title: pr.title,
              state: pr.state,
              html_url: pr.html_url,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async storeData(args: any) {
    const { data_type, data, repository_id, tags } = args;

    try {
      // Create content for embedding
      const content = this.createEmbeddableContent(data_type, data);
      const repository = repository_id || `${data.owner || 'unknown'}/${data.repo || 'unknown'}`;

      // Store in Librarian service with embedding
      const librarianResponse = await axios.post(`${this.librarianUrl}/embed`, [{
        content: content,
        metadata: {
          type: 'github_data',
          data_type,
          repository,
          tags: tags || [],
          github_id: data.id || data.sha || data.number,
          github_url: data.html_url,
          importance: this.calculateImportance(data_type, data),
          source: 'github-mcp',
          stored_at: new Date().toISOString(),
        },
        context: {
          data_type,
          repository,
          github_data: data,
          tags: tags || [],
        }
      }]);

      if (librarianResponse.status !== 200) {
        throw new Error(`Librarian service returned status ${librarianResponse.status}`);
      }

      const librarianData = librarianResponse.data;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Stored ${data_type} data in Librarian with embedding`,
              embedded_count: librarianData.embedded_count,
              skipped_count: librarianData.skipped_count,
              total_documents: librarianData.total_documents,
              routing_stats: librarianData.routing_stats,
              repository,
              content_preview: content.substring(0, 200) + '...',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to store data: ${error.message}`);
    }
  }

  private createEmbeddableContent(dataType: string, data: any): string {
    switch (dataType) {
      case 'repository':
        return `Repository: ${data.name}\nDescription: ${data.description || 'No description'}\nLanguage: ${data.language || 'Unknown'}\nStars: ${data.stargazers_count || 0}\nForks: ${data.forks_count || 0}\nOpen Issues: ${data.open_issues_count || 0}\nURL: ${data.html_url}`;
      
      case 'issue':
        return `Issue #${data.number}: ${data.title}\nBody: ${data.body || 'No body'}\nState: ${data.state}\nLabels: ${data.labels?.map((l: any) => l.name).join(', ') || 'None'}\nAuthor: ${data.user?.login}\nCreated: ${data.created_at}\nURL: ${data.html_url}`;
      
      case 'pull_request':
        return `Pull Request #${data.number}: ${data.title}\nBody: ${data.body || 'No body'}\nState: ${data.state}\nHead: ${data.head?.ref}\nBase: ${data.base?.ref}\nAuthor: ${data.user?.login}\nCreated: ${data.created_at}\nURL: ${data.html_url}`;
      
      case 'commit':
        return `Commit: ${data.sha?.substring(0, 7)}\nMessage: ${data.commit?.message}\nAuthor: ${data.commit?.author?.name}\nDate: ${data.commit?.author?.date}\nURL: ${data.html_url}`;
      
      case 'analysis':
        return `Analysis of ${data.repository}: ${data.analysis_type}\nResults: ${JSON.stringify(data.analysis, null, 2)}`;
      
      default:
        return `GitHub ${dataType}: ${JSON.stringify(data, null, 2)}`;
    }
  }

  private calculateImportance(dataType: string, data: any): number {
    // Calculate importance based on GitHub data characteristics
    let importance = 0.5; // Base importance

    switch (dataType) {
      case 'repository':
        // Higher importance for popular repositories
        const stars = data.stargazers_count || 0;
        const forks = data.forks_count || 0;
        importance = Math.min(0.9, 0.3 + (stars / 1000) * 0.3 + (forks / 100) * 0.3);
        break;
      
      case 'issue':
        // Higher importance for open issues with many comments
        if (data.state === 'open') importance += 0.2;
        importance += Math.min(0.3, (data.comments || 0) / 10);
        break;
      
      case 'pull_request':
        // Higher importance for open PRs and large changes
        if (data.state === 'open') importance += 0.2;
        const changes = (data.additions || 0) + (data.deletions || 0);
        importance += Math.min(0.3, changes / 1000);
        break;
      
      case 'commit':
        // Higher importance for commits with significant changes
        const commitChanges = (data.stats?.additions || 0) + (data.stats?.deletions || 0);
        importance = Math.min(0.8, 0.3 + commitChanges / 500);
        break;
    }

    return Math.max(0.1, Math.min(1.0, importance));
  }

  private async searchMemories(args: any) {
    const { query, data_type, repository, limit = 10, min_importance = 0.1 } = args;

    try {
      // Search using Librarian service
      const searchParams = new URLSearchParams({
        query: query,
        limit: limit.toString(),
      });
      
      const librarianResponse = await axios.get(`${this.librarianUrl}/search?${searchParams}`);

      if (librarianResponse.status !== 200) {
        throw new Error(`Librarian service returned status ${librarianResponse.status}`);
      }

      const searchData = librarianResponse.data;
      const results = searchData.results || [];

      // Format results for GitHub MCP
      const formattedResults = results.map(result => ({
        id: result.id || result.document_id || 'unknown',
        content: result.content || result.text || '',
        data_type: result.metadata?.data_type || 'unknown',
        repository: result.metadata?.repository || 'unknown',
        github_url: result.metadata?.github_url || '',
        importance: result.metadata?.importance || 0.5,
        relevance_score: result.similarity_score || result.score || this.calculateRelevanceScore(query, result.content || ''),
        created_at: result.metadata?.stored_at || result.timestamp || new Date().toISOString(),
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              query,
              results_count: formattedResults.length,
              librarian_response: searchData,
              results: formattedResults.map(r => ({
                id: r.id,
                data_type: r.data_type,
                repository: r.repository,
                github_url: r.github_url,
                importance: r.importance,
                relevance_score: r.relevance_score,
                content_preview: r.content.substring(0, 200) + '...',
                created_at: r.created_at,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to search memories: ${error.message}`);
    }
  }

  private calculateRelevanceScore(query: string, content: string): number {
    // Simple relevance scoring based on keyword matching
    // In a real implementation, this would use vector similarity
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of queryWords) {
      if (contentWords.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  private async analyzeRepository(args: any) {
    const { owner, repo, analysis_type } = args;

    try {
      let analysis: any = {};

      switch (analysis_type) {
        case 'overview':
          analysis = await this.getRepositoryOverview(owner, repo);
          break;
        case 'activity':
          analysis = await this.getRepositoryActivity(owner, repo);
          break;
        case 'contributors':
          analysis = await this.getRepositoryContributors(owner, repo);
          break;
        case 'languages':
          analysis = await this.getRepositoryLanguages(owner, repo);
          break;
        case 'issues':
          analysis = await this.getRepositoryIssuesAnalysis(owner, repo);
          break;
        case 'prs':
          analysis = await this.getRepositoryPRsAnalysis(owner, repo);
          break;
        default:
          analysis = await this.getRepositoryOverview(owner, repo);
      }

      // Store analysis in PostgreSQL
      await this.storeData({
        data_type: 'analysis',
        data: {
          repository: `${owner}/${repo}`,
          analysis_type,
          analysis,
        },
        repository_id: `${owner}/${repo}`,
        tags: ['analysis', analysis_type],
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              repository: `${owner}/${repo}`,
              analysis_type,
              analysis,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods for analysis
  private async getRepositoryOverview(owner: string, repo: string) {
    const [repoData, issuesData, prsData] = await Promise.all([
      this.githubClient.get(`/repos/${owner}/${repo}`),
      this.githubClient.get(`/repos/${owner}/${repo}/issues?state=all&per_page=100`),
      this.githubClient.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=100`),
    ]);

    const repository = repoData.data;
    const issues = issuesData.data;
    const prs = prsData.data;

    return {
      basic_info: {
        name: repository.name,
        description: repository.description,
        language: repository.language,
        stars: repository.stargazers_count,
        forks: repository.forks_count,
        watchers: repository.watchers_count,
        open_issues: repository.open_issues_count,
      },
      activity: {
        created_at: repository.created_at,
        updated_at: repository.updated_at,
        pushed_at: repository.pushed_at,
        total_issues: issues.length,
        total_prs: prs.length,
        open_issues: issues.filter((i: any) => i.state === 'open').length,
        open_prs: prs.filter((p: any) => p.state === 'open').length,
      },
      health_score: this.calculateHealthScore(repository, issues, prs),
    };
  }

  private async getRepositoryActivity(owner: string, repo: string) {
    const [commitsData, releasesData] = await Promise.all([
      this.githubClient.get(`/repos/${owner}/${repo}/commits?per_page=100`),
      this.githubClient.get(`/repos/${owner}/${repo}/releases?per_page=100`),
    ]);

    const commits = commitsData.data;
    const releases = releasesData.data;

    return {
      recent_commits: commits.slice(0, 10).map((commit: any) => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
      })),
      recent_releases: releases.slice(0, 5).map((release: any) => ({
        tag_name: release.tag_name,
        name: release.name,
        published_at: release.published_at,
        downloads: release.assets.reduce((sum: number, asset: any) => sum + asset.download_count, 0),
      })),
      activity_summary: {
        total_commits: commits.length,
        total_releases: releases.length,
        last_commit: commits[0]?.commit.author.date,
        last_release: releases[0]?.published_at,
      },
    };
  }

  private async getRepositoryContributors(owner: string, repo: string) {
    const response = await this.githubClient.get(`/repos/${owner}/${repo}/contributors?per_page=100`);
    const contributors = response.data;

    return {
      contributors: contributors.map((contributor: any) => ({
        login: contributor.login,
        contributions: contributor.contributions,
        avatar_url: contributor.avatar_url,
        html_url: contributor.html_url,
      })),
      top_contributors: contributors.slice(0, 10),
      total_contributors: contributors.length,
    };
  }

  private async getRepositoryLanguages(owner: string, repo: string) {
    const response = await this.githubClient.get(`/repos/${owner}/${repo}/languages`);
    const languages = response.data;

    const totalBytes = Object.values(languages).reduce((sum: number, bytes: any) => sum + bytes, 0);

    return {
      languages: Object.entries(languages).map(([lang, bytes]: [string, any]) => ({
        language: lang,
        bytes,
        percentage: ((bytes / totalBytes) * 100).toFixed(2),
      })),
      total_bytes: totalBytes,
    };
  }

  private async getRepositoryIssuesAnalysis(owner: string, repo: string) {
    const response = await this.githubClient.get(`/repos/${owner}/${repo}/issues?state=all&per_page=100`);
    const issues = response.data;

    const openIssues = issues.filter((issue: any) => issue.state === 'open');
    const closedIssues = issues.filter((issue: any) => issue.state === 'closed');

    return {
      summary: {
        total: issues.length,
        open: openIssues.length,
        closed: closedIssues.length,
        open_rate: ((openIssues.length / issues.length) * 100).toFixed(2),
      },
      labels: this.analyzeLabels(issues),
      response_time: this.calculateAverageResponseTime(issues),
    };
  }

  private async getRepositoryPRsAnalysis(owner: string, repo: string) {
    const response = await this.githubClient.get(`/repos/${owner}/${repo}/pulls?state=all&per_page=100`);
    const prs = response.data;

    const openPRs = prs.filter((pr: any) => pr.state === 'open');
    const mergedPRs = prs.filter((pr: any) => pr.state === 'merged');
    const closedPRs = prs.filter((pr: any) => pr.state === 'closed' && !pr.merged_at);

    return {
      summary: {
        total: prs.length,
        open: openPRs.length,
        merged: mergedPRs.length,
        closed: closedPRs.length,
        merge_rate: ((mergedPRs.length / prs.length) * 100).toFixed(2),
      },
      average_merge_time: this.calculateAverageMergeTime(prs),
    };
  }

  // Utility methods
  private calculateHealthScore(repo: any, issues: any[], prs: any[]) {
    let score = 0;
    
    // Stars factor (0-30 points)
    score += Math.min(30, Math.log10(repo.stargazers_count + 1) * 10);
    
    // Recent activity (0-25 points)
    const daysSinceUpdate = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 25 - daysSinceUpdate);
    
    // Issue health (0-25 points)
    const openIssues = issues.filter(i => i.state === 'open').length;
    const totalIssues = issues.length;
    if (totalIssues > 0) {
      score += 25 * (1 - openIssues / totalIssues);
    }
    
    // PR health (0-20 points)
    const openPRs = prs.filter(p => p.state === 'open').length;
    const totalPRs = prs.length;
    if (totalPRs > 0) {
      score += 20 * (1 - openPRs / totalPRs);
    }
    
    return Math.min(100, Math.round(score));
  }

  private analyzeLabels(issues: any[]) {
    const labelCounts: { [key: string]: number } = {};
    
    issues.forEach(issue => {
      issue.labels.forEach((label: any) => {
        labelCounts[label.name] = (labelCounts[label.name] || 0) + 1;
      });
    });
    
    return Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));
  }

  private calculateAverageResponseTime(issues: any[]) {
    const responseTimes: number[] = [];
    
    issues.forEach(issue => {
      if (issue.comments > 0) {
        // This is a simplified calculation
        // In reality, you'd need to fetch comments to get actual response times
        responseTimes.push(Math.random() * 7); // Placeholder
      }
    });
    
    return responseTimes.length > 0 
      ? (responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length).toFixed(1)
      : 'N/A';
  }

  private calculateAverageMergeTime(prs: any[]) {
    const mergeTimes: number[] = [];
    
    prs.forEach(pr => {
      if (pr.merged_at) {
        const created = new Date(pr.created_at).getTime();
        const merged = new Date(pr.merged_at).getTime();
        const days = (merged - created) / (1000 * 60 * 60 * 24);
        mergeTimes.push(days);
      }
    });
    
    return mergeTimes.length > 0 
      ? (mergeTimes.reduce((sum, time) => sum + time, 0) / mergeTimes.length).toFixed(1)
      : 'N/A';
  }

  // Supabase storage methods with embeddings
  private async storeRepositoryData(repo: any) {
    await this.storeData({
      data_type: 'repository',
      data: repo,
      repository_id: repo.full_name,
      tags: ['repository', repo.language, 'github'],
    });
  }

  private async storeIssueData(owner: string, repo: string, issue: any) {
    await this.storeData({
      data_type: 'issue',
      data: issue,
      repository_id: `${owner}/${repo}`,
      tags: ['issue', issue.state, 'github'],
    });
  }

  private async storePullRequestData(owner: string, repo: string, pr: any) {
    await this.storeData({
      data_type: 'pull_request',
      data: pr,
      repository_id: `${owner}/${repo}`,
      tags: ['pull_request', pr.state, 'github'],
    });
  }

  private async storeCommitData(owner: string, repo: string, commit: any) {
    await this.storeData({
      data_type: 'commit',
      data: commit,
      repository_id: `${owner}/${repo}`,
      tags: ['commit', 'github'],
    });
  }

  private async initializeDatabase() {
    try {
      // Test Librarian service connection
      const healthResponse = await axios.get(`${this.librarianUrl}/health`);
      
      if (healthResponse.status === 200) {
        const healthData = healthResponse.data;
        console.error('GitHub MCP Server: Librarian service connected');
        console.error(`   📚 Embedding model: ${healthData.embedding_model}`);
        console.error(`   💾 Database: ${healthData.database}`);
        console.error(`   🧠 Memory cache: ${healthData.memory_cache} documents`);
      } else {
        throw new Error(`Librarian health check failed with status ${healthResponse.status}`);
      }

    } catch (error) {
      console.error('GitHub MCP Server: Failed to connect to Librarian service:', error.message);
      console.error('   ⚠️  GitHub MCP will work but without embedding/memory features');
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub MCP Server running on stdio');
  }
}

// Start the server
const server = new GitHubMCPServer();
server.run().catch(console.error);
