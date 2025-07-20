import WebSocket from 'ws';
import { logger, LogContext } from '../../utils/enhanced-logger';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { SmartPortManager } from '../../utils/smart-port-manager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DSPyRequest {
  requestId: string;
  method: string;
  params: any;
  metadata?: any;
}

export interface DSPyResponse {
  requestId: string;
  success: boolean;
  data: any;
  error?: string;
  metadata?: any;
}

export class DSPyBridge extends EventEmitter {
  private ws: WebSocket | null = null;
  private pythonProcess: ChildProcess | null = null;
  private isConnected = false;
  private requestQueue: Map<string, (response: DSPyResponse) => void> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private port = 8766;
  private portManager: SmartPortManager;
  private startupPromise: Promise<void> | null = null;

  constructor() {
    super();
    this.portManager = new SmartPortManager([{
      name: 'dspy-service',
      defaultPort: 8766,
      fallbackPorts: [8767, 8768, 8769, 8770],
      isRequired: false,
      serviceType: 'ai',
      protocol: 'tcp'
    }]);
    
    // Don't block constructor - start service asynchronously
    this.startupPromise = this.startPythonService().catch(error => {
      logger.error('Failed to start DSPy service:', LogContext.DSPY, { error: error instanceof Error ? error.message : String(error) });
    });
  }

  private async startPythonService(): Promise<void> {
    try {
      logger.info('🐍 Starting real DSPy Python service with MIPRO optimization...');
      
      // Find an available port
      const availablePort = await this.portManager.resolvePortConflict('dspy-service', this.port);
      this.port = availablePort;
      logger.info(`Using port ${this.port} for DSPy service`);
      
      const pythonScript = path.join(__dirname, 'server.py');
      this.pythonProcess = spawn('python', [pythonScript], {
        cwd: __dirname,
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1',
          NODE_ENV: process.env.NODE_ENV || 'development',
          DSPY_PORT: this.port.toString() // Pass the port to Python
        }
      });

      this.pythonProcess.stdout?.on('data', (data) => {
        logger.info(`DSPy Server: ${data.toString()}`);
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        logger.error(`DSPy Server Error: ${data.toString()}`, LogContext.DSPY);
      });

      this.pythonProcess.on('exit', (code) => {
        logger.warn(`DSPy server process exited with code ${code}`);
        this.handleDisconnect();
      });

      // Give Python service time to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.connectWebSocket();
    } catch (error) {
      logger.error('Failed to start DSPy service:', LogContext.DSPY, { error: error instanceof Error ? error.message : String(error) });
      // Don't schedule reconnect here - let the service fail gracefully
    }
  }

  private connectWebSocket(): void {
    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.on('open', () => {
        logger.info('✅ Connected to DSPy service');
        this.isConnected = true;
        this.emit('connected');
      });

      this.ws.on('message', (data: string) => {
        try {
          const response: DSPyResponse = JSON.parse(data);
          const callback = this.requestQueue.get(response.requestId);
          if (callback) {
            callback(response);
            this.requestQueue.delete(response.requestId);
          }
        } catch (error) {
          logger.error('Failed to parse DSPy response:', LogContext.DSPY, { error: error instanceof Error ? error.message : String(error) });
        }
      });

      this.ws.on('error', (error) => {
        logger.error('DSPy WebSocket error:', LogContext.DSPY, { error: error instanceof Error ? error.message : String(error) });
      });

      this.ws.on('close', () => {
        this.handleDisconnect();
      });
    } catch (error) {
      logger.error('Failed to connect to DSPy service:', LogContext.DSPY, { error: error instanceof Error ? error.message : String(error) });
      this.scheduleReconnect();
    }
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.ws = null;
    this.emit('disconnected');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isConnected) {
        logger.info('🔄 Attempting to reconnect to DSPy service...');
        this.connectWebSocket();
      }
    }, 5000);
  }

  async request(method: string, params: any, timeout = 30000): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('DSPy service is not connected');
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: DSPyRequest = {
      requestId,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.requestQueue.delete(requestId);
        reject(new Error(`DSPy request timeout: ${method}`));
      }, timeout);

      this.requestQueue.set(requestId, (response: DSPyResponse) => {
        clearTimeout(timer);
        if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Unknown DSPy error'));
        }
      });

      this.ws!.send(JSON.stringify(request));
    });
  }

  async orchestrate(userRequest: string, context: any = {}): Promise<any> {
    return this.request('orchestrate', { userRequest, context });
  }

  async coordinateAgents(task: string, agents: string[], context: any = {}): Promise<any> {
    return this.request('coordinate_agents', { task, agents, context });
  }

  async manageKnowledge(operation: string, data: any): Promise<any> {
    return this.request('manage_knowledge', { operation, data });
  }

  async optimizePrompts(examples: any[]): Promise<any> {
    return this.request('optimize_prompts', { examples });
  }

  getStatus(): { connected: boolean; queueSize: number } {
    return {
      connected: this.isConnected,
      queueSize: this.requestQueue.size
    };
  }

  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down DSPy bridge...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }

    this.requestQueue.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
export const dspyBridge = new DSPyBridge();