#!/usr/bin/env node
/**
 * Integrated Supabase MCP Server for Universal AI Tools
 * Combines official Supabase MCP capabilities with custom AI tools features
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
  CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

interface ContextData {
  id?: string;
  content: string;
  category: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  embedding?: number[];
}

interface CodePattern {
  id?: string;
  pattern_type: string;
  before_code: string;
  after_code: string;
  description: string;
  success_rate?: number;
  error_types: string[];
  metadata?: Record<string, unknown>;
}

interface TaskProgress {
  id?: string;
  task_id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress_percentage?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface ErrorAnalysis {
  id?: string;
  error_type: string;
  error_message: string;
  file_path?: string;
  line_number?: number;
  solution_pattern?: string;
  frequency?: number;
  last_seen?: string;
  metadata?: Record<string, unknown>;
}

class IntegratedSupabaseMCPServer {
  private server: Server;
  private supabase: SupabaseClient;

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'integrated-supabase',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // === Standard Supabase Database Tools ===
        {
          name: 'query',
          description: 'Execute a SELECT query on Supabase tables',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' },
              select: { type: 'string', description: 'Columns to select (default: *)' },
              filters: { 
                type: 'object', 
                description: 'Filters to apply (e.g., { "column": "value" })',
                additionalProperties: true
              },
              order: { 
                type: 'object',
                properties: {
                  column: { type: 'string' },
                  ascending: { type: 'boolean' }
                }
              },
              limit: { type: 'number', description: 'Maximum number of rows' },
              offset: { type: 'number', description: 'Number of rows to skip' },
            },
            required: ['table'],
          },
        },
        {
          name: 'insert',
          description: 'Insert data into a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' },
              data: { 
                type: ['object', 'array'], 
                description: 'Data to insert (single object or array of objects)' 
              },
              upsert: { type: 'boolean', description: 'Perform upsert if true' },
            },
            required: ['table', 'data'],
          },
        },
        {
          name: 'update',
          description: 'Update data in a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' },
              data: { type: 'object', description: 'Data to update' },
              filters: { 
                type: 'object', 
                description: 'Filters to identify rows to update',
                additionalProperties: true
              },
            },
            required: ['table', 'data', 'filters'],
          },
        },
        {
          name: 'delete',
          description: 'Delete data from a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' },
              filters: { 
                type: 'object', 
                description: 'Filters to identify rows to delete',
                additionalProperties: true
              },
            },
            required: ['table', 'filters'],
          },
        },
        {
          name: 'list_tables',
          description: 'List all tables in the database',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'describe_table',
          description: 'Get schema information for a table',
          inputSchema: {
            type: 'object',
            properties: {
              table: { type: 'string', description: 'Table name' },
            },
            required: ['table'],
          },
        },
        // === AI Tools Context Management ===
        {
          name: 'save_context',
          description: 'Save project context, patterns, or knowledge to Supabase',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'The content to save' },
              category: { type: 'string', description: 'Category: project_overview, code_patterns, error_analysis, etc.' },
              metadata: { type: 'object', description: 'Additional metadata' },
            },
            required: ['content', 'category'],
          },
        },
        {
          name: 'search_context',
          description: 'Search saved context using semantic similarity',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              category: { type: 'string', description: 'Filter by category (optional)' },
              limit: { type: 'number', description: 'Number of results (default: 10)' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_recent_context',
          description: 'Get recently saved context entries',
          inputSchema: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Filter by category (optional)' },
              limit: { type: 'number', description: 'Number of results (default: 20)' },
            },
          },
        },
        // === Code Pattern Management ===
        {
          name: 'save_code_pattern',
          description: 'Save a successful code fix pattern for future reference',
          inputSchema: {
            type: 'object',
            properties: {
              pattern_type: { type: 'string', description: 'Type of pattern (syntax_fix, type_annotation, etc.)' },
              before_code: { type: 'string', description: 'Code before the fix' },
              after_code: { type: 'string', description: 'Code after the fix' },
              description: { type: 'string', description: 'Description of what the pattern fixes' },
              error_types: { type: 'array', items: { type: 'string' }, description: 'Types of errors this pattern addresses' },
              metadata: { type: 'object', description: 'Additional metadata' },
            },
            required: ['pattern_type', 'before_code', 'after_code', 'description', 'error_types'],
          },
        },
        {
          name: 'get_code_patterns',
          description: 'Retrieve code patterns for similar errors or situations',
          inputSchema: {
            type: 'object',
            properties: {
              error_type: { type: 'string', description: 'Type of error to find patterns for' },
              pattern_type: { type: 'string', description: 'Type of pattern to search for' },
              limit: { type: 'number', description: 'Number of patterns to return (default: 10)' },
            },
          },
        },
        // === Task Management ===
        {
          name: 'save_task_progress',
          description: 'Save or update task progress information',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'Unique task identifier' },
              description: { type: 'string', description: 'Task description' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'failed'], description: 'Task status' },
              progress_percentage: { type: 'number', description: 'Progress percentage (0-100)' },
              metadata: { type: 'object', description: 'Additional task metadata' },
            },
            required: ['task_id', 'description', 'status'],
          },
        },
        {
          name: 'get_task_history',
          description: 'Get task history and progress information',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'Specific task ID (optional)' },
              status: { type: 'string', description: 'Filter by status (optional)' },
              limit: { type: 'number', description: 'Number of results (default: 50)' },
            },
          },
        },
        // === Error Analysis ===
        {
          name: 'analyze_errors',
          description: 'Analyze and store TypeScript error patterns',
          inputSchema: {
            type: 'object',
            properties: {
              error_type: { type: 'string', description: 'Type of error (TS2345, syntax, etc.)' },
              error_message: { type: 'string', description: 'Full error message' },
              file_path: { type: 'string', description: 'File where error occurred' },
              line_number: { type: 'number', description: 'Line number of error' },
              solution_pattern: { type: 'string', description: 'Pattern or solution that fixed this error' },
              metadata: { type: 'object', description: 'Additional error context' },
            },
            required: ['error_type', 'error_message'],
          },
        },
        // === Storage Operations ===
        {
          name: 'storage_upload',
          description: 'Upload a file to Supabase Storage',
          inputSchema: {
            type: 'object',
            properties: {
              bucket: { type: 'string', description: 'Storage bucket name' },
              path: { type: 'string', description: 'File path in bucket' },
              content: { type: 'string', description: 'File content (base64 encoded for binary)' },
              contentType: { type: 'string', description: 'MIME type of the file' },
            },
            required: ['bucket', 'path', 'content'],
          },
        },
        {
          name: 'storage_download',
          description: 'Download a file from Supabase Storage',
          inputSchema: {
            type: 'object',
            properties: {
              bucket: { type: 'string', description: 'Storage bucket name' },
              path: { type: 'string', description: 'File path in bucket' },
            },
            required: ['bucket', 'path'],
          },
        },
        {
          name: 'storage_list',
          description: 'List files in a Supabase Storage bucket',
          inputSchema: {
            type: 'object',
            properties: {
              bucket: { type: 'string', description: 'Storage bucket name' },
              path: { type: 'string', description: 'Path prefix (optional)' },
              limit: { type: 'number', description: 'Maximum number of files' },
            },
            required: ['bucket'],
          },
        },
      ],
    }));

    // Tool call handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Standard Supabase operations
          case 'query':
            return await this.handleQuery(args);
          case 'insert':
            return await this.handleInsert(args);
          case 'update':
            return await this.handleUpdate(args);
          case 'delete':
            return await this.handleDelete(args);
          case 'list_tables':
            return await this.handleListTables();
          case 'describe_table':
            return await this.handleDescribeTable(args);
          
          // AI Tools operations
          case 'save_context':
            return await this.saveContext(args as ContextData);
          case 'search_context':
            return await this.searchContext(args as { query: string; category?: string; limit?: number });
          case 'get_recent_context':
            return await this.getRecentContext(args as { category?: string; limit?: number });
          case 'save_code_pattern':
            return await this.saveCodePattern(args as CodePattern);
          case 'get_code_patterns':
            return await this.getCodePatterns(args as { error_type?: string; pattern_type?: string; limit?: number });
          case 'save_task_progress':
            return await this.saveTaskProgress(args as TaskProgress);
          case 'get_task_history':
            return await this.getTaskHistory(args as { task_id?: string; status?: string; limit?: number });
          case 'analyze_errors':
            return await this.analyzeErrors(args as ErrorAnalysis);
          
          // Storage operations
          case 'storage_upload':
            return await this.handleStorageUpload(args);
          case 'storage_download':
            return await this.handleStorageDownload(args);
          case 'storage_list':
            return await this.handleStorageList(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'supabase://tables',
          name: 'Database Tables',
          description: 'List of all database tables',
          mimeType: 'application/json',
        },
        {
          uri: 'supabase://context',
          name: 'AI Project Context',
          description: 'Stored project context and patterns',
          mimeType: 'application/json',
        },
        {
          uri: 'supabase://patterns',
          name: 'Code Patterns',
          description: 'Successful code fix patterns',
          mimeType: 'application/json',
        },
        {
          uri: 'supabase://tasks',
          name: 'Task Progress',
          description: 'Task tracking and progress information',
          mimeType: 'application/json',
        },
        {
          uri: 'supabase://errors',
          name: 'Error Analysis',
          description: 'TypeScript error patterns and solutions',
          mimeType: 'application/json',
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'supabase://tables':
          return await this.getTablesResource();
        case 'supabase://context':
          return await this.getContextResource();
        case 'supabase://patterns':
          return await this.getPatternsResource();
        case 'supabase://tasks':
          return await this.getTasksResource();
        case 'supabase://errors':
          return await this.getErrorsResource();
        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });
  }

  // === Standard Supabase Operations ===
  private async handleQuery(args: any): Promise<CallToolResult> {
    let query = this.supabase.from(args.table).select(args.select || '*');

    if (args.filters) {
      for (const [key, value] of Object.entries(args.filters)) {
        query = query.eq(key, value);
      }
    }

    if (args.order) {
      query = query.order(args.order.column, { ascending: args.order.ascending ?? true });
    }

    if (args.limit) {
      query = query.limit(args.limit);
    }

    if (args.offset) {
      query = query.range(args.offset, args.offset + (args.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ data, count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async handleInsert(args: any): Promise<CallToolResult> {
    const { data, error } = await this.supabase
      .from(args.table)
      .insert(args.data)
      .select();

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ inserted: data, count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async handleUpdate(args: any): Promise<CallToolResult> {
    let query = this.supabase.from(args.table).update(args.data);

    if (args.filters) {
      for (const [key, value] of Object.entries(args.filters)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.select();

    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ updated: data, count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async handleDelete(args: any): Promise<CallToolResult> {
    let query = this.supabase.from(args.table).delete();

    if (args.filters) {
      for (const [key, value] of Object.entries(args.filters)) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.select();

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ deleted: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async handleListTables(): Promise<CallToolResult> {
    const { data, error } = await this.supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (error) {
      // Fallback: try a different approach
      const { data: tables, error: fallbackError } = await this.supabase.rpc('get_tables');
      
      if (fallbackError) {
        throw new Error(`Failed to list tables: ${error.message}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ tables: tables || [] }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tables: data?.map(t => t.table_name) || [] }, null, 2),
        },
      ],
    };
  }

  private async handleDescribeTable(args: any): Promise<CallToolResult> {
    const { data, error } = await this.supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', args.table);

    if (error) {
      throw new Error(`Failed to describe table: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ table: args.table, columns: data || [] }, null, 2),
        },
      ],
    };
  }

  // === Storage Operations ===
  private async handleStorageUpload(args: any): Promise<CallToolResult> {
    const { data, error } = await this.supabase.storage
      .from(args.bucket)
      .upload(args.path, Buffer.from(args.content, 'base64'), {
        contentType: args.contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `File uploaded successfully to ${args.bucket}/${args.path}`,
        },
      ],
    };
  }

  private async handleStorageDownload(args: any): Promise<CallToolResult> {
    const { data, error } = await this.supabase.storage
      .from(args.bucket)
      .download(args.path);

    if (error) {
      throw new Error(`Storage download failed: ${error.message}`);
    }

    const buffer = await data.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            path: args.path, 
            size: buffer.byteLength,
            content: base64,
          }, null, 2),
        },
      ],
    };
  }

  private async handleStorageList(args: any): Promise<CallToolResult> {
    const { data, error } = await this.supabase.storage
      .from(args.bucket)
      .list(args.path, {
        limit: args.limit || 100,
      });

    if (error) {
      throw new Error(`Storage list failed: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ files: data || [], count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  // === AI Tools Operations (from original implementation) ===
  private async saveContext(data: ContextData): Promise<CallToolResult> {
    const { error } = await this.supabase
      .from('mcp_context')
      .insert({
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
          type: 'text',
          text: `Successfully saved context in category: ${data.category}`,
        },
      ],
    };
  }

  private async searchContext(params: { query: string; category?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase
      .from('mcp_context')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(params.limit || 10);

    if (params.category) {
      query = query.eq('category', params.category);
    }

    // Basic text search (in a real implementation, you'd use vector similarity)
    query = query.ilike('content', `%${params.query}%`);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search context: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ results: data || [], count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async getRecentContext(params: { category?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase
      .from('mcp_context')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(params.limit || 20);

    if (params.category) {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get recent context: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ results: data || [], count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async saveCodePattern(pattern: CodePattern): Promise<CallToolResult> {
    const { error } = await this.supabase
      .from('mcp_code_patterns')
      .insert({
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
          type: 'text',
          text: `Successfully saved ${pattern.pattern_type} pattern`,
        },
      ],
    };
  }

  private async getCodePatterns(params: { error_type?: string; pattern_type?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase
      .from('mcp_code_patterns')
      .select('*')
      .order('success_rate', { ascending: false })
      .limit(params.limit || 10);

    if (params.pattern_type) {
      query = query.eq('pattern_type', params.pattern_type);
    }

    if (params.error_type) {
      query = query.contains('error_types', [params.error_type]);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get code patterns: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ patterns: data || [], count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async saveTaskProgress(task: TaskProgress): Promise<CallToolResult> {
    const { error } = await this.supabase
      .from('mcp_task_progress')
      .upsert({
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
          type: 'text',
          text: `Task ${task.task_id} updated to status: ${task.status}`,
        },
      ],
    };
  }

  private async getTaskHistory(params: { task_id?: string; status?: string; limit?: number }): Promise<CallToolResult> {
    let query = this.supabase
      .from('mcp_task_progress')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(params.limit || 50);

    if (params.task_id) {
      query = query.eq('task_id', params.task_id);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get task history: ${error.message}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ tasks: data || [], count: data?.length || 0 }, null, 2),
        },
      ],
    };
  }

  private async analyzeErrors(errorData: ErrorAnalysis): Promise<CallToolResult> {
    // Check if this error type already exists
    const { data: existing } = await this.supabase
      .from('mcp_error_analysis')
      .select('*')
      .eq('error_type', errorData.error_type)
      .eq('error_message', errorData.error_message)
      .maybeSingle();

    if (existing) {
      // Update frequency
      const { error } = await this.supabase
        .from('mcp_error_analysis')
        .update({
          frequency: (existing.frequency || 1) + 1,
          last_seen: new Date().toISOString(),
          solution_pattern: errorData.solution_pattern || existing.solution_pattern,
          metadata: { ...existing.metadata, ...errorData.metadata },
        })
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Failed to update error analysis: ${error.message}`);
      }
    } else {
      // Insert new error
      const { error } = await this.supabase
        .from('mcp_error_analysis')
        .insert({
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
          type: 'text',
          text: `Error analysis updated for ${errorData.error_type}`,
        },
      ],
    };
  }

  // === Resource Implementations ===
  private async getTablesResource() {
    const { data, error } = await this.supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public');

    return {
      contents: [
        {
          uri: 'supabase://tables',
          mimeType: 'application/json',
          text: JSON.stringify(data || [], null, 2),
        },
      ],
    };
  }

  private async getContextResource() {
    const { data } = await this.supabase
      .from('mcp_context')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://context',
          mimeType: 'application/json',
          text: JSON.stringify(data || [], null, 2),
        },
      ],
    };
  }

  private async getPatternsResource() {
    const { data } = await this.supabase
      .from('mcp_code_patterns')
      .select('*')
      .order('success_rate', { ascending: false })
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://patterns',
          mimeType: 'application/json',
          text: JSON.stringify(data || [], null, 2),
        },
      ],
    };
  }

  private async getTasksResource() {
    const { data } = await this.supabase
      .from('mcp_task_progress')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://tasks',
          mimeType: 'application/json',
          text: JSON.stringify(data || [], null, 2),
        },
      ],
    };
  }

  private async getErrorsResource() {
    const { data } = await this.supabase
      .from('mcp_error_analysis')
      .select('*')
      .order('frequency', { ascending: false })
      .limit(100);

    return {
      contents: [
        {
          uri: 'supabase://errors',
          mimeType: 'application/json',
          text: JSON.stringify(data || [], null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Integrated Supabase MCP Server running on stdio');
  }
}

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new IntegratedSupabaseMCPServer();
  server.run().catch(console.error);
}

export { IntegratedSupabaseMCPServer };