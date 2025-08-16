#!/usr/bin/env node
/**
 * Universal AI Tools Integrated Supabase MCP Server
 * Provides context persistence and pattern learning for TypeScript error prevention
 * This is the integrated version specifically for Claude Desktop
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequestSchema , ListResourcesRequestSchema , ListToolsRequestSchema , ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

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

class SupabaseMCPServer {
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
        name: 'supabase-universal-ai',
        version: '2.0.0',
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
    // 1. Save Context Tool
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'save_context',
          description: 'Save project context, patterns, or knowledge to Supabase',
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'The content to save' },
              category: {
                type: 'string',
                description: 'Category: project_overview, code_patterns, error_analysis, etc.',
              },
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
        {
          name: 'save_code_pattern',
          description: 'Save a successful code fix pattern for future reference',
          inputSchema: {
            type: 'object',
            properties: {
              pattern_type: {
                type: 'string',
                description: 'Type of pattern (syntax_fix, type_annotation, etc.)',
              },
              before_code: { type: 'string', description: 'Code before the fix' },
              after_code: { type: 'string', description: 'Code after the fix' },
              description: { type: 'string', description: 'Description of what the pattern fixes' },
              error_types: {
                type: 'array',
                items: { type: 'string' },
                description: 'Types of errors this pattern addresses',
              },
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
        {
          name: 'propose_migration',
          description: 'Use local LLM to propose a safe SQL migration for Supabase',
          inputSchema: {
            type: 'object',
            properties: {
              request: { type: 'string', description: 'Human request of desired DB change' },
              notes: { type: 'string', description: 'Additional context or constraints' },
              model: { type: 'string', description: 'Optional local model' },
            },
            required: ['request'],
          },
        },
        {
          name: 'save_task_progress',
          description: 'Save or update task progress information',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: { type: 'string', description: 'Unique task identifier' },
              description: { type: 'string', description: 'Task description' },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'failed'],
                description: 'Task status',
              },
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
              solution_pattern: {
                type: 'string',
                description: 'Pattern or solution that fixed this error',
              },
              metadata: { type: 'object', description: 'Additional error context' },
            },
            required: ['error_type', 'error_message'],
          },
        },
        // Local Memory Layer Tools (ByteRover alternative)
        {
          name: 'store_memory',
          description: 'Store a coding memory for future retrieval (ByteRover alternative)',
          inputSchema: {
            type: 'object',
            properties: {
              agent_name: { type: 'string', description: 'Name of the AI agent' },
              context_type: { 
                type: 'string', 
                enum: ['bug_fix', 'feature', 'refactor', 'optimization', 'pattern', 'decision'],
                description: 'Type of coding context'
              },
              content: { type: 'string', description: 'Description of the coding solution or pattern' },
              code_snippet: { type: 'string', description: 'Relevant code snippet' },
              file_path: { type: 'string', description: 'File path where the code is located' },
              programming_language: { type: 'string', description: 'Programming language used' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
              success_metrics: { 
                type: 'object', 
                description: 'Metrics indicating success of the solution'
              }
            },
            required: ['agent_name', 'context_type', 'content']
          }
        },
        {
          name: 'retrieve_memories',
          description: 'Retrieve relevant coding memories based on context (ByteRover alternative)',
          inputSchema: {
            type: 'object',
            properties: {
              context: { type: 'string', description: 'Context or problem description to search for' },
              code_snippet: { type: 'string', description: 'Code snippet to find similar patterns' },
              file_path: { type: 'string', description: 'File path to filter memories' },
              language: { type: 'string', description: 'Programming language filter' },
              agent_name: { type: 'string', description: 'Filter by specific agent' },
              limit: { type: 'number', description: 'Maximum number of memories to return', default: 5 }
            },
            required: ['context']
          }
        },
        {
          name: 'auto_generate_memory',
          description: 'Automatically generate and store memory from successful coding interaction',
          inputSchema: {
            type: 'object',
            properties: {
              agent_name: { type: 'string', description: 'Name of the AI agent' },
              context: { type: 'string', description: 'Context of the successful interaction' },
              code_snippet: { type: 'string', description: 'Code that was successfully implemented' },
              file_path: { type: 'string', description: 'File path of the implementation' },
              success: { type: 'boolean', description: 'Whether the implementation was successful' }
            },
            required: ['agent_name', 'context', 'code_snippet', 'file_path', 'success']
          }
        },
        {
          name: 'get_memory_stats',
          description: 'Get statistics about stored coding memories',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
      ],
    }));

    // Tool call handlers
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'save_context':
            return await this.saveContext(args as unknown as ContextData);
          case 'search_context':
            return await this.searchContext(
              args as unknown as { query: string; category?: string; limit?: number }
            );
          case 'get_recent_context':
            return await this.getRecentContext(
              args as unknown as { category?: string; limit?: number }
            );
          case 'save_code_pattern':
            return await this.saveCodePattern(args as unknown as CodePattern);
          case 'get_code_patterns':
            return await this.getCodePatterns(
              args as unknown as { error_type?: string; pattern_type?: string; limit?: number }
            );
          case 'propose_migration':
            return await this.proposeMigration(args as any);
          case 'save_task_progress':
            return await this.saveTaskProgress(args as unknown as TaskProgress);
          case 'get_task_history':
            return await this.getTaskHistory(
              args as unknown as { task_id?: string; status?: string; limit?: number }
            );
          case 'analyze_errors':
            return await this.analyzeErrors(args as unknown as ErrorAnalysis);
          // Memory Layer Tools
          case 'store_memory':
            return await this.storeMemory(args as any);
          case 'retrieve_memories':
            return await this.retrieveMemories(args as any);
          case 'auto_generate_memory':
            return await this.autoGenerateMemory(args as any);
          case 'get_memory_stats':
            return await this.getMemoryStats();
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
          uri: 'supabase://context',
          name: 'Project Context',
          description: 'Access to stored project context and patterns',
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

  // Tool implementations
  private async saveContext(data: ContextData): Promise<CallToolResult> {
    const { error } = await this.supabase.from('mcp_context').insert({
      content: data.content,
      category: data.category,
      metadata: data.metadata || {},
      created_at: new Date().toISOString(),
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

  private async searchContext(params: {
    query: string;
    category?: string;
    limit?: number;
  }): Promise<CallToolResult> {
    let query = this.supabase
      .from('mcp_context')
      .select('*')
      .order('created_at', { ascending: false })
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

  private async getRecentContext(params: {
    category?: string;
    limit?: number;
  }): Promise<CallToolResult> {
    let query = this.supabase
      .from('mcp_context')
      .select('*')
      .order('created_at', { ascending: false })
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
    const { error } = await this.supabase.from('mcp_code_patterns').insert({
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

  private async getCodePatterns(params: {
    error_type?: string;
    pattern_type?: string;
    limit?: number;
  }): Promise<CallToolResult> {
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
    const { error } = await this.supabase.from('mcp_task_progress').upsert({
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

  private async getTaskHistory(params: {
    task_id?: string;
    status?: string;
    limit?: number;
  }): Promise<CallToolResult> {
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
      const { error } = await this.supabase.from('mcp_error_analysis').insert({
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

  // Resource implementations
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

  private async proposeMigration(params: {
    request: string;
    notes?: string;
    model?: string;
  }): Promise<CallToolResult> {
    const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const lmStudioBase = process.env.LM_STUDIO_BASE_URL; // e.g. http://localhost:1234
    const model = params.model || process.env.OLLAMA_MODEL || 'llama3.1:8b';

    const prompt = `You are a Postgres SQL migration assistant. Given the request, output ONLY SQL suitable for a Supabase migration file. Avoid destructive changes unless explicitly asked. Request: ${params.request}\nNotes: ${params.notes || ''}`;

    try {
      if (lmStudioBase) {
        const res = await (((globalThis as any).fetch) || fetch)(`${lmStudioBase}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'Return only SQL. No explanations.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.1,
          }),
        });
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        return {
          content: [{ type: 'text', text: text.trim() }],
        };
      }

      const res = await (((globalThis as any).fetch) || fetch)(`${ollamaBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `Return only SQL (no prose).\n\n${prompt}`,
          stream: false,
          options: { temperature: 0.1 },
        }),
      });
      const data = await res.json();
      const text = data?.response || '';
      return { content: [{ type: 'text', text: text.trim() }] };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true } as any;
    }
  }

  // Memory Layer Methods (ByteRover alternative)
  private async storeMemory(args: any): Promise<CallToolResult> {
    try {
      // Generate a simple hash-based embedding for demo
      const embedding = this.generateSimpleEmbedding(args.content + ' ' + (args.code_snippet || ''));

      const { data, error } = await this.supabase
        .from('code_memories')
        .insert({
          session_id: 'mcp-session',
          agent_name: args.agent_name,
          context_type: args.context_type,
          content: args.content,
          code_snippet: args.code_snippet,
          file_path: args.file_path,
          programming_language: args.programming_language || this.detectLanguage(args.file_path || ''),
          tags: args.tags || [],
          success_metrics: args.success_metrics,
          embedding,
          access_count: 0
        })
        .select('id')
        .single();

      if (error) throw error;

      return {
        content: [
          {
            type: 'text',
            text: `✅ Memory stored successfully with ID: ${data.id}`
          }
        ]
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error storing memory: ${msg}` }], isError: true } as any;
    }
  }

  private async retrieveMemories(args: any): Promise<CallToolResult> {
    try {
      const queryEmbedding = this.generateSimpleEmbedding(args.context + ' ' + (args.code_snippet || ''));

      const { data, error } = await this.supabase.rpc('search_code_memories', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: args.limit || 5,
        agent_filter: args.agent_name,
        language_filter: args.language
      });

      if (error) throw error;

      const memories = data || [];
      
      return {
        content: [
          {
            type: 'text',
            text: `🔍 Found ${memories.length} relevant memories:\n\n` +
              memories.map((m: any, i: number) => 
                `${i + 1}. **${m.context_type}** (${m.programming_language})\n` +
                `   Agent: ${m.agent_name}\n` +
                `   Content: ${m.content}\n` +
                `   File: ${m.file_path || 'N/A'}\n` +
                `   Tags: ${m.tags?.join(', ') || 'None'}\n` +
                `   Similarity: ${(m.similarity * 100).toFixed(1)}%\n`
              ).join('\n')
          }
        ]
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error retrieving memories: ${msg}` }], isError: true } as any;
    }
  }

  private async autoGenerateMemory(args: any): Promise<CallToolResult> {
    try {
      if (!args.success) {
        return {
          content: [
            {
              type: 'text',
              text: '⚠️ Memory not generated - interaction was not successful'
            }
          ]
        };
      }

      // Determine context type from the context
      let contextType = 'pattern';
      const context = args.context.toLowerCase();
      
      if (context.includes('fix') || context.includes('bug')) {
        contextType = 'bug_fix';
      } else if (context.includes('refactor')) {
        contextType = 'refactor';
      } else if (context.includes('optimize')) {
        contextType = 'optimization';
      } else if (context.includes('feature') || context.includes('add')) {
        contextType = 'feature';
      }

      // Generate tags from context and code
      const tags = this.extractTags(args.context, args.code_snippet);

      const memoryArgs = {
        agent_name: args.agent_name,
        context_type: contextType,
        content: args.context,
        code_snippet: args.code_snippet,
        file_path: args.file_path,
        programming_language: this.detectLanguage(args.file_path),
        tags,
        success_metrics: {
          compilation_success: true,
          test_passing: args.success
        }
      };

      return await this.storeMemory(memoryArgs);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error auto-generating memory: ${msg}` }], isError: true } as any;
    }
  }

  private async getMemoryStats(): Promise<CallToolResult> {
    try {
      const { data, error } = await this.supabase.rpc('get_memory_stats');
      
      if (error) throw error;

      const stats = data[0] || { total_memories: 0, by_agent: {}, by_type: {}, by_language: {} };

      return {
        content: [
          {
            type: 'text',
            text: `📊 Memory Layer Statistics:\n\n` +
              `Total memories: ${stats.total_memories}\n\n` +
              `By Agent:\n${Object.entries(stats.by_agent || {}).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}\n\n` +
              `By Type:\n${Object.entries(stats.by_type || {}).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}\n\n` +
              `By Language:\n${Object.entries(stats.by_language || {}).map(([k, v]) => `  - ${k}: ${v}`).join('\n')}`
          }
        ]
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text', text: `Error getting memory stats: ${msg}` }], isError: true } as any;
    }
  }

  private generateSimpleEmbedding(text: string): number[] {
    // Simple hash-based embedding for demo purposes
    const embedding = new Array(1536).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    words.forEach((word, i) => {
      const hash = this.simpleHash(word);
      embedding[hash % 1536] += 1 / (i + 1);
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'tsx': 'tsx',
      'jsx': 'jsx',
      'py': 'python',
      'swift': 'swift',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c'
    };
    return languageMap[ext || ''] || 'unknown';
  }

  private extractTags(context: string, code: string): string[] {
    const tags: Set<string> = new Set();
    
    const patterns = [
      /async|await/gi,
      /promise|then|catch/gi,
      /function|method/gi,
      /class|interface/gi,
      /api|endpoint/gi,
      /database|sql/gi,
      /test|testing/gi,
      /performance|optimization/gi,
      /security|auth/gi,
      /error|exception/gi
    ];

    patterns.forEach(pattern => {
      const matches = (context + ' ' + code).match(pattern);
      if (matches) {
        matches.forEach(match => tags.add(match.toLowerCase()));
      }
    });

    return Array.from(tags).slice(0, 10);
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Supabase MCP Server running on stdio');
  }
}

// Run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new SupabaseMCPServer();
  server.run().catch(console.error);
}

export { SupabaseMCPServer };
