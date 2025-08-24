import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

import { log, LogContext } from '../../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DSPyRequest {
  requestId: string;
  method: string;
  params: unknown;
  metadata?: unknown;
}

export interface DSPyResponse {
  requestId: string;
  success: boolean;
  data: unknown;
  error?: string;
  metadata?: unknown;
}

export class DSPyBridge extends EventEmitter {
  private ws: WebSocket | null = null;
  private pythonProcess: ChildProcess | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private port = 8766;

  constructor() {
    super();
    this.startPythonService().catch((error) => {
      log.error('Failed to start DSPy service:', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async startPythonService(): Promise<void> {
    // Prefer compiled path; if missing, fall back to source path
    let serverPath = path.join(__dirname, 'server.py');
    const srcPath = path.join(process.cwd(), 'src', 'services', 'dspy-orchestrator', 'server.py');
    try {
      const { existsSync } = await import('fs');
      if (!existsSync(serverPath) && existsSync(srcPath)) {
        serverPath = srcPath;
      }
    } catch {}

    // If port already in use, just connect without spawning another process
    const portInUse = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: '127.0.0.1', port: this.port });
      socket.on('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      // Safety timeout
      setTimeout(() => resolve(false), 500);
    });

    if (portInUse) {
      log.info('DSPy port already in use, skipping spawn and connecting', LogContext.AI, {
        port: this.port,
      });
      this.connectWebSocket();
      return;
    }

    log.info('🚀 Starting DSPy Python service', LogContext.AI, {
      serverPath,
      port: this.port,
    });

    // Try different Python executables in order of preference
    const pythonExecutables = ['python3.12', 'python3', 'python'];
    let pythonExe = 'python3';
    
    for (const exe of pythonExecutables) {
      try {
        const testResult = await new Promise<boolean>((resolve) => {
          const testProc = spawn(exe, ['--version'], { stdio: 'pipe' });
          testProc.on('close', (code) => resolve(code === 0));
          testProc.on('error', () => resolve(false));
          setTimeout(() => resolve(false), 1000);
        });
        if (testResult) {
          pythonExe = exe;
          break;
        }
      } catch {}
    }

    log.info('Using Python executable:', LogContext.AI, { pythonExe });

    this.pythonProcess = spawn(pythonExe, [serverPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DSPY_PORT: this.port.toString() },
    });

    this.pythonProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      // Connect as soon as server indicates readiness in any form
      if (
        output.includes('DSPy server ready') ||
        output.includes('Starting DSPy server on') ||
        output.includes('🚀 DSPy ready')
      ) {
        this.connectWebSocket();
      }
      log.info('DSPy server output', LogContext.AI, { output });
    });

    this.pythonProcess.stderr?.on('data', (data) => {
      const error = data.toString().trim();
      log.warn('DSPy server error', LogContext.AI, { error });
    });

    this.pythonProcess.on('exit', (code) => {
      log.info('DSPy server exited', LogContext.AI, { code });
      this.isConnected = false;
      this.pythonProcess = null;
    });

    // Wait for server to start, then attempt an initial connection regardless of stdout
    await new Promise((resolve) => setTimeout(resolve, 2000));
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = `ws://localhost:${this.port}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      log.info('✅ Connected to DSPy service', LogContext.AI, { port: this.port });
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      try {
        const response: DSPyResponse = JSON.parse(data.toString());
        this.emit('response', response);
      } catch (error) {
        log.error('Failed to parse DSPy response', LogContext.AI, { error });
      }
    });

    this.ws.on('close', () => {
      log.warn('DSPy WebSocket closed', LogContext.AI);
      this.isConnected = false;
      this.emit('disconnected');
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      log.error('DSPy WebSocket error', LogContext.AI, { error });
      this.isConnected = false;
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error('Max reconnection attempts reached', LogContext.AI);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    log.info('Attempting to reconnect to DSPy service', LogContext.AI, {
      attempt: this.reconnectAttempts,
      delay,
    });

    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  public async sendRequest(request: DSPyRequest): Promise<DSPyResponse> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.ws) {
        reject(new Error('DSPy service not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('DSPy request timeout'));
      }, 30000);

      const responseHandler = (response: DSPyResponse) => {
        if (response.requestId === request.requestId) {
          clearTimeout(timeout);
          this.off('response', responseHandler);
          resolve(response);
        }
      };

      this.on('response', responseHandler);

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        clearTimeout(timeout);
        this.off('response', responseHandler);
        reject(error);
      }
    });
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down DSPy service', LogContext.AI);

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        if (!this.pythonProcess) {
          resolve(void 0);
          return;
        }

        const timeout = setTimeout(() => {
          if (this.pythonProcess) {
            this.pythonProcess.kill('SIGKILL');
          }
          resolve(void 0);
        }, 5000);

        this.pythonProcess.on('exit', () => {
          clearTimeout(timeout);
          resolve(void 0);
        });
      });

      this.pythonProcess = null;
    }

    this.isConnected = false;
  }
}

// Singleton instance
export const dspyBridge = new DSPyBridge();
export default dspyBridge;
