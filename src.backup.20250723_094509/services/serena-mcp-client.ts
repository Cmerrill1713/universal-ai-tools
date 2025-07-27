/**
 * Serena MCP Client Service
 * Manages connections and tool execution for Serena MCP tools
 */

import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SerenaToolResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    toolName: string;
    parameters: any;
  };
}

export interface SerenaToolDefinition {
  name: string;
  description: string;
  category: 'file' | 'code' | 'symbol' | 'memory' | 'shell' | 'project' | 'thinking' | 'other';
  parameters: Record<string, any>;
  requiredParams: string[];
}

export interface SerenaMCPConfig {
  endpoint: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class SerenaMCPClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private requestQueue: Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  
  private tools: Map<string, SerenaToolDefinition> = new Map();
  private connectionRetries = 0;
  private maxRetries = 3;
  
  constructor(
    private config: SerenaMCPConfig,
    private supabase?: SupabaseClient
  ) {
    super();
    this.initializeTools();
  }
  
  /**
   * Initialize available Serena tools
   */
  private initializeTools(): void {
    // File Operations
    this.registerTool({
      name: 'read_file',
      description: 'Read file contents with line numbers',
      category: 'file',
      parameters: { file_path: 'string', offset: 'number?', limit: 'number?' },
      requiredParams: ['file_path']
    });
    
    this.registerTool({
      name: 'create_text_file',
      description: 'Create new text file',
      category: 'file',
      parameters: { file_path: 'string', content: 'string' },
      requiredParams: ['file_path', 'content']
    });
    
    this.registerTool({
      name: 'list_dir',
      description: 'List directory contents',
      category: 'file',
      parameters: { path: 'string', recursive: 'boolean?' },
      requiredParams: ['path']
    });
    
    this.registerTool({
      name: 'find_file',
      description: 'Search for files by pattern',
      category: 'file',
      parameters: { pattern: 'string', path: 'string?' },
      requiredParams: ['pattern']
    });
    
    // Code Manipulation
    this.registerTool({
      name: 'replace_regex',
      description: 'Regex-based text replacement',
      category: 'code',
      parameters: { file_path: 'string', pattern: 'string', replacement: 'string' },
      requiredParams: ['file_path', 'pattern', 'replacement']
    });
    
    this.registerTool({
      name: 'replace_symbol_body',
      description: 'Replace entire symbol definition',
      category: 'code',
      parameters: { symbol_name: 'string', new_body: 'string' },
      requiredParams: ['symbol_name', 'new_body']
    });
    
    this.registerTool({
      name: 'insert_after_symbol',
      description: 'Insert code after symbol',
      category: 'code',
      parameters: { symbol_name: 'string', content: 'string' },
      requiredParams: ['symbol_name', 'content']
    });
    
    this.registerTool({
      name: 'insert_before_symbol',
      description: 'Insert code before symbol',
      category: 'code',
      parameters: { symbol_name: 'string', content: 'string' },
      requiredParams: ['symbol_name', 'content']
    });
    
    // Symbol Navigation
    this.registerTool({
      name: 'find_symbol',
      description: 'Find language-aware symbols',
      category: 'symbol',
      parameters: { name: 'string', type: 'string?' },
      requiredParams: ['name']
    });
    
    this.registerTool({
      name: 'find_referencing_symbols',
      description: 'Find symbol references',
      category: 'symbol',
      parameters: { symbol_name: 'string' },
      requiredParams: ['symbol_name']
    });
    
    this.registerTool({
      name: 'get_symbols_overview',
      description: 'Get project symbol overview',
      category: 'symbol',
      parameters: { file_path: 'string?' },
      requiredParams: []
    });
    
    // Pattern Search
    this.registerTool({
      name: 'search_for_pattern',
      description: 'Advanced pattern search',
      category: 'code',
      parameters: { pattern: 'string', include_context: 'boolean?' },
      requiredParams: ['pattern']
    });
    
    // Memory Management
    this.registerTool({
      name: 'write_memory',
      description: 'Store persistent memory',
      category: 'memory',
      parameters: { key: 'string', value: 'any' },
      requiredParams: ['key', 'value']
    });
    
    this.registerTool({
      name: 'read_memory',
      description: 'Retrieve memory',
      category: 'memory',
      parameters: { key: 'string' },
      requiredParams: ['key']
    });
    
    this.registerTool({
      name: 'list_memories',
      description: 'List all memories',
      category: 'memory',
      parameters: { pattern: 'string?' },
      requiredParams: []
    });
    
    this.registerTool({
      name: 'delete_memory',
      description: 'Remove memory',
      category: 'memory',
      parameters: { key: 'string' },
      requiredParams: ['key']
    });
    
    // Shell Execution
    this.registerTool({
      name: 'execute_shell_command',
      description: 'Safe shell command execution',
      category: 'shell',
      parameters: { command: 'string', cwd: 'string?' },
      requiredParams: ['command']
    });
    
    // Project Management
    this.registerTool({
      name: 'activate_project',
      description: 'Activate project context',
      category: 'project',
      parameters: { project_path: 'string' },
      requiredParams: ['project_path']
    });
    
    this.registerTool({
      name: 'remove_project',
      description: 'Remove project registration',
      category: 'project',
      parameters: { project_id: 'string' },
      requiredParams: ['project_id']
    });
    
    this.registerTool({
      name: 'switch_modes',
      description: 'Switch operational modes',
      category: 'project',
      parameters: { mode: 'string' },
      requiredParams: ['mode']
    });
    
    // Thinking Tools
    this.registerTool({
      name: 'think_about_collected_information',
      description: 'Analyze gathered information',
      category: 'thinking',
      parameters: { context: 'string' },
      requiredParams: ['context']
    });
    
    this.registerTool({
      name: 'think_about_task_adherence',
      description: 'Verify task completion',
      category: 'thinking',
      parameters: { task: 'string', progress: 'string' },
      requiredParams: ['task', 'progress']
    });
    
    this.registerTool({
      name: 'think_about_whether_you_are_done',
      description: 'Check if task is complete',
      category: 'thinking',
      parameters: { task: 'string', results: 'string' },
      requiredParams: ['task', 'results']
    });
    
    // Other Tools
    this.registerTool({
      name: 'restart_language_server',
      description: 'Restart LSP for fresh state',
      category: 'other',
      parameters: {},
      requiredParams: []
    });
    
    this.registerTool({
      name: 'summarize_changes',
      description: 'Summarize code changes',
      category: 'other',
      parameters: { changes: 'string[]' },
      requiredParams: ['changes']
    });
    
    this.registerTool({
      name: 'prepare_for_new_conversation',
      description: 'Reset conversation state',
      category: 'other',
      parameters: {},
      requiredParams: []
    });
    
    logger.info(`Registered ${this.tools.size} Serena MCP tools`, LogContext.SYSTEM);
  }
  
