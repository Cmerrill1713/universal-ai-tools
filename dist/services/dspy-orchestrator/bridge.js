import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import { log, LogContext } from '../../utils/logger';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class DSPyBridge extends EventEmitter {
    ws = null;
    pythonProcess = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 1000;
    isConnected = false;
    port = 8766;
    constructor() {
        super();
        this.startPythonService().catch((error) => {
            log.error('Failed to start DSPy service:', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }
    async startPythonService() {
        let serverPath = path.join(__dirname, 'server.py');
        const srcPath = path.join(process.cwd(), 'src', 'services', 'dspy-orchestrator', 'server.py');
        try {
            const { existsSync } = await import('fs');
            if (!existsSync(serverPath) && existsSync(srcPath)) {
                serverPath = srcPath;
            }
        }
        catch { }
        const portInUse = await new Promise((resolve) => {
            const socket = net.createConnection({ host: '127.0.0.1', port: this.port });
            socket.on('connect', () => {
                socket.end();
                resolve(true);
            });
            socket.on('error', () => resolve(false));
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
        this.pythonProcess = spawn('python3', [serverPath], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, DSPY_PORT: this.port.toString() },
        });
        this.pythonProcess.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            if (output.includes('DSPy server ready') ||
                output.includes('Starting DSPy server on') ||
                output.includes('🚀 DSPy ready')) {
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
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.connectWebSocket();
    }
    connectWebSocket() {
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
                const response = JSON.parse(data.toString());
                this.emit('response', response);
            }
            catch (error) {
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
    attemptReconnect() {
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
    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected || !this.ws) {
                reject(new Error('DSPy service not connected'));
                return;
            }
            const timeout = setTimeout(() => {
                reject(new Error('DSPy request timeout'));
            }, 30000);
            const responseHandler = (response) => {
                if (response.requestId === request.requestId) {
                    clearTimeout(timeout);
                    this.off('response', responseHandler);
                    resolve(response);
                }
            };
            this.on('response', responseHandler);
            try {
                this.ws.send(JSON.stringify(request));
            }
            catch (error) {
                clearTimeout(timeout);
                this.off('response', responseHandler);
                reject(error);
            }
        });
    }
    isReady() {
        return this.isConnected;
    }
    async shutdown() {
        log.info('🛑 Shutting down DSPy service', LogContext.AI);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.pythonProcess) {
            this.pythonProcess.kill('SIGTERM');
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
export const dspyBridge = new DSPyBridge();
export default dspyBridge;
//# sourceMappingURL=bridge.js.map