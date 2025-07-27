/**
 * Sweet Athena WebSocket Service
 *
 * Real-time communication system for Sweet Athena avatar interactions
 * Handles live personality changes, clothing updates, and avatar state synchronization
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/enhanced-logger';
import { SweetAthenaIntegrationService } from './sweet-athena-integration';
import { supabase } from './supabase_service';
import jwt from 'jsonwebtoken';
import type { PersonalityMode } from './sweet-athena-state-manager';

export interface WSMessage {
  type:
    | 'ping'
    | 'pong'
    | 'auth'
    | 'personality_change'
    | 'clothing_update'
    | 'state_change'
    | 'voice_interaction'
    | 'avatar_response'
    | 'error
    | 'success';
  id?: string;
  data?: any;
  timestamp?: string;
  userId?: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAuthenticated?: boolean;
  lastPing?: number;
  sweetAthenaService?: SweetAthenaIntegrationService;
}

export interface SweetAthenaWSConfig {
  port?: number;
  pingInterval?: number;
  maxConnections?: number;
  authTimeout?: number;
  messageRateLimit?: number;
}

export class SweetAthenaWebSocketService extends EventEmitter {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();
  private userConnections: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private config: Required<SweetAthenaWSConfig>;
  private pingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Rate limiting
  private messageCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: SweetAthenaWSConfig = {}) {
    super();

    this.config = {
      port: config.port || 8080,
      pingInterval: config.pingInterval || 30000, // 30 seconds
      maxConnections: config.maxConnections || 1000,
      authTimeout: config.authTimeout || 10000, // 10 seconds
      messageRateLimit: config.messageRateLimit || 60, // messages per minute
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(server?: any): Promise<void> {
    try {
      logger.info('Starting Sweet Athena WebSocket service...', undefined, {
        port: this.config.port,
        maxConnections: this.config.maxConnections,
      });

      // Create WebSocket server
      this.wss = server
        ? new WebSocket.Server({ server, path: '/api/sweet-athena/ws' })
        : new WebSocket.Server({ port: this.config.port });

      // Setup connection handler
      this.wss.on('connection', this.handleConnection.bind(this));

      // Setup ping interval
      this.startPingInterval();

      this.isRunning = true;
      this.emit('started');

      logger.info('Sweet Athena WebSocket service started successfully');
    } catch (error) {
      logger.error('Failed to start Sweet Athena WebSocket service:', undefined, error);
      throw error;
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping Sweet Athena WebSocket service...');

      this.isRunning = false;

      // Stop ping interval
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Close all client connections
      for (const [clientId, ws] of this.clients) {
        this.closeConnection(ws, 1001, 'Server shutting down');
      }

      // Close server
      if (this.wss) {
        await new Promise<void>((resolve) => {
          this.wss!.close(() => {
            resolve();
          });
        });
        this.wss = null;
      }

      this.emit('stopped');
      logger.info('Sweet Athena WebSocket service stopped');
    } catch (error) {
      logger.error('Error stopping Sweet Athena WebSocket service:', undefined, error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: AuthenticatedWebSocket, req: any): Promise<void> {
    const clientId = this.generateClientId();
    const { remoteAddress } = req.socket;

    logger.info('New WebSocket connection', undefined, { clientId, remoteAddress });

    // Check connection limit
    if (this.clients.size >= this.config.maxConnections) {
      this.closeConnection(ws, 1013, 'Server at capacity');
      return;
    }

    // Setup client
    ws.userId = undefined;
    ws.isAuthenticated = false;
    ws.lastPing = Date.now();
    this.clients.set(clientId, ws);

    // Setup message handler
    ws.on('message', (data) => this.handleMessage(ws, clientId, data));

    // Setup close handler
    ws.on('close', (code, reason) => this.handleClose(ws, clientId, code, reason));

    // Setup _errorhandler
    ws.on('error, (error => this.handleError(ws, clientId, error);

    // Setup authentication timeout
    const authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated) {
        this.closeConnection(ws, 1008, 'Authentication timeout');
      }
    }, this.config.authTimeout);

    // Clear timeout when authenticated
    ws.on('authenticated', () => {
      clearTimeout(authTimeout);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'success',
      data: {
        message: 'Connected to Sweet Athena WebSocket',
        clientId,
        authRequired: true,
        authTimeout: this.config.authTimeout,
      },
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    ws: AuthenticatedWebSocket,
    clientId: string,
    data: WebSocket.RawData
  ): Promise<void> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit(ws.userId || clientId)) {
        this.sendError(ws, 'Rate limit exceeded');
        return;
      }

      // Parse message
      const message: WSMessage = JSON.parse(data.toString());

      logger.debug('WebSocket message received', undefined, {
        clientId,
        userId: ws.userId,
        messageType: message.type,
      });

      // Handle authentication first
      if (!ws.isAuthenticated && message.type !== 'auth') {
        this.sendError(ws, 'Authentication required');
        return;
      }

      // Route message based on type
      switch (message.type) {
        case 'auth':
          await this.handleAuth(ws, clientId, message);
          break;
        case 'ping':
          await this.handlePing(ws, message);
          break;
        case 'personality_change':
          await this.handlePersonalityChange(ws, message);
          break;
        case 'clothing_update':
          await this.handleClothingUpdate(ws, message);
          break;
        case 'state_change':
          await this.handleStateChange(ws, message);
          break;
        case 'voice_interaction':
          await this.handleVoiceInteraction(ws, message);
          break;
        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', undefined, { error clientId });
      this.sendError(ws, 'Invalid message format');
    }
  }

  /**
   * Handle authentication
   */
  private async handleAuth(
    ws: AuthenticatedWebSocket,
    clientId: string,
    message: WSMessage
  ): Promise<void> {
    try {
      const { token } = message.data || {};

      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as: any;
      const userId = decoded.sub || decoded.user_id;

      if (!userId) {
        this.sendError(ws, 'Invalid token: missing user ID');
        return;
      }

      // Verify user exists in database
      const { data: user, error} = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (_error|| !user) {
        this.sendError(ws, 'Invalid user');
        return;
      }

      // Setup user connection
      ws.userId = userId;
      ws.isAuthenticated = true;

      // Initialize Sweet Athena service for user
      try {
        ws.sweetAthenaService = new SweetAthenaIntegrationService(supabase);
        await ws.sweetAthenaService.initialize(userId);

        // Setup service event handlers
        this.setupServiceEventHandlers(ws);
      } catch (serviceError) {
        logger.error('Failed to initialize Sweet Athena service:', undefined, serviceError);
        ws.sweetAthenaService = undefined;
      }

      // Track user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(ws);

      ws.emit('authenticated');

      // Send authentication success
      this.sendMessage(ws, {
        type: 'success',
        data: {
          message: 'Authentication successful',
          userId,
          sweetAthenaEnabled: !!ws.sweetAthenaService,
          currentState: ws.sweetAthenaService?.getCurrentState(),
        },
      });

      logger.info('WebSocket client authenticated', undefined, { clientId, userId });
    } catch (error) {
      logger.error('Authentication error', undefined, error);
      this.sendError(ws, 'Authentication failed');
    }
  }

  /**
   * Setup Sweet Athena service event handlers
   */
  private setupServiceEventHandlers(ws: AuthenticatedWebSocket): void {
    if (!ws.sweetAthenaService) return;

    ws.sweetAthenaService.on('personalityChanged', (data) => {
      this.sendMessage(ws, {
        type: 'personality_change',
        data: {
          personality: data.to,
          previousPersonality: data.from,
          timestamp: new Date().toISOString(),
        },
      });
    });

    ws.sweetAthenaService.on('clothingChanged', (data) => {
      this.sendMessage(ws, {
        type: 'clothing_update',
        data: {
          level: data.to,
          previousLevel: data.from,
          timestamp: new Date().toISOString(),
        },
      });
    });

    ws.sweetAthenaService.on('avatarStateChanged', (state) => {
      this.sendMessage(ws, {
        type: 'state_change',
        data: {
          state,
          timestamp: new Date().toISOString(),
        },
      });
    });

    ws.sweetAthenaService.on('avatarConnected', () => {
      this.sendMessage(ws, {
        type: 'avatar_response',
        data: {
          event: 'connected',
          message: 'Sweet Athena avatar connected',
          timestamp: new Date().toISOString(),
        },
      });
    });

    ws.sweetAthenaService.on('avatarDisconnected', () => {
      this.sendMessage(ws, {
        type: 'avatar_response',
        data: {
          event: 'disconnected',
          message: 'Sweet Athena avatar disconnected',
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  /**
   * Handle ping message
   */
  private async handlePing(ws: AuthenticatedWebSocket, message: WSMessage): Promise<void> {
    ws.lastPing = Date.now();
    this.sendMessage(ws, {
      type: 'pong',
      id: message.id,
      data: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Handle personality change request
   */
  private async handlePersonalityChange(
    ws: AuthenticatedWebSocket,
    message: WSMessage
  ): Promise<void> {
    try {
      const { personality } = message.data || {};

      if (
        !personality ||
        !['sweet', 'shy', 'confident', 'caring', 'playful'].includes(personality)
      ) {
        this.sendError(ws, 'Invalid personality mode');
        return;
      }

      if (!ws.sweetAthenaService) {
        this.sendError(ws, 'Sweet Athena service not available');
        return;
      }

      await ws.sweetAthenaService.setPersonality(personality as PersonalityMode);

      this.sendMessage(ws, {
        type: 'success',
        id: message.id,
        data: {
          message: `Personality changed to ${personality}`,
          personality,
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast to other connections for this user
      this.broadcastToUser(
        ws.userId!,
        {
          type: 'personality_change',
          data: {
            personality,
            source: 'websocket',
            timestamp: new Date().toISOString(),
          },
        },
        ws
      );
    } catch (error) {
      logger.error('Personality change _error', undefined, error);
      this.sendError(ws, 'Failed to change personality', message.id);
    }
  }

  /**
   * Handle clothing update request
   */
  private async handleClothingUpdate(
    ws: AuthenticatedWebSocket,
    message: WSMessage
  ): Promise<void> {
    try {
      const { level } = message.data || {};

      if (!level || !['conservative', 'moderate', 'revealing', 'very_revealing'].includes(level)) {
        this.sendError(ws, 'Invalid clothing level');
        return;
      }

      if (!ws.sweetAthenaService) {
        this.sendError(ws, 'Sweet Athena service not available');
        return;
      }

      await ws.sweetAthenaService.setClothingLevel(level);

      this.sendMessage(ws, {
        type: 'success',
        id: message.id,
        data: {
          message: `Clothing level changed to ${level}`,
          level,
          timestamp: new Date().toISOString(),
        },
      });

      // Broadcast to other connections for this user
      this.broadcastToUser(
        ws.userId!,
        {
          type: 'clothing_update',
          data: {
            level,
            source: 'websocket',
            timestamp: new Date().toISOString(),
          },
        },
        ws
      );
    } catch (error) {
      logger.error('Clothing update _error', undefined, error);
      this.sendError(ws, 'Failed to update clothing', message.id);
    }
  }

  /**
   * Handle state change request
   */
  private async handleStateChange(ws: AuthenticatedWebSocket, message: WSMessage): Promise<void> {
    try {
      const { interaction, status } = message.data || {};

      if (!ws.sweetAthenaService) {
        this.sendError(ws, 'Sweet Athena service not available');
        return;
      }

      // Update interaction mode
      if (interaction?.mode) {
        await ws.sweetAthenaService.setInteractionMode(interaction.mode, interaction.context || '');
      }

      // Update user engagement
      if (interaction?.userEngagement !== undefined) {
        ws.sweetAthenaService.updateUserEngagement(interaction.userEngagement);
      }

      const currentState = ws.sweetAthenaService.getCurrentState();

      this.sendMessage(ws, {
        type: 'success',
        id: message.id,
        data: {
          message: 'State updated successfully',
          state: currentState,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('State change _error', undefined, error);
      this.sendError(ws, 'Failed to update state', message.id);
    }
  }

  /**
   * Handle voice interaction
   */
  private async handleVoiceInteraction(
    ws: AuthenticatedWebSocket,
    message: WSMessage
  ): Promise<void> {
    try {
      const { text, audioData, expectResponse } = message.data || {};

      if (!text && !audioData) {
        this.sendError(ws, 'Text or audio data required for voice interaction');
        return;
      }

      if (!ws.sweetAthenaService) {
        this.sendError(ws, 'Sweet Athena service not available');
        return;
      }

      // For now, we'll handle text input
      // Audio processing would require additional infrastructure
      if (text) {
        // This would integrate with the Sweet Athena voice system
        const response = {
          type: 'avatar_response',
          id: message.id,
          data: {
            text,
            audioUrl: expectResponse ? `/api/sweet-athena/audio/response/${Date.now()}` : undefined,
            personality: ws.sweetAthenaService.getCurrentState().personality.mode,
            timestamp: new Date().toISOString(),
          },
        };

        this.sendMessage(ws, response);
      }
    } catch (error) {
      logger.error('Voice interaction _error', undefined, error);
      this.sendError(ws, 'Failed to process voice interaction', message.id);
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(
    ws: AuthenticatedWebSocket,
    clientId: string,
    code: number,
    reason: Buffer
  ): void {
    logger.info('WebSocket connection closed', undefined, {
      clientId,
      userId: ws.userId,
      code,
      reason: reason.toString(),
    });

    this.cleanup(ws, clientId);
  }

  /**
   * Handle connection error
   */
  private handleError(ws: AuthenticatedWebSocket, clientId: string, error Error): void {
    logger.error('WebSocket connection _error', undefined, { error clientId, userId: ws.userId });
    this.cleanup(ws, clientId);
  }

  /**
   * Cleanup connection resources
   */
  private cleanup(ws: AuthenticatedWebSocket, clientId: string): void {
    // Remove from clients map
    this.clients.delete(clientId);

    // Remove from user connections
    if (ws.userId && this.userConnections.has(ws.userId)) {
      const userConnections = this.userConnections.get(ws.userId)!;
      userConnections.delete(ws);

      if (userConnections.size === 0) {
        this.userConnections.delete(ws.userId);
      }
    }

    // Cleanup Sweet Athena service
    if (ws.sweetAthenaService) {
      ws.sweetAthenaService.destroy();
    }
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(ws: AuthenticatedWebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      message.timestamp = message.timestamp || new Date().toISOString();
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error.message
   */
  private sendError(ws: AuthenticatedWebSocket, errorMessage: string, messageId?: string): void {
    this.sendMessage(ws, {
      type: 'error',
      id: messageId,
      data: {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Broadcast message to all connections for a user
   */
  private broadcastToUser(
    userId: string,
    message: WSMessage,
    excludeWs?: AuthenticatedWebSocket
  ): void {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return;

    for (const ws of userConnections) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    }
  }

  /**
   * Broadcast message to all authenticated connections
   */
  public broadcast(message: WSMessage): void {
    for (const [clientId, ws] of this.clients) {
      if (ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    }
  }

  /**
   * Close connection with code and reason
   */
  private closeConnection(ws: AuthenticatedWebSocket, code: number, reason: string): void {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(code, reason);
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    const current = this.messageCounts.get(identifier);

    if (!current || current.resetTime < windowStart) {
      this.messageCounts.set(identifier, { count: 1, resetTime: now });
      return true;
    }

    if (current.count >= this.config.messageRateLimit) {
      return false;
    }

    current.count++;
    return true;
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = now - this.config.pingInterval * 2;

      for (const [clientId, ws] of this.clients) {
        if (ws.lastPing && ws.lastPing < staleThreshold) {
          logger.warn('Closing stale WebSocket connection', undefined, {
            clientId,
            userId: ws.userId,
          });
          this.closeConnection(ws, 1001, 'Connection stale');
        } else if (ws.readyState === WebSocket.OPEN) {
          this.sendMessage(ws, { type: 'ping' });
        }
      }
    }, this.config.pingInterval);
  }

  /**
   * Get connection statistics
   */
  public getStats(): any {
    return {
      totalConnections: this.clients.size,
      authenticatedConnections: Array.from(this.clients.values()).filter((ws) => ws.isAuthenticated)
        .length,
      uniqueUsers: this.userConnections.size,
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() : 0,
    };
  }
}

export default SweetAthenaWebSocketService;