  private registerTool(tool: SerenaToolDefinition): void {
    this.tools.set(tool.name, tool);
  }
  
  /**
   * Connect to Serena MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      logger.warn('Already connected to Serena MCP', LogContext.SYSTEM);
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.endpoint, {
          headers: this.config.apiKey ? {
            'Authorization': `Bearer ${this.config.apiKey}`
          } : undefined
        });
        
        this.ws.on('open', () => {
          logger.info('Connected to Serena MCP server', LogContext.SYSTEM);
          this.connected = true;
          this.connectionRetries = 0;
          this.emit('connected');
          
          // Send initial handshake
          this.sendMessage({
            type: 'handshake',
            version: '1.0',
            client: 'universal-ai-tools'
          });
          
          resolve();
        });
        
        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });
        
        this.ws.on('error', (error) => {
          logger.error('Serena MCP WebSocket error', LogContext.SYSTEM, { error });
          this.emit('error', error);
          
          if (!this.connected) {
            reject(error);
          }
        });
        
        this.ws.on('close', () => {
          logger.info('Disconnected from Serena MCP server', LogContext.SYSTEM);
          this.connected = false;
          this.emit('disconnected');
          
          // Attempt reconnection
          if (this.connectionRetries < this.maxRetries) {
            this.connectionRetries++;
            setTimeout(() => {
              this.connect().catch(err => {
                logger.error('Reconnection failed', LogContext.SYSTEM, { error: err });
              });
            }, this.config.retryDelay || 5000);
          }
        });
        
      } catch (error) {
        logger.error('Failed to connect to Serena MCP', LogContext.SYSTEM, { error });
        reject(error);
      }
    });
  }
  
  /**
   * Execute a Serena tool
   */
  async executeToolCall(toolName: string, params: any = {}): Promise<SerenaToolResult> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to Serena MCP server');
    }
    
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    // Validate required parameters
    for (const param of tool.requiredParams) {
      if (!(param in params)) {
        throw new Error(`Missing required parameter: ${param}`);
      }
    }
    
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.requestQueue.delete(requestId);
        reject(new Error(`Tool execution timeout: ${toolName}`));
      }, this.config.timeout || 30000);
      
      // Store request handler
      this.requestQueue.set(requestId, { resolve, reject, timeout });
      
      // Send tool execution request
      this.sendMessage({
        type: 'execute',
        requestId,
        tool: toolName,
        params
      });
      
      // Log execution
      logger.info(`Executing Serena tool: ${toolName}`, LogContext.API, { params });
      
    }).then((result: any) => {
      const executionTime = Date.now() - startTime;
      
      // Store execution history if Supabase is available
      if (this.supabase) {
        this.supabase.from('serena_tool_executions').insert({
          tool_name: toolName,
          parameters: params,
          result,
          execution_time_ms: executionTime,
          success: true,
          created_at: new Date().toISOString()
        }).then();
      }
      
      return {
        success: true,
        result,
        metadata: {
          executionTime,
          toolName,
          parameters: params
        }
      };
    }).catch((error) => {
      const executionTime = Date.now() - startTime;
      
      // Store error in history
      if (this.supabase) {
        this.supabase.from('serena_tool_executions').insert({
          tool_name: toolName,
          parameters: params,
          error: error.message,
          execution_time_ms: executionTime,
          success: false,
          created_at: new Date().toISOString()
        }).then();
      }
      
      logger.error(`Serena tool execution failed: ${toolName}`, LogContext.API, { error, params });
      
      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime,
          toolName,
          parameters: params
        }
      };
    });
  }
  
  /**
   * Execute multiple tools in sequence
   */
  async executeToolChain(
    tools: Array<{ name: string; params: any; transformResult?: (result: any) => any }>
  ): Promise<SerenaToolResult[]> {
    const results: SerenaToolResult[] = [];
    let previousResult: any = null;
    
    for (const tool of tools) {
      // Allow using previous result in params
      const params = typeof tool.params === 'function' 
        ? tool.params(previousResult) 
        : tool.params;
      
      const result = await this.executeToolCall(tool.name, params);
      results.push(result);
      
      if (!result.success) {
        break; // Stop chain on error
      }
      
      previousResult = tool.transformResult 
        ? tool.transformResult(result.result)
        : result.result;
    }
    
    return results;
  }
  
  /**
   * Get available tools by category
   */
  getToolsByCategory(category: string): SerenaToolDefinition[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }
  
  /**
   * Get all available tools
   */
  getAllTools(): SerenaToolDefinition[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * Handle incoming messages from Serena
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'response':
          this.handleToolResponse(message);
          break;
          
        case 'error':
          this.handleErrorMessage(message);
          break;
          
        case 'handshake_ack':
          logger.info('Serena MCP handshake acknowledged', LogContext.SYSTEM);
          break;
          
        case 'event':
          this.emit('serena_event', message.event);
          break;
          
        default:
          logger.warn(`Unknown message type from Serena: ${message.type}`, LogContext.SYSTEM);
      }
    } catch (error) {
      logger.error('Failed to parse Serena message', LogContext.SYSTEM, { error, data });
    }
  }
  
  /**
   * Handle tool execution response
   */
  private handleToolResponse(message: any): void {
    const { requestId, result, error } = message;
    const request = this.requestQueue.get(requestId);
    
    if (!request) {
      logger.warn(`Received response for unknown request: ${requestId}`, LogContext.SYSTEM);
      return;
    }
    
    clearTimeout(request.timeout);
    this.requestQueue.delete(requestId);
    
    if (error) {
      request.reject(new Error(error));
    } else {
      request.resolve(result);
    }
  }
  
  /**
   * Handle error messages
   */
  private handleErrorMessage(message: any): void {
    const { requestId, error } = message;
    
    if (requestId) {
      const request = this.requestQueue.get(requestId);
      if (request) {
        clearTimeout(request.timeout);
        this.requestQueue.delete(requestId);
        request.reject(new Error(error));
      }
    } else {
      logger.error('Serena MCP error', LogContext.SYSTEM, { error });
      this.emit('error', new Error(error));
    }
  }
  
  /**
   * Send message to Serena
   */
  private sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.ws.send(JSON.stringify(message));
  }
  
  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Disconnect from Serena
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      // Clear all pending requests
      for (const [requestId, request] of this.requestQueue) {
        clearTimeout(request.timeout);
        request.reject(new Error('Client disconnecting'));
      }
      this.requestQueue.clear();
      
      // Close WebSocket
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Create Serena MCP client instance
 */
export function createSerenaMCPClient(
  config: SerenaMCPConfig,
  supabase?: SupabaseClient
): SerenaMCPClient {
  return new SerenaMCPClient(config, supabase);
}