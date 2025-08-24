#!/usr/bin/env node

/**
 * Universal AI Tools MCP Server
 * Provides access to Universal AI Tools functionality via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

class UniversalAIToolsMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'universal-ai-tools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_agent_status',
            description: 'Get the status of AI agents in the system',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  description: 'Optional agent ID to get specific agent status',
                },
              },
            },
          },
          {
            name: 'list_chat_sessions',
            description: 'List chat sessions from the database',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of sessions to return',
                  default: 10,
                },
                userId: {
                  type: 'string',
                  description: 'Optional user ID to filter sessions',
                },
              },
            },
          },
          {
            name: 'get_user_feedback',
            description: 'Get user feedback from the database',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of feedback entries to return',
                  default: 20,
                },
                type: {
                  type: 'string',
                  description: 'Filter by feedback type',
                },
              },
            },
          },
          {
            name: 'get_system_health',
            description: 'Get the current system health status',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'run_npm_command',
            description: 'Run npm commands in the project',
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'The npm command to run (e.g., "dev", "build", "test")',
                },
                args: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Additional arguments for the command',
                  default: [],
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'get_project_structure',
            description: 'Get the project structure and key files',
            inputSchema: {
              type: 'object',
              properties: {
                depth: {
                  type: 'number',
                  description: 'Maximum depth to traverse',
                  default: 3,
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_agent_status':
            return await this.getAgentStatus(args.agentId);

          case 'list_chat_sessions':
            return await this.listChatSessions(args.limit, args.userId);

          case 'get_user_feedback':
            return await this.getUserFeedback(args.limit, args.type);

          case 'get_system_health':
            return await this.getSystemHealth();

          case 'run_npm_command':
            return await this.runNpmCommand(args.command, args.args);

          case 'get_project_structure':
            return await this.getProjectStructure(args.depth);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async getAgentStatus(agentId) {
    if (!supabase) {
      return {
        content: [
          {
            type: 'text',
            text: 'Supabase not configured. Agent status unavailable.',
          },
        ],
      };
    }

    try {
      let query = supabase.from('agents').select('*');
      
      if (agentId) {
        query = query.eq('id', agentId);
      }

      const { data, error } = await query.limit(10);

      if (error) throw error;

      return {
        content: [
          {
            type: 'text',
            text: `Agent Status:\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting agent status: ${error.message}`,
          },
        ],
      };
    }
  }

  async listChatSessions(limit = 10, userId) {
    if (!supabase) {
      return {
        content: [
          {
            type: 'text',
            text: 'Supabase not configured. Chat sessions unavailable.',
          },
        ],
      };
    }

    try {
      let query = supabase
        .from('chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.limit(limit);

      if (error) throw error;

      return {
        content: [
          {
            type: 'text',
            text: `Chat Sessions (${data.length}):\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing chat sessions: ${error.message}`,
          },
        ],
      };
    }
  }

  async getUserFeedback(limit = 20, type) {
    if (!supabase) {
      return {
        content: [
          {
            type: 'text',
            text: 'Supabase not configured. User feedback unavailable.',
          },
        ],
      };
    }

    try {
      let query = supabase
        .from('user_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query.limit(limit);

      if (error) throw error;

      return {
        content: [
          {
            type: 'text',
            text: `User Feedback (${data.length} entries):\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting user feedback: ${error.message}`,
          },
        ],
      };
    }
  }

  async getSystemHealth() {
    const projectRoot = '/Users/christianmerrill/Desktop/universal-ai-tools';
    
    try {
      // Check if services are running
      const health = {
        timestamp: new Date().toISOString(),
        supabase: !!supabase,
        projectExists: existsSync(projectRoot),
        nodeModulesExists: existsSync(join(projectRoot, 'node_modules')),
        packageJsonExists: existsSync(join(projectRoot, 'package.json')),
      };

      // Try to read package.json
      if (health.packageJsonExists) {
        const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
        health.projectName = packageJson.name;
        health.version = packageJson.version;
        health.scripts = Object.keys(packageJson.scripts || {});
      }

      return {
        content: [
          {
            type: 'text',
            text: `System Health Status:\n${JSON.stringify(health, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error checking system health: ${error.message}`,
          },
        ],
      };
    }
  }

  async runNpmCommand(command, args = []) {
    const projectRoot = '/Users/christianmerrill/Desktop/universal-ai-tools';
    
    return new Promise((resolve) => {
      const npmArgs = [command, ...args];
      const child = spawn('npm', npmArgs, {
        cwd: projectRoot,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          content: [
            {
              type: 'text',
              text: `npm ${command} completed with code ${code}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`,
            },
          ],
        });
      });

      child.on('error', (error) => {
        resolve({
          content: [
            {
              type: 'text',
              text: `Error running npm ${command}: ${error.message}`,
            },
          ],
        });
      });

      // Kill after 30 seconds to prevent hanging
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          resolve({
            content: [
              {
                type: 'text',
                text: `npm ${command} timed out after 30 seconds`,
              },
            ],
          });
        }
      }, 30000);
    });
  }

  async getProjectStructure(maxDepth = 3) {
    const projectRoot = '/Users/christianmerrill/Desktop/universal-ai-tools';
    
    const getStructure = (dir, currentDepth = 0) => {
      if (currentDepth >= maxDepth) return {};
      
      try {
        const { readdirSync, statSync } = require('fs');
        const items = readdirSync(dir);
        const structure = {};
        
        for (const item of items) {
          if (item.startsWith('.') && !item.startsWith('.env')) continue;
          if (item === 'node_modules') continue;
          if (item === 'dist') continue;
          if (item === 'build') continue;
          
          const fullPath = join(dir, item);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              structure[item + '/'] = getStructure(fullPath, currentDepth + 1);
            } else {
              structure[item] = stat.size;
            }
          } catch (e) {
            // Skip files we can't read
          }
        }
        
        return structure;
      } catch (error) {
        return { error: error.message };
      }
    };

    const structure = getStructure(projectRoot);

    return {
      content: [
        {
          type: 'text',
          text: `Project Structure (depth ${maxDepth}):\n${JSON.stringify(structure, null, 2)}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Universal AI Tools MCP server running on stdio');
  }
}

// Start the server
const server = new UniversalAIToolsMCPServer();
server.run().catch(console.error);