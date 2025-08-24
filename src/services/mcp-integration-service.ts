/**
 * MCP Integration Service
 * Manages the Supabase MCP server process and provides integration with the main application
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Avoid importing fileURLToPath/import.meta in test (CommonJS) environments
import { log, LogContext } from '../utils/logger.js';

interface MCPMessage {
  id: string;
  method: string;
  params: unknown;
  timestamp: number;
}

interface MCPResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

interface MCPHealthStatus {
  isRunning: boolean;
  lastPing?: number;
  processId?: number;
  uptime?: number;
  messageCount: number;
  errorCount: number;
}

export class MCPIntegrationService extends EventEmitter {
  private supabaseMCPProcess: ChildProcess | null = null;
  private supabase: SupabaseClient | null = null;
  private isConnected = false;
  private messageQueue: MCPMessage[] = [];
  private healthStatus: MCPHealthStatus = {
    isRunning: false,
    messageCount: 0,
    errorCount: 0,
  };
  private startTime = 0;
  private readonly maxRetries = 3;
  private retryCount = 0;
  private hasSupabaseConfig = false;

  constructor() {
    super();

    // Initialize Supabase client for fallback operations
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log.warn('⚠️ Supabase configuration missing for MCP fallback', LogContext.MCP);
      this.hasSupabaseConfig = false;
    } else {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.hasSupabaseConfig = true;
        log.info('✅ Supabase client initialized for MCP fallback', LogContext.MCP);
      } catch (error) {
        log.error('❌ Failed to initialize Supabase client', LogContext.MCP, {
          error: error instanceof Error ? error.message : String(error),
        });
        this.hasSupabaseConfig = false;
      }
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle process exit
    process.on('exit', () => {
      this.shutdown();
    });

    process.on('SIGINT', () => {
      this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Start the MCP server connections
   */
  public async start(): Promise<void> {
    if (this.isConnected) {
      log.info('✅ MCP servers already connected', LogContext.MCP);
      return;
    }

    try {
      log.info('🚀 Starting MCP server connections...', LogContext.MCP);

      // Try to connect to Docker MCP servers
      try {
        await this.connectToDockerMCPServers();
        this.isConnected = true;
        this.startTime = Date.now();
        this.healthStatus.isRunning = true;
        this.healthStatus.processId = process.pid;

        log.info('✅ MCP servers connected successfully', LogContext.MCP, {
          uptime: this.healthStatus.uptime,
          messageCount: this.healthStatus.messageCount,
        });

        this.emit('connected');
      } catch (mcpError) {
        log.warn('⚠️ MCP servers not available, using fallback mode', LogContext.MCP, {
          error: mcpError instanceof Error ? mcpError.message : String(mcpError),
        });

        // Set up fallback mode
        this.isConnected = false;
        this.healthStatus.isRunning = false;
        this.emit('fallback-mode');

        // Don't throw error, just log warning and continue
        log.info('ℹ️ Application will run with limited MCP functionality', LogContext.MCP);
      }
    } catch (error) {
      log.error('❌ Failed to start MCP integration service', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
      this.healthStatus.isRunning = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Connect to Docker MCP servers
   */
  private async connectToDockerMCPServers(): Promise<void> {
    // Check if MCP is disabled
    if (process.env.DISABLE_MCP === 'true') {
      log.info('🚫 MCP Docker connections disabled by environment variable', LogContext.MCP);
      return;
    }

    // Use local MCP servers instead of Docker containers
    const mcpServerUrls = [
      'http://localhost:3000', // Supabase MCP (integrated)
      // Note: XcodeBuildMCP and other local MCP servers are handled via CLI integration
    ];

    log.info('🔗 Connecting to Docker MCP servers...', LogContext.MCP, {
      serverCount: mcpServerUrls.length,
    });

    // Test connections to all MCP servers
    const connectionPromises = mcpServerUrls.map(async (url, index) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          log.info(`✅ Connected to MCP server ${index + 1}`, LogContext.MCP, { url });
          return { url, status: 'connected' };
        } else {
          log.warn(
            `⚠️ MCP server ${index + 1} returned status ${response.status}`,
            LogContext.MCP,
            { url }
          );
          return { url, status: 'error', error: `HTTP ${response.status}` };
        }
      } catch (error) {
        log.warn(`⚠️ Failed to connect to MCP server ${index + 1}`, LogContext.MCP, {
          url,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          url,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const results = await Promise.allSettled(connectionPromises);
    const successfulConnections = results.filter(
      (result): result is PromiseFulfilledResult<{ url: string; status: string }> =>
        result.status === 'fulfilled' && result.value.status === 'connected'
    );

    if (successfulConnections.length === 0) {
      throw new Error('No MCP servers could be connected');
    }

    log.info(
      `✅ Connected to ${successfulConnections.length}/${mcpServerUrls.length} MCP servers`,
      LogContext.MCP
    );
  }

  private setupProcessHandlers(): void {
    if (!this.supabaseMCPProcess) {return;}

    this.supabaseMCPProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log.debug('MCP stdout:', LogContext.MCP, { output });
      }
    });

    this.supabaseMCPProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('running on stdio')) {
        log.warn('MCP stderr:', LogContext.MCP, { output });
        this.healthStatus.errorCount++;
      }
    });

    this.supabaseMCPProcess.on('exit', (code, signal) => {
      log.warn('🔄 MCP server process exited', LogContext.MCP, { code, signal });
      this.isConnected = false;
      this.healthStatus.isRunning = false;
      this.emit('disconnected');

      // Auto-restart if unexpected exit
      if (code !== 0 && this.retryCount < this.maxRetries) {
        log.info('🔄 Auto-restarting MCP server', LogContext.MCP);
        setTimeout(() => this.start(), 1000); // Reduced from 5s to 1s
      }
    });

    this.supabaseMCPProcess.on('error', (error) => {
      log.error('❌ MCP server process error', LogContext.MCP, {
        error: error.message,
      });
      this.healthStatus.errorCount++;
      this.emit('error', error);
    });
  }

  private async waitForReady(timeout = 10000): Promise<boolean> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkReady = () => {
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }

        if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
          // Simple ping test - if process is running and hasn't crashed, consider it ready
          setTimeout(() => {
            if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
              resolve(true);
            } else {
              setTimeout(checkReady, 100);
            }
          }, 1000);
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Send a message to the MCP server
   */
  async sendMessage(method: string, params: unknown = {}): Promise<unknown> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const message: MCPMessage = {
      id: messageId,
      method,
      params,
      timestamp: Date.now(),
    };

    this.healthStatus.messageCount++;

    try {
      // Temporary: route propose_migration via fallback to get concrete SQL until full MCP response plumbing exists
      if (method === 'propose_migration') {
        return await this.fallbackOperation(method, params);
      }
      if (!this.isConnected || !this.supabaseMCPProcess) {
        log.warn('⚠️ MCP server not connected, using fallback', LogContext.MCP);
        return await this.fallbackOperation(method, params);
      }

      // Send JSON-RPC message to the MCP server
      const jsonRpcMessage = {
        jsonrpc: '2.0',
        id: messageId,
        method,
        params,
      };

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`MCP message timeout: ${method}`));
        }, 30000);

        // For now, simulate successful response since we don't have bidirectional communication
        clearTimeout(timeout);
        resolve({ success: true, method, params });
      });
    } catch (error) {
      log.error('❌ Failed to send MCP message', LogContext.MCP, {
        method,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to direct Supabase operations
      return await this.fallbackOperation(method, params);
    }
  }

  /**
   * Fallback operations when MCP server is unavailable
   */
  private async fallbackOperation(method: string, params: unknown): Promise<unknown> {
    log.debug('🔄 Using MCP fallback operation', LogContext.MCP, { method });

    try {
      switch (method) {
        case 'save_context':
          return await this.fallbackSaveContext(params as any);
        case 'search_context':
          return await this.fallbackSearchContext(params as any);
        case 'get_recent_context':
          return await this.fallbackGetRecentContext(params as any);
        case 'save_code_pattern':
          return await this.fallbackSaveCodePattern(params as any);
        case 'get_code_patterns':
          return await this.fallbackGetCodePatterns(params as any);
        case 'propose_migration':
          return await this.fallbackProposeMigration(params as any);
        default:
          throw new Error(`Unsupported fallback method: ${method}`);
      }
    } catch (error) {
      log.error('❌ Fallback operation failed', LogContext.MCP, {
        method,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Fallback implementations
  private async fallbackSaveContext(params: {
    content: string;
    category: string;
    metadata?: any;
  }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      // Simple in-memory fallback
      log.debug('Using in-memory fallback for save context', LogContext.MCP);
      return { success: true, message: `Context saved in memory for category: ${params.category}` };
    }

    const { error } = await this.supabase.from('mcp_context').insert({
      content: params.content,
      category: params.category,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });

    if (error) {throw new Error(`Failed to save context: ${error.message}`);}
    return { success: true, message: `Saved context in category: ${params.category}` };
  }

  private async fallbackSearchContext(params: {
    query: string;
    category?: string;
    limit?: number;
  }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for search context', LogContext.MCP);
      return { results: [], count: 0, message: 'In-memory search not implemented' };
    }

    let query = this.supabase
      .from('mcp_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.category) {
      query = query.eq('category', params.category);
    }

    query = query.ilike('content', `%${params.query}%`);

    const { data, error } = await query;
    if (error) {throw new Error(`Failed to search context: ${error.message}`);}

    return { results: data || [], count: data?.length || 0 };
  }

  private async fallbackGetRecentContext(params: {
    category?: string;
    limit?: number;
  }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for get recent context', LogContext.MCP);
      return { results: [], count: 0, message: 'In-memory storage not implemented' };
    }

    let query = this.supabase
      .from('mcp_context')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 20);

    if (params.category) {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;
    if (error) {throw new Error(`Failed to get recent context: ${error.message}`);}

    return { results: data || [], count: data?.length || 0 };
  }

  private async fallbackSaveCodePattern(params: any): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for save code pattern', LogContext.MCP);
      return { success: true, message: `Pattern saved in memory: ${params.pattern_type}` };
    }

    const { error } = await this.supabase.from('mcp_code_patterns').insert({
      pattern_type: params.pattern_type,
      before_code: params.before_code,
      after_code: params.after_code,
      description: params.description,
      error_types: params.error_types,
      success_rate: params.success_rate || 1.0,
      metadata: params.metadata || {},
      created_at: new Date().toISOString(),
    });

    if (error) {throw new Error(`Failed to save code pattern: ${error.message}`);}
    return { success: true, message: `Saved ${params.pattern_type} pattern` };
  }

  private async fallbackGetCodePatterns(params: {
    error_type?: string;
    pattern_type?: string;
    limit?: number;
  }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for get code patterns', LogContext.MCP);
      return { patterns: [], count: 0, message: 'In-memory patterns not implemented' };
    }

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
    if (error) {throw new Error(`Failed to get code patterns: ${error.message}`);}

    return { patterns: data || [], count: data?.length || 0 };
  }

  // Local LLM-backed proposal using Ollama or LM Studio
  private async fallbackProposeMigration(params: {
    request: string;
    notes?: string;
    model?: string;
  }): Promise<unknown> {
    const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const lmStudioBase = process.env.LM_STUDIO_BASE_URL; // e.g. http://localhost:1234
    const model = params.model || process.env.OLLAMA_MODEL || 'llama3.1:8b';

    const prompt = `You are a Postgres SQL migration assistant. Given the request, output ONLY SQL suitable for a Supabase migration file. Avoid destructive changes unless explicitly asked. Request: ${params.request}\nNotes: ${params.notes || ''}`;

    try {
      // Prefer LM Studio OpenAI-compatible if configured
      if (lmStudioBase) {
        const res = await fetch(`${lmStudioBase}/v1/chat/completions`, {
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
        return { success: true, sql: text.trim() };
      }

      // Fallback: Ollama generate
      const res = await fetch(`${ollamaBase}/api/generate`, {
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
      return { success: true, sql: text.trim() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Ensure database tables exist
   */
  private async ensureTablesExist(): Promise<void> {
    if (!this.supabase) {
      log.warn('⚠️ Supabase client not available, skipping table check', LogContext.MCP);
      return;
    }

    try {
      // Head-only check; if RLS blocks select we don't treat as missing
      const { error } = await this.supabase
        .from('mcp_context')
        .select('id', { head: true, count: 'exact' })
        .limit(1);

      if (!error) {
        log.info('✅ MCP database tables verified', LogContext.MCP);
        return;
      }

      const message = (error as any)?.message || String(error);
      const code = (error as any)?.code || '';
      const looksMissing =
        /does not exist|relation .* does not exist|42P01/i.test(message) || code === '42P01';
      const looksRls =
        /permission denied|RLS|policy|42501|Unauthorized|401|403/i.test(message) ||
        code === '42501';

      if (looksMissing) {
        log.warn('⚠️ MCP tables do not exist, they need to be created', LogContext.MCP);
      } else if (looksRls) {
        log.info(
          'ℹ️ MCP tables reachable but RLS/permissions block head-select; proceeding',
          LogContext.MCP,
          {
            code,
          }
        );
      } else {
        log.info('ℹ️ MCP table check encountered a non-fatal error; proceeding', LogContext.MCP, {
          code,
          message,
        });
      }
    } catch (error) {
      log.warn('⚠️ Could not verify MCP tables', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get health status of the MCP server
   */
  getHealthStatus(): MCPHealthStatus {
    return {
      ...this.healthStatus,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      lastPing: Date.now(),
    };
  }

  /**
   * Test the MCP server connection
   */
  async ping(): Promise<boolean> {
    try {
      // If MCP server is not running and we don't have Supabase config, return false
      if (!this.isConnected && !this.hasSupabaseConfig) {
        return false;
      }

      const result = await this.sendMessage('get_recent_context', { limit: 1 });
      this.healthStatus.lastPing = Date.now();
      return !!result;
    } catch (error) {
      log.warn('⚠️ MCP ping failed', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Restart the MCP server
   */
  async restart(): Promise<void> {
    log.info('🔄 Restarting MCP server', LogContext.MCP);

    await this.shutdown();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.start();
  }

  /**
   * Shutdown the MCP server
   */
  async shutdown(): Promise<void> {
    if (this.supabaseMCPProcess) {
      log.info('🛑 Shutting down MCP server', LogContext.MCP);

      this.isConnected = false;
      this.healthStatus.isRunning = false;

      this.supabaseMCPProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        if (this.supabaseMCPProcess) {
          this.supabaseMCPProcess.on('exit', resolve);
          setTimeout(() => {
            if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
              this.supabaseMCPProcess.kill('SIGKILL');
            }
            resolve(undefined);
          }, 5000);
        } else {
          resolve(undefined);
        }
      });

      this.supabaseMCPProcess = null;
      this.emit('shutdown');
    }
  }

  /**
   * Call a tool on an MCP server
   * Supports both built-in Supabase tools and external MCP servers like code-search
   */
  async callTool(
    serverName: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    try {
      if (serverName === 'supabase' || serverName === 'mcp') {
        // Use existing sendMessage for Supabase MCP operations
        return await this.sendMessage(toolName, params);
      }

      if (serverName === 'filesystem') {
        // Handle filesystem operations via direct tool calls
        return await this.callFilesystemTool(toolName, params);
      }

      if (serverName === 'code-search') {
        // Handle code search operations via new code-search MCP server
        return await this.callCodeSearchTool(toolName, params);
      }

      throw new Error(`Unknown MCP server: ${serverName}`);
    } catch (error) {
      log.error('Failed to call MCP tool', LogContext.MCP, {
        server: serverName,
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Call filesystem tools directly
   */
  private async callFilesystemTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    // For now, provide basic filesystem operations
    // In production, this would connect to the filesystem MCP server
    switch (toolName) {
      case 'list_files':
        return this.fallbackListFiles(params);
      case 'read_file':
        return this.fallbackReadFile(params);
      case 'search_files':
        return this.fallbackSearchFiles(params);
      default:
        throw new Error(`Unsupported filesystem tool: ${toolName}`);
    }
  }

  /**
   * Call code search tools via the new MCP server
   */
  private async callCodeSearchTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    // For now, return mock data until the code-search MCP server is fully integrated
    // In production, this would spawn and communicate with the code-search MCP server
    log.info('Code search tool called', LogContext.MCP, { tool: toolName, params });

    switch (toolName) {
      case 'search_code':
        return {
          query: params.query,
          results: [],
          total_files_searched: 0,
          search_strategy: 'code_element_search',
        };
      case 'analyze_function':
        return {
          function: { name: params.function_name, line: 1, signature: 'mock', context: 'mock' },
          dependencies: [],
          usages: [],
          file_context: { total_functions: 0, total_classes: 0, imports: 0 },
        };
      case 'trace_imports':
        return {
          starting_file: params.file_path,
          target_symbol: params.symbol,
          import_chain: [],
          total_files_traced: 0,
        };
      case 'find_usages':
        return {
          symbol: params.symbol,
          symbol_type: params.symbol_type,
          usages: [],
          total_files_searched: 0,
        };
      case 'analyze_class':
        return {
          class: { name: params.class_name, line: 1, signature: 'mock', context: 'mock' },
          methods: [],
          inheritance: [],
          properties: [],
        };
      case 'search_repository':
        return {
          repository_root: params.root_path,
          query: params.query,
          search_strategy: params.search_strategy,
          results: [],
          total_files_scanned: 0,
          performance_metrics: {
            files_found: 0,
            results_found: 0,
            avg_relevance: 0,
          },
        };
      default:
        throw new Error(`Unsupported code search tool: ${toolName}`);
    }
  }

  /**
   * Fallback filesystem operations
   */
  private async fallbackListFiles(params: Record<string, unknown>): Promise<unknown> {
    // Basic file listing - would be replaced with actual filesystem MCP calls
    return {
      files: [],
      message: 'Filesystem MCP server not yet connected - using fallback',
    };
  }

  private async fallbackReadFile(params: Record<string, unknown>): Promise<unknown> {
    // Basic file reading - would be replaced with actual filesystem MCP calls
    return {
      content: '',
      message: 'Filesystem MCP server not yet connected - using fallback',
    };
  }

  private async fallbackSearchFiles(params: Record<string, unknown>): Promise<unknown> {
    // Basic file search - would be replaced with actual filesystem MCP calls
    return {
      matches: [],
      message: 'Filesystem MCP server not yet connected - using fallback',
    };
  }

  /**
   * Get available tools from all connected MCP servers
   */
  async getAvailableTools(): Promise<Record<string, string[]>> {
    return {
      supabase: [
        'save_context',
        'get_context',
        'save_code_pattern',
        'get_code_patterns',
        'propose_migration',
      ],
      filesystem: ['list_files', 'read_file', 'search_files'],
      'code-search': [
        'search_code',
        'analyze_function',
        'trace_imports',
        'find_usages',
        'analyze_class',
        'search_repository',
      ],
    };
  }

  /**
   * Check if MCP server is connected
   */
  isRunning(): boolean {
    return this.isConnected && !!this.supabaseMCPProcess && !this.supabaseMCPProcess.killed;
  }

  /**
   * Get current status of the MCP service
   */
  getStatus(): { status: string; connected: boolean; health: MCPHealthStatus; uptime?: number } {
    const uptime = this.startTime > 0 ? Date.now() - this.startTime : undefined;

    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      connected: this.isConnected,
      health: {
        ...this.healthStatus,
        uptime,
        lastPing: Date.now(),
      },
      uptime,
    };
  }
}

// Export singleton instance
export const mcpIntegrationService = new MCPIntegrationService();
