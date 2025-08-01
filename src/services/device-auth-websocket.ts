/**
 * Device Authentication WebSocket Service
 * Manages real-time authentication events for Swift companion app
 * Enables proximity-based lock/unlock, authentication state changes, and device sync
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import type { Server } from 'http';

interface AuthEvent {
  type:
    | 'device_registered'
    | 'device_removed'
    | 'auth_state_changed'
    | 'proximity_changed'
    | 'screen_locked'
    | 'screen_unlocked';
  deviceId: string;
  userId: string;
  timestamp: string;
  data: any;
}

interface WSClient {
  id: string;
  userId: string;
  deviceId?: string;
  ws: WebSocket;
  isAlive: boolean;
  subscriptions: Set<string>;
}

export class DeviceAuthWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server, path = '/ws/device-auth'): void {
    this.wss = new WebSocketServer({
      server,
      path,
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on('connection', this.handleConnection.bind(this));

    // Start heartbeat monitoring
    this.startHeartbeat();

    log.info('Device Auth WebSocket server initialized', LogContext.WEBSOCKET, {
      path,
    });
  }

  /**
   * Verify WebSocket client before accepting connection
   */
  private async verifyClient(
    info: { origin: string; secure: boolean; req: IncomingMessage },
    callback: (result: boolean, code?: number, statusMessage?: string) => void
  ): Promise<void> {
    try {
      const authHeader = info.req.headers.authorization;
      if (!authHeader) {
        callback(false, 401, 'Unauthorized');
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'device-auth-secret') as any;

      // Store user info in request for later use
      (info.req as any).userId = decoded.userId;
      (info.req as any).deviceId = decoded.deviceId;

      callback(true);
    } catch (error) {
      log.error('WebSocket authentication failed', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
      });
      callback(false, 401, 'Invalid token');
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const { userId } = req as any;
    const { deviceId } = req as any;
    const clientId = uuidv4();

    const client: WSClient = {
      id: clientId,
      userId,
      deviceId,
      ws,
      isAlive: true,
      subscriptions: new Set([`user:${userId}`]),
    };

    if (deviceId) {
      client.subscriptions.add(`device:${deviceId}`);
    }

    this.clients.set(clientId, client);

    log.info('WebSocket client connected', LogContext.WEBSOCKET, {
      clientId,
      userId,
      deviceId,
    });

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('pong', () => this.handlePong(clientId));
    ws.on('close', () => this.handleDisconnect(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      data: {
        clientId,
        userId,
        deviceId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(clientId: string, data: any): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.channels);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.channels);
          break;

        case 'proximity_update':
          this.handleProximityUpdate(clientId, message.data);
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          log.warn('Unknown WebSocket message type', LogContext.WEBSOCKET, {
            type: message.type,
            clientId,
          });
      }
    } catch (error) {
      log.error('Failed to handle WebSocket message', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
        clientId,
      });
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    channels.forEach((channel) => {
      // Validate channel access
      if (this.canSubscribe(client, channel)) {
        client.subscriptions.add(channel);
      }
    });

    this.sendToClient(clientId, {
      type: 'subscribed',
      data: {
        channels: Array.from(client.subscriptions),
      },
    });
  }

  /**
   * Handle unsubscribe requests
   */
  private handleUnsubscribe(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    channels.forEach((channel) => {
      client.subscriptions.delete(channel);
    });

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: {
        channels: Array.from(client.subscriptions),
      },
    });
  }

  /**
   * Handle proximity updates from device
   */
  private handleProximityUpdate(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.deviceId) return;

    // Broadcast proximity change to all user's devices
    this.broadcastAuthEvent({
      type: 'proximity_changed',
      deviceId: client.deviceId,
      userId: client.userId,
      timestamp: new Date().toISOString(),
      data: {
        rssi: data.rssi,
        proximity: data.proximity,
        locked: data.locked,
      },
    });

    // Auto-lock/unlock based on proximity
    if (data.proximity === 'far' || data.proximity === 'unknown') {
      this.broadcastAuthEvent({
        type: 'screen_locked',
        deviceId: client.deviceId,
        userId: client.userId,
        timestamp: new Date().toISOString(),
        data: {
          reason: 'proximity',
          proximity: data.proximity,
        },
      });
    } else if (data.proximity === 'immediate') {
      this.broadcastAuthEvent({
        type: 'screen_unlocked',
        deviceId: client.deviceId,
        userId: client.userId,
        timestamp: new Date().toISOString(),
        data: {
          reason: 'proximity',
          proximity: data.proximity,
        },
      });
    }
  }

  /**
   * Check if client can subscribe to channel
   */
  private canSubscribe(client: WSClient, channel: string): boolean {
    // Users can only subscribe to their own channels
    if (channel.startsWith('user:')) {
      return channel === `user:${client.userId}`;
    }

    // Devices can subscribe to device-specific channels
    if (channel.startsWith('device:') && client.deviceId) {
      return channel === `device:${client.deviceId}`;
    }

    // Global channels
    if (channel === 'global') {
      return true;
    }

    return false;
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
    return undefined;
    return undefined;
  }

  /**
   * Broadcast authentication event to relevant clients
   */
  broadcastAuthEvent(event: AuthEvent): void {
    const channels = new Set<string>();

    // Determine relevant channels
    channels.add(`user:${event.userId}`);
    if (event.deviceId) {
      channels.add(`device:${event.deviceId}`);
    }

    // Send to all subscribed clients
    this.clients.forEach((client) => {
      const hasSubscription = Array.from(channels).some((channel) =>
        client.subscriptions.has(channel)
      );

      if (hasSubscription && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(
          JSON.stringify({
            type: 'auth_event',
            event,
          })
        );
      }
    });

    log.info('Broadcasted auth event', LogContext.WEBSOCKET, {
      eventType: event.type,
      userId: event.userId,
      deviceId: event.deviceId,
      recipientCount: Array.from(this.clients.values()).filter((c) =>
        Array.from(channels).some((ch) => c.subscriptions.has(ch))
      ).length,
    });
  }

  /**
   * Handle pong response (heartbeat)
   */
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
    return undefined;
    return undefined;
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      log.info('WebSocket client disconnected', LogContext.WEBSOCKET, {
        clientId,
        userId: client.userId,
        deviceId: client.deviceId,
      });

      // Notify other devices about disconnection
      if (client.deviceId) {
        this.broadcastAuthEvent({
          type: 'device_removed',
          deviceId: client.deviceId,
          userId: client.userId,
          timestamp: new Date().toISOString(),
          data: {
            reason: 'disconnected',
          },
        });
      }

      this.clients.delete(clientId);
    }
  }

  /**
   * Handle WebSocket error
   */
  private handleError(clientId: string, error: Error): void {
    log.error('WebSocket error', LogContext.WEBSOCKET, {
      clientId,
      error: error.message,
    });
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          // Client didn't respond to last ping, disconnect
          client.ws.terminate();
          this.handleDisconnect(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds
  }

  /**
   * Shutdown WebSocket service
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    return undefined;
    return undefined;

    if (this.wss) {
      // Close all connections
      this.clients.forEach((client) => {
        client.ws.close(1000, 'Server shutting down');
      });

      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    log.info('Device Auth WebSocket service shutdown', LogContext.WEBSOCKET);
  }

  /**
   * Get connected clients count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get connected devices for a user
   */
  getUserDevices(userId: string): string[] {
    const devices: string[] = [];
    this.clients.forEach((client) => {
      if (client.userId === userId && client.deviceId) {
        devices.push(client.deviceId);
      }
      return undefined;
      return undefined;
    });
    return devices;
  }
}

// Export singleton instance
export const deviceAuthWebSocket = new DeviceAuthWebSocketService();
