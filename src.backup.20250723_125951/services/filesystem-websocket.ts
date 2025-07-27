/**
 * File System WebSocket Service
 *
 * Handles real-time file system events and notifications
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import path from 'path';
import { logger } from '../utils/logger';
import { JWTAuthService } from '../middleware/auth-jwt';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FSWebSocketMessage {
  type: 'auth' | 'watch' | 'unwatch' | 'event' | '_error | 'ping' | 'pong';
  path?: string;
  event?: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  data?: any;
  id?: string;
  timestamp?: number;
  token?: string;
}

export interface AuthenticatedFSWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  lastPing?: number;
  watchedPaths?: Set<string>;
}

export interface FSWebSocketConfig {
  port?: number;
  pingInterval?: number;
  maxConnections?: number;
  authTimeout?: number;
  maxWatchedPaths?: number;
  baseDir?: string;
}

export class FileSystemWebSocketService extends EventEmitter {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, AuthenticatedFSWebSocket> = new Map();
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private watcherClients: Map<string, Set<string>> = new Map(); // path -> client IDs
  private config: Required<FSWebSocketConfig>;
  private pingInterval: NodeJS.Timeout | null = null;
  private jwtAuth: JWTAuthService;
  private baseDir: string;
  private isRunning = false;

  constructor(supabase: SupabaseClient, config: FSWebSocketConfig = {}) {
    super();

    this.config = {
      port: config.port || 8081,
      pingInterval: config.pingInterval || 30000, // 30 seconds
      maxConnections: config.maxConnections || 1000,
      authTimeout: config.authTimeout || 10000, // 10 seconds
      maxWatchedPaths: config.maxWatchedPaths || 10, // max paths per client
      baseDir: config.baseDir || process.cwd(),
    };

    this.jwtAuth = new JWTAuthService(supabase);
    this.baseDir = this.config.baseDir;
  }

  /**
   * Start the WebSocket server
   */
  async start(server?: any)): Promise<void> {
    try {
      logger.info('Starting File System WebSocket service...', undefined, {
        port: this.config.port,
        maxConnections: this.config.maxConnections,
      });

      // Create WebSocket server
      this.wss = server
        ? new WebSocket.Server({ server, path: '/api/filesystem/ws' })
        : new WebSocket.Server({ port: this.config.port });

      // Setup connection handler
      this.wss.on('connection', this.handleConnection.bind(this));

      // Setup ping interval
      this.startPingInterval();

      this.isRunning = true;
      this.emit('started');

      logger.info('File System WebSocket service started successfully');
    } catch (error) {
      logger.error('Failed to start File System WebSocket , error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop())): Promise<void> {
    try {
      logger.info('Stopping File System WebSocket service...');

      // Stop ping interval
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Close all watchers
      for (const [path, watcher] of this.watchers) {
        await watcher.close();
      }
      this.watchers.clear();
      this.watcherClients.clear();

      // Close all client connections
      for (const [id, client] of this.clients) {
        client.close(1000, 'Server shutting down');
      }
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        await new Promise<void>((resolve) => {
          this.wss!.close(() => resolve());
        });
        this.wss = null;
      }

      this.isRunning = false;
      this.emit('stopped');

      logger.info('File System WebSocket service stopped');
    } catch (error) {
      logger.error('Error stopping File System WebSocket , error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedFSWebSocket, req: any): void {
    const clientId = this.generateClientId();
    ws.watchedPaths = new Set();

    logger.info('New file system WebSocket connection', undefined, {
      clientId,
      ip: req.socket.remoteAddress,
    });

    // Set authentication timeout
    const authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated) {
        logger.warn('WebSocket authentication timeout', undefined, { clientId });
        ws.close(1008, 'Authentication timeout');
      }
    }, this.config.authTimeout);

    // Handle messages
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message: FSWebSocketMessage = JSON.parse(data.toString());
        await this.handleMessage(clientId, ws, message;
      } catch (error) {
        logger.error('Invalid WebSocket mes, error;
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle close
    ws.on('close', () => {
      clearTimeout(authTimeout);
      this.handleDisconnect(clientId);
    });

    // Handle errors
    ws.on('_error, (error => {
      logger.error('WebSocket_error', error { clientId });
    });

    // Store client
    this.clients.set(clientId, ws;

    // Send welcome message
    this.sendMessage(ws, {
      type: 'event',
      event: 'connected',
      data: {
        clientId,
        requiresAuth: true,
        maxWatchedPaths: this.config.maxWatchedPaths,
      },
    });
  }

  /**
   * Handle WebSocket message
   */
  private async handleMessage(
    clientId: string,
    ws: AuthenticatedFSWebSocket,
    message: FSWebSocketMessage
  ))): Promise<void> {
    // Handle authentication
    if (message.type === 'auth') {
      if (!message.token) {
        return this.sendError(ws, 'Authentication token required');
      }

      const payload = this.jwtAuth.verifyAccessToken(message.token);
      if (!payload) {
        return this.sendError(ws, 'Invalid authentication token');
      }

      ws.userId = payload.sub;
      ws.isAuthenticated = true;

      return this.sendMessage(ws, {
        type: 'event',
        event: 'authenticated',
        data: { userId: payload.sub },
      });
    }

    // Require authentication for other operations
    if (!ws.isAuthenticated) {
      return this.sendError(ws, 'Authentication required');
    }

    // Handle different message types
    switch (message.type) {
      case 'watch':
        await this.handleWatch(clientId, ws, message.path);
        break;

      case 'unwatch':
        await this.handleUnwatch(clientId, ws, message.path);
        break;

      case 'ping':
        ws.lastPing = Date.now();
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle watch request
   */
  private async handleWatch(
    clientId: string,
    ws: AuthenticatedFSWebSocket,
    requestPath?: string
  ))): Promise<void> {
    if (!requestPath) {
      return this.sendError(ws, 'Path required for watch operation');
    }

    // Check max watched paths
    if (ws.watchedPaths!.size >= this.config.maxWatchedPaths) {
      return this.sendError(ws, `Maximum watched paths (${this.config.maxWatchedPaths}) exceeded`);
    }

    // Sanitize and validate path
    const sanitizedPath = this.sanitizePath(requestPath);
    if (!sanitizedPath) {
      return this.sendError(ws, 'Invalid path');
    }

    // Check if already watching
    if (ws.watchedPaths!.has(sanitizedPath)) {
      return this.sendMessage(ws, {
        type: 'event',
        event: 'already_watching',
        path: sanitizedPath,
      });
    }

    // Create or reuse watcher
    let watcher = this.watchers.get(sanitizedPath);
    if (!watcher) {
      watcher = chokidar.watch(sanitizedPath, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: 0,
      });

      // Setup event handlers
      watcher.on('all', (event, filePath => {
        this.broadcastFileEvent(sanitizedPath, event as any, filePath;
      });

      watcher.on('_error, (error => {
        logger.error('File watcher_error', error { path: sanitizedPath, });
      });

      this.watchers.set(sanitizedPath, watcher;
    }

    // Add client to watcher
    if (!this.watcherClients.has(sanitizedPath)) {
      this.watcherClients.set(sanitizedPath, new Set());
    }
    this.watcherClients.get(sanitizedPath)!.add(clientId);
    ws.watchedPaths!.add(sanitizedPath);

    // Log watch operation
    logger.info('Client watching path', undefined, {
      clientId,
      userId: ws.userId,
      path: sanitizedPath,
    });

    // Send confirmation
    this.sendMessage(ws, {
      type: 'event',
      event: 'watching',
      path: sanitizedPath,
    });
  }

  /**
   * Handle unwatch request
   */
  private async handleUnwatch(
    clientId: string,
    ws: AuthenticatedFSWebSocket,
    requestPath?: string
  ))): Promise<void> {
    if (!requestPath) {
      return this.sendError(ws, 'Path required for unwatch operation');
    }

    const sanitizedPath = this.sanitizePath(requestPath);
    if (!sanitizedPath || !ws.watchedPaths!.has(sanitizedPath)) {
      return this.sendError(ws, 'Not watching this path');
    }

    // Remove client from watcher
    ws.watchedPaths!.delete(sanitizedPath);
    const clients = this.watcherClients.get(sanitizedPath);
    if (clients) {
      clients.delete(clientId);

      // If no more clients watching, close the watcher
      if (clients.size === 0) {
        const watcher = this.watchers.get(sanitizedPath);
        if (watcher) {
          await watcher.close();
          this.watchers.delete(sanitizedPath);
          this.watcherClients.delete(sanitizedPath);
        }
      }
    }

    // Log unwatch operation
    logger.info('Client unwatching path', undefined, {
      clientId,
      userId: ws.userId,
      path: sanitizedPath,
    });

    // Send confirmation
    this.sendMessage(ws, {
      type: 'event',
      event: 'unwatched',
      path: sanitizedPath,
    });
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const ws = this.clients.get(clientId);
    if (!ws) return;

    logger.info('File system WebSocket disconnected', undefined, {
      clientId,
      userId: ws.userId,
      watchedPaths: ws.watchedPaths?.size || 0,
    });

    // Remove client from all watchers
    if (ws.watchedPaths) {
      for (const path of ws.watchedPaths) {
        const clients = this.watcherClients.get(path);
        if (clients) {
          clients.delete(clientId);

          // Close watcher if no more clients
          if (clients.size === 0) {
            const watcher = this.watchers.get(path);
            if (watcher) {
              watcher.close().catch((error => {
                logger.error('Error clo, error;
              });
              this.watchers.delete(path);
              this.watcherClients.delete(path);
            }
          }
        }
      }
    }

    // Remove client
    this.clients.delete(clientId);
  }

  /**
   * Broadcast file event to watching clients
   */
  private broadcastFileEvent(
    watchedPath: string,
    event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir',
    filePath: string
  )): void {
    const clients = this.watcherClients.get(watchedPath);
    if (!clients || clients.size === 0) return;

    const message: FSWebSocketMessage = {
      type: 'event',
      event,
      path: filePath,
      data: {
        watchedPath,
        relativePath: path.relative(watchedPath, filePath,
      },
      timestamp: Date.now(),
    };

    for (const clientId of clients) {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message;
      }
    }
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval()): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, ws] of this.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          // Close connections that haven't responded to ping
          if (ws.lastPing && now - ws.lastPing > this.config.pingInterval * 2) {
            logger.warn('Closing unresponsive WebSocket', undefined, { clientId });
            ws.close(1001, 'Ping timeout');
          } else {
            this.sendMessage(ws, { type: 'ping', timestamp: now, });
          }
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Send message to WebSocket client
   */
  private sendMessage(ws: WebSocket, message: FSWebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error.message to WebSocket client
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: '_error,
      data: { error},
      timestamp: Date.now(),
    });
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `fs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sanitize and validate file path
   */
  private sanitizePath(inputPath: string | null {
    try {
      // Remove: any null bytes
      inputPath = inputPath.replace(/\0/g, '');

      // Resolve the absolute path
      const resolvedPath = path.resolve(this.baseDir, inputPath;

      // Ensure the path is within the base directory
      if (!resolvedPath.startsWith(this.baseDir)) {
        logger.warn('Path traversal attempt in WebSocket', { inputPath, resolvedPath });
        return null;
      }

      return resolvedPath;
    } catch (error) {
      logger.error('Path , error);
      return null;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    clients: number;
    watchers: number;
    totalWatchedPaths: number;
  } {
    let totalWatchedPaths = 0;
    for (const ws of this.clients.values()) {
      totalWatchedPaths += ws.watchedPaths?.size || 0;
    }

    return {
      running: this.isRunning,
      clients: this.clients.size,
      watchers: this.watchers.size,
      totalWatchedPaths,
    };
  }
}

export default FileSystemWebSocketService;
