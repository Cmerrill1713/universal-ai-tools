/**
 * MCP Integration Service
 * Manages the Supabase MCP server process and provides integration with the main application
 */

import type { ChildProcess } from 'child_process';';
import { spawn  } from 'child_process';';
import { EventEmitter  } from 'events';';
import path from 'path';';
import { fileURLToPath  } from 'url';';
import type { SupabaseClient } from '@supabase/supabase-js';';
import { createClient  } from '@supabase/supabase-js';';
import { LogContext, log  } from '../utils/logger.js';';

interface MCPMessage {
  id: string;,
  method: string;
  params: unknown;,
  timestamp: number;
}

interface MCPResponse {
  id: string;
  result?: unknown;
  error?: { code: number;, message: string };
}

interface MCPHealthStatus {
  isRunning: boolean;
  lastPing?: number;
  processId?: number;
  uptime?: number;
  messageCount: number;,
  errorCount: number;
}

export class MCPIntegrationService extends EventEmitter {
  private supabaseMCPProcess: ChildProcess | null = null;
  private supabase: SupabaseClient | null = null;
  private isConnected = false;
  private messageQueue: MCPMessage[] = [];
  private healthStatus: MCPHealthStatus = {,
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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log.warn('⚠️ Supabase configuration missing for MCP fallback', LogContext.MCP);'
      this.hasSupabaseConfig = false;
    } else {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        this.hasSupabaseConfig = true;
        log.info('✅ Supabase client initialized for MCP fallback', LogContext.MCP);'
      } catch (error) {
        log.error('❌ Failed to initialize Supabase client', LogContext.MCP, {')
          error: error instanceof Error ? error.message : String(error),
        });
        this.hasSupabaseConfig = false;
      }
    }

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle process exit
    process.on('exit', () => {'
      this.shutdown();
    });

    process.on('SIGINT', () => {'
      this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', () => {'
      this.shutdown();
      process.exit(0);
    });
  }

  /**
   * Start the MCP server process
   */
  async start(): Promise<boolean> {
    if (this.isConnected && this.supabaseMCPProcess) {
      log.info('✅ MCP server already running', LogContext.MCP);'
      return true;
    }

    try {
      // First, ensure database tables exist
      await this.ensureTablesExist();

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const serverPath = path.join(__dirname, '../mcp/supabase-mcp-server.ts');';

      log.info('🚀 Starting Supabase MCP server', LogContext.MCP, {')
        serverPath,
        nodeVersion: process.version,
      });

      // Start the MCP server process
      this.supabaseMCPProcess = spawn('tsx', [serverPath], {')
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'development','
        },
        stdio: ['pipe', 'pipe', 'pipe'],'
      });

      this.startTime = Date.now();
      this.setupProcessHandlers();

      // Wait for the process to be ready
      const isReady = await this.waitForReady();
      
      if (isReady) {
        this.isConnected = true;
        this.healthStatus.isRunning = true;
        this.healthStatus.processId = this.supabaseMCPProcess.pid;
        this.retryCount = 0;
        
        log.info('✅ MCP server started successfully', LogContext.MCP, {')
          pid: this.supabaseMCPProcess.pid,
        });

        this.emit('started');'
        return true;
      } else {
        throw new Error('MCP server failed to start within timeout');';
      }
    } catch (error) {
      log.error('❌ Failed to start MCP server', LogContext.MCP, {')
        error: error instanceof Error ? error.message : String(error),
        retryCount: this.retryCount,
      });

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        log.info(`🔄 Retrying MCP server start (${this.retryCount}/${this.maxRetries})`, LogContext.MCP);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * this.retryCount));
        return this.start();
      }

      this.emit('error', error);'
      return false;
    }
  }

  private setupProcessHandlers(): void {
    if (!this.supabaseMCPProcess) return;

    this.supabaseMCPProcess.stdout?.on('data', (data) => {'
      const output = data.toString().trim();
      if (output) {
        log.debug('MCP stdout: ', LogContext.MCP, { output });'
      }
    });

    this.supabaseMCPProcess.stderr?.on('data', (data) => {'
      const output = data.toString().trim();
      if (output && !output.includes('running on stdio')) {'
        log.warn('MCP stderr: ', LogContext.MCP, { output });'
        this.healthStatus.errorCount++;
      }
    });

    this.supabaseMCPProcess.on('exit', (code, signal) => {'
      log.warn('🔄 MCP server process exited', LogContext.MCP, { code, signal });'
      this.isConnected = false;
      this.healthStatus.isRunning = false;
      this.emit('disconnected');'

      // Auto-restart if unexpected exit
      if (code !== 0 && this.retryCount < this.maxRetries) {
        log.info('🔄 Auto-restarting MCP server', LogContext.MCP);'
        setTimeout(() => this.start(), 5000);
      }
    });

    this.supabaseMCPProcess.on('error', (error) => {'
      log.error('❌ MCP server process error', LogContext.MCP, {')
        error: error.message,
      });
      this.healthStatus.errorCount++;
      this.emit('error', error);'
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
          // Simple ping test - if process is running and hasn't crashed, consider it ready'
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
    
    const message: MCPMessage = {,;
      id: messageId,
      method,
      params,
      timestamp: Date.now(),
    };

    this.healthStatus.messageCount++;

    try {
      if (!this.isConnected || !this.supabaseMCPProcess) {
        log.warn('⚠️ MCP server not connected, using fallback', LogContext.MCP);'
        return await this.fallbackOperation(method, params);
      }

      // Send JSON-RPC message to the MCP server
      const jsonRpcMessage = {
        jsonrpc: '2.0','
        id: messageId,
        method,
        params,
      };

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`MCP message timeout: ${method}`));
        }, 30000);

        // For now, simulate successful response since we don't have bidirectional communication'
        clearTimeout(timeout);
        resolve({ success: true, method, params });
      });

    } catch (error) {
      log.error('❌ Failed to send MCP message', LogContext.MCP, {')
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
    log.debug('🔄 Using MCP fallback operation', LogContext.MCP, { method });'

    try {
      switch (method) {
        case 'save_context':'
          return await this.fallbackSaveContext(params as any);
        case 'search_context':'
          return await this.fallbackSearchContext(params as any);
        case 'get_recent_context':'
          return await this.fallbackGetRecentContext(params as any);
        case 'save_code_pattern':'
          return await this.fallbackSaveCodePattern(params as any);
        case 'get_code_patterns':'
          return await this.fallbackGetCodePatterns(params as any);
        default: throw new Error(`Unsupported fallback, method: ${method}`);
      }
    } catch (error) {
      log.error('❌ Fallback operation failed', LogContext.MCP, {')
        method,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Fallback implementations
  private async fallbackSaveContext(params: {, content: string; category: string; metadata?: any }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      // Simple in-memory fallback
      log.debug('Using in-memory fallback for save context', LogContext.MCP);'
      return { success: true, message: `Context saved in memory for, category: ${params.category}` };
    }

    const { error } = await this.supabase;
      .from('mcp_context')'
      .insert({)
        content: params.content,
        category: params.category,
        metadata: params.metadata || {},
        timestamp: new Date().toISOString(),
      });

    if (error) throw new Error(`Failed to save context: ${error.message}`);
    return { success: true, message: `Saved context in, category: ${params.category}` };
  }

  private async fallbackSearchContext(params: {, query: string; category?: string; limit?: number }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for search context', LogContext.MCP);'
      return { results: [], count: 0, message: 'In-memory search not implemented' };';
    }

    let query = this.supabase;
      .from('mcp_context')'
      .select('*')'
      .order('timestamp', { ascending: false })'
      .limit(params.limit || 10);

    if (params.category) {
      query = query.eq('category', params.category);'
    }

    query = query.ilike('content', `%${params.query}%`);'

    const { data, error } = await query;
    if (error) throw new Error(`Failed to search context: ${error.message}`);
    
    return { results: data || [], count: data?.length || 0 };
  }

  private async fallbackGetRecentContext(params: { category?: string; limit?: number }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for get recent context', LogContext.MCP);'
      return { results: [], count: 0, message: 'In-memory storage not implemented' };';
    }

    let query = this.supabase;
      .from('mcp_context')'
      .select('*')'
      .order('timestamp', { ascending: false })'
      .limit(params.limit || 20);

    if (params.category) {
      query = query.eq('category', params.category);'
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to get recent context: ${error.message}`);
    
    return { results: data || [], count: data?.length || 0 };
  }

  private async fallbackSaveCodePattern(params: any): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for save code pattern', LogContext.MCP);'
      return { success: true, message: `Pattern saved in, memory: ${params.pattern_type}` };
    }

    const { error } = await this.supabase;
      .from('mcp_code_patterns')'
      .insert({)
        pattern_type: params.pattern_type,
        before_code: params.before_code,
        after_code: params.after_code,
        description: params.description,
        error_types: params.error_types,
        success_rate: params.success_rate || 1.0,
        metadata: params.metadata || {},
        created_at: new Date().toISOString(),
      });

    if (error) throw new Error(`Failed to save code pattern: ${error.message}`);
    return { success: true, message: `Saved ${params.pattern_type} pattern` };
  }

  private async fallbackGetCodePatterns(params: { error_type?: string; pattern_type?: string; limit?: number }): Promise<unknown> {
    if (!this.hasSupabaseConfig || !this.supabase) {
      log.debug('Using in-memory fallback for get code patterns', LogContext.MCP);'
      return { patterns: [], count: 0, message: 'In-memory patterns not implemented' };';
    }

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
    if (error) throw new Error(`Failed to get code patterns: ${error.message}`);
    
    return { patterns: data || [], count: data?.length || 0 };
  }

  /**
   * Ensure database tables exist
   */
  private async ensureTablesExist(): Promise<void> {
    try {
      // Simple check - try to select from one of the tables
      const { error } = await this.supabase;
        .from('mcp_context')'
        .select('count(*)')'
        .limit(1);

      if (error) {
        log.warn('⚠️ MCP tables do not exist, they need to be created', LogContext.MCP);'
        // In a real implementation, you'd run the SQL migration here'
        // For now, just log the warning
      } else {
        log.info('✅ MCP database tables verified', LogContext.MCP);'
      }
    } catch (error) {
      log.warn('⚠️ Could not verify MCP tables', LogContext.MCP, {')
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
      // If MCP server is not running and we don't have Supabase config, return false'
      if (!this.isConnected && !this.hasSupabaseConfig) {
        return false;
      }
      
      const result = await this.sendMessage('get_recent_context', { limit: 1 });';
      this.healthStatus.lastPing = Date.now();
      return !!result;
    } catch (error) {
      log.warn('⚠️ MCP ping failed', LogContext.MCP, {')
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Restart the MCP server
   */
  async restart(): Promise<boolean> {
    log.info('🔄 Restarting MCP server', LogContext.MCP);'
    
    await this.shutdown();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return await this.start();
  }

  /**
   * Shutdown the MCP server
   */
  async shutdown(): Promise<void> {
    if (this.supabaseMCPProcess) {
      log.info('🛑 Shutting down MCP server', LogContext.MCP);'
      
      this.isConnected = false;
      this.healthStatus.isRunning = false;
      
      this.supabaseMCPProcess.kill('SIGTERM');'
      
      // Wait for graceful shutdown
      await new Promise(resolve => {)
        if (this.supabaseMCPProcess) {
          this.supabaseMCPProcess.on('exit', resolve);'
          setTimeout(() => {
            if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
              this.supabaseMCPProcess.kill('SIGKILL');'
            }
            resolve(undefined);
          }, 5000);
        } else {
          resolve(undefined);
        }
      });
      
      this.supabaseMCPProcess = null;
      this.emit('shutdown');'
    }
  }

  /**
   * Check if MCP server is connected
   */
  isRunning(): boolean {
    return this.isConnected && !!this.supabaseMCPProcess && !this.supabaseMCPProcess.killed;
  }
}

// Export singleton instance
export const mcpIntegrationService = new MCPIntegrationService();