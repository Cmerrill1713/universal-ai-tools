#!/usr/bin/env node
/**
 * Universal AI Tools Supabase MCP Server
 * Provides context persistence and pattern learning for TypeScript error prevention
 */

import { Server  } from '@modelcontextprotocol/sdk/server/index.js';';
import { StdioServerTransport  } from '@modelcontextprotocol/sdk/server/stdio.js';';
import type {
  CallToolResult} from '@modelcontextprotocol/sdk/types.js';'
import { CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
 } from '@modelcontextprotocol/sdk/types.js';'
import type { SupabaseClient } from '@supabase/supabase-js';';
import { createClient  } from '@supabase/supabase-js';';
import { z  } from 'zod';';

interface ContextData {
  id?: string;
  content: string;,
  category: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  embedding?: number[];
}

interface CodePattern {
  id?: string;
  pattern_type: string;,
  before_code: string;
  after_code: string;,
  description: string;
  success_rate?: number;
  error_types: string[];
  metadata?: Record<string, unknown>;
}

interface TaskProgress {
  id?: string;
  task_id: string;,
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';'
  progress_percentage?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface ErrorAnalysis {
  id?: string;
  error_type: string;,
  error_message: string;
  file_path?: string;
  line_number?: number;
  solution_pattern?: string;
  frequency?: number;
  last_seen?: string;
  metadata?: Record<string, unknown>;
}

class SupabaseMCPServer {
  private server: Server;
  private supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required Supabase configuration');';
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize MCP server
    this.server = new Server()
      {
        name: 'supabase-universal-ai','
        version: '2.0.0','
      },
      {
        capabilities: {,
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  private setupToolHandlers(): void {
    // 1. Save Context Tool
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'save_context','
          description: 'Save project context, patterns, or knowledge to Supabase','
          inputSchema: {,
            type: 'object','
            properties: {,
              content: { type: 'string', description: 'The content to save' },'
              category: {, type: 'string', description: 'Category: project_overview, code_patterns, error_analysis, etc.' },'
              metadata: {, type: 'object', description: 'Additional metadata' },'
            },
            required: ['content', 'category'],'
          },
        },
        {
          name: 'search_context','
          description: 'Search saved context using semantic similarity','
          inputSchema: {,
            type: 'object','
            properties: {,
              query: { type: 'string', description: 'Search query' },'
              category: {, type: 'string', description: 'Filter by category (optional)' },'
              limit: {, type: 'number', description: 'Number of results (default: 10)' },'
            },
            required: ['query'],'
          },
        },
        {
          name: 'get_recent_context','
          description: 'Get recently saved context entries','
          inputSchema: {,
            type: 'object','
            properties: {,
              category: { type: 'string', description: 'Filter by category (optional)' },'
              limit: {, type: 'number', description: 'Number of results (default: 20)' },'
            },
          },
        },
        {
          name: 'save_code_pattern','
          description: 'Save a successful code fix pattern for future reference','
          inputSchema: {,
            type: 'object','
            properties: {,
              pattern_type: { type: 'string', description: 'Type of pattern (syntax_fix, type_annotation, etc.)' },'
              before_code: {, type: 'string', description: 'Code before the fix' },'
              after_code: {, type: 'string', description: 'Code after the fix' },'
              description: {, type: 'string', description: 'Description of what the pattern fixes' },'
              error_types: {, type: 'array', items: {, type: 'string' }, description: 'Types of errors this pattern addresses' },'
              metadata: {, type: 'object', description: 'Additional metadata' },'
            },
            required: ['pattern_type', 'before_code', 'after_code', 'description', 'error_types'],'
          },
        },
        {
          name: 'get_code_patterns','
          description: 'Retrieve code patterns for similar errors or situations','
          inputSchema: {,
            type: 'object','
            properties: {,
              error_type: { type: 'string', description: 'Type of error to find patterns for' },'
              pattern_type: {, type: 'string', description: 'Type of pattern to search for' },'
              limit: {, type: 'number', description: 'Number of patterns to return (default: 10)' },'
            },
          },
        },
        {
          name: 'save_task_progress','
          description: 'Save or update task progress information','
          inputSchema: {,
            type: 'object','
            properties: {,
              task_id: { type: 'string', description: 'Unique task identifier' },'
              description: {, type: 'string', description: 'Task description' },'
              status: {, type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], description: 'Task status' },'
              progress_percentage: {, type: 'number', description: 'Progress percentage (0-100)' },'
              metadata: {, type: 'object', description: 'Additional task metadata' },'
            },
            required: ['task_id', 'description', 'status'],'
          },
        },
        {
          name: 'get_task_history','
          description: 'Get task history and progress information','
          inputSchema: {,
            type: 'object','
            properties: {,
              task_id: { type: 'string', description: 'Specific task ID (optional)' },'
              status: {, type: 'string', description: 'Filter by status (optional)' },'
              limit: {, type: 'number', description: 'Number of results (default: 50)' },'
            },
          },
        },
        {
          name: 'analyze_errors','
          description: 'Analyze and store TypeScript error patterns','
          inputSchema: {,
            type: 'object','
            properties: {,
              error_type: { type: 'string', description: 'Type of error (TS2345, syntax, etc.)' },'
              error_message: {, type: 'string', description: 'Full error message' },'
              file_path: {, type: 'string', description: 'File where error occurred' },'
              line_number: {, type: 'number', description: 'Line number of error' },'
              solution_pattern: {, type: 'string', description: 'Pattern or solution that fixed this error' },'
              metadata: {, type: 'object', description: 'Additional error context' },'
            },
            required: ['error_type', 'error_message'],'
          },
        }],
    }));

    // Tool call handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'save_context':'
            return await this.saveContext(args as ContextData);
          case 'search_context':'
            return await this.searchContext(args as { query: string; category?: string; limit?: number });
          case 'get_recent_context':'
            return await this.getRecentContext(args as { category?: string; limit?: number });
          case 'save_code_pattern':'
            return await this.saveCodePattern(args as CodePattern);
          case 'get_code_patterns':'
            return await this.getCodePatterns(args as { error_type?: string; pattern_type?: string; limit?: number });
          case 'save_task_progress':'
            return await this.saveTaskProgress(args as TaskProgress);
          case 'get_task_history':'
            return await this.getTaskHistory(args as { task_id?: string; status?: string; limit?: number });
          case 'analyze_errors':'
            return await this.analyzeErrors(args as ErrorAnalysis);
          default: throw new Error(`Unknown, tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message: String(error);
        return {
          content: [
            {
              type: 'text','
              text: `Error: ${errorMessage}`,
            }],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'supabase://context','
          name: 'Project Context','
          description: 'Access to stored project context and patterns','
          mimeType: 'application/json','
        },
        {
          uri: 'supabase://patterns','
          name: 'Code Patterns','
          description: 'Successful code fix patterns','
          mimeType: 'application/json','
        },
        {
          uri: 'supabase://tasks','
          name: 'Task Progress','
          description: 'Task tracking and progress information','
          mimeType: 'application/json','
        },
        {
          uri: 'supabase://errors','
          name: 'Error Analysis','
          description: 'TypeScript error patterns and solutions','
          mimeType: 'application/json','
        }],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'supabase: //context':'
          return await this.getContextResource();
        case 'supabase: //patterns':'
          return await this.getPatternsResource();
        case 'supabase: //tasks':'
          return await this.getTasksResource();
        case 'supabase: //errors':'
          return await this.getErrorsResource();
        default: throw new Error(`Unknown, resource: ${uri}`);
      }
    });
  }

  // Tool implementations
  private async saveContext(data: ContextData): Promise<CallToolResult> {
    const { error } = await this.supabase;
      .from('mcp_context')'
      .insert({)
        content: data.content,
        category: data.category,
        metadata: data.metadata || {},
        timestamp: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save context: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: `Successfully saved context in, category: ${data.category}`,
        }],
    };
  }

  private async searchContext(params: {, query: string; category?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase;
      .from('mcp_context')'
      .select('*')'
      .order('timestamp', { ascending: false })'
      .limit(params.limit || 10);

    if (params.category) {
      query = query.eq('category', params.category);'
    }

    // Basic text search (in a real implementation, you'd use vector similarity)'
    query = query.ilike('content', `%${params.query}%`);'

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search context: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: JSON.stringify({, results: data || [], count: data?.length || 0 }, null, 2),
        }],
    };
  }

  private async getRecentContext(params: { category?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase;
      .from('mcp_context')'
      .select('*')'
      .order('timestamp', { ascending: false })'
      .limit(params.limit || 20);

    if (params.category) {
      query = query.eq('category', params.category);'
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent context: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: JSON.stringify({, results: data || [], count: data?.length || 0 }, null, 2),
        }],
    };
  }

  private async saveCodePattern(pattern: CodePattern): Promise<CallToolResult> {
    const { error } = await this.supabase;
      .from('mcp_code_patterns')'
      .insert({)
        pattern_type: pattern.pattern_type,
        before_code: pattern.before_code,
        after_code: pattern.after_code,
        description: pattern.description,
        error_types: pattern.error_types,
        success_rate: pattern.success_rate || 1.0,
        metadata: pattern.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save code pattern: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: `Successfully saved ${pattern.pattern_type} pattern`,
        }],
    };
  }

  private async getCodePatterns(params: { error_type?: string; pattern_type?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase;
      .from('mcp_code_patterns')'
      .select('*')'
      .order('success_rate', { ascending: false })'
      .limit(params.limit || 10);

    if (params.pattern_type) {
      query = query.eq('pattern_type', params.pattern_type);'
    }

    if (params.error_type) {
      query = query.contains('error_types', [params.error_type]);'
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get code patterns: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: JSON.stringify({, patterns: data || [], count: data?.length || 0 }, null, 2),
        }],
    };
  }

  private async saveTaskProgress(task: TaskProgress): Promise<CallToolResult> {
    const { error } = await this.supabase;
      .from('mcp_task_progress')'
      .upsert({)
        task_id: task.task_id,
        description: task.description,
        status: task.status,
        progress_percentage: task.progress_percentage || 0,
        metadata: task.metadata || {},
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(`Failed to save task progress: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: `Task ${task.task_id} updated to status: ${task.status}`,
        }],
    };
  }

  private async getTaskHistory(params: { task_id?: string; status?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase;
      .from('mcp_task_progress')'
      .select('*')'
      .order('updated_at', { ascending: false })'
      .limit(params.limit || 50);

    if (params.task_id) {
      query = query.eq('task_id', params.task_id);'
    }

    if (params.status) {
      query = query.eq('status', params.status);'
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get task history: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text','
          text: JSON.stringify({, tasks: data || [], count: data?.length || 0 }, null, 2),
        }],
    };
  }

  private async analyzeErrors(errorData: ErrorAnalysis): Promise<CallToolResult> {
    // Check if this error type already exists
    const { data: existing } = await this.supabase;
      .from('mcp_error_analysis')'
      .select('*')'
      .eq('error_type', errorData.error_type)'
      .eq('error_message', errorData.error_message)'
      .maybeSingle();

    if (existing) {
      // Update frequency
      const { error } = await this.supabase;
        .from('mcp_error_analysis')'
        .update({)
          frequency: (existing.frequency || 1) + 1,
          last_seen: new Date().toISOString(),
          solution_pattern: errorData.solution_pattern || existing.solution_pattern,
          metadata: { ...existing.metadata, ...errorData.metadata },
        })
        .eq('id', existing.id);'

      if (error) {
        throw new Error(`Failed to update error analysis: ${error.message}`);
      }
    } else {
      // Insert new error
      const { error } = await this.supabase;
        .from('mcp_error_analysis')'
        .insert({)
          error_type: errorData.error_type,
          error_message: errorData.error_message,
          file_path: errorData.file_path,
          line_number: errorData.line_number,
          solution_pattern: errorData.solution_pattern,
          frequency: 1,
          last_seen: new Date().toISOString(),
          metadata: errorData.metadata || {},
        });

      if (error) {
        throw new Error(`Failed to save error analysis: ${error.message}`);
      }
    }

    return {
      content: [
        {
          type: 'text','
          text: `Error analysis updated for ${errorData.error_type}`,
        }],
    };
  }

  // Resource implementations
  private async getContextResource() {
    const { data } = await this.supabase;
      .from('mcp_context')'
      .select('*')'
      .order('timestamp', { ascending: false })'
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://context','
          mimeType: 'application/json','
          text: JSON.stringify(data || [], null, 2),
        }],
    };
  }

  private async getPatternsResource() {
    const { data } = await this.supabase;
      .from('mcp_code_patterns')'
      .select('*')'
      .order('success_rate', { ascending: false })'
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://patterns','
          mimeType: 'application/json','
          text: JSON.stringify(data || [], null, 2),
        }],
    };
  }

  private async getTasksResource() {
    const { data } = await this.supabase;
      .from('mcp_task_progress')'
      .select('*')'
      .order('updated_at', { ascending: false })'
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://tasks','
          mimeType: 'application/json','
          text: JSON.stringify(data || [], null, 2),
        }],
    };
  }

  private async getErrorsResource() {
    const { data } = await this.supabase;
      .from('mcp_error_analysis')'
      .select('*')'
      .order('frequency', { ascending: false })'
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://errors','
          mimeType: 'application/json','
          text: JSON.stringify(data || [], null, 2),
        }],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Supabase MCP Server running on stdio');'
  }
}

// Run the server if this file is executed directly
if (import.meta.url === `file: //${process.argv[1]}`) {
  const server = new SupabaseMCPServer();
  server.run().catch(console.error);
}

export { SupabaseMCPServer };