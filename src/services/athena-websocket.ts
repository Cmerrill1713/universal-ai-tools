/**
 * Athena WebSocket Service
 * Manages real-time updates for Athena dashboard
 * Provides agent status, system health, and notification streaming
 */

import type { RawData } from 'ws';
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '@/utils/logger';
import { dynamicAgentSpawner } from './dynamic-agent-spawner';
import { EventEmitter } from 'events';

interface AthenaClient {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  subscriptions: Set<string>;
}

class AthenaWebSocketService extends EventEmitter {
  private clients: Map<string, AthenaClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statusUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = uuidv4();
    
    const client: AthenaClient = {
      id: clientId,
      ws,
      isAlive: true,
      subscriptions: new Set(['status', 'agents', 'notifications']),
    };

    this.clients.set(clientId, client);

    log.info('🌟 Athena WebSocket connection established', LogContext.WEBSOCKET, {
      clientId,
      totalClients: this.clients.size,
    });

    // Send initial connection confirmation
    this.sendToClient(client, {
      type: 'connection',
      status: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    });

    // Send current status
    this.sendStatus(client);

    // Setup event handlers
    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data: RawData) => {
      this.handleMessage(client, data);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      log.error('❌ Athena WebSocket error', LogContext.WEBSOCKET, {
        clientId,
        error: error.message,
      });
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(client: AthenaClient, data: RawData): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(client, message.topics);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, message.topics);
          break;
        case 'ping':
          this.sendToClient(client, { type: 'pong', timestamp: Date.now() });
          break;
        case 'get_status':
          this.sendStatus(client);
          break;
        case 'get_agents':
          this.sendAgentList(client);
          break;
        default:
          log.warn('Unknown message type', LogContext.WEBSOCKET, {
            type: message.type,
            clientId: client.id,
          });
      }
    } catch (error) {
      log.error('Failed to parse WebSocket message', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
        clientId: client.id,
      });
    }
  }

  /**
   * Handle client subscription requests
   */
  private handleSubscribe(client: AthenaClient, topics: string[]): void {
    topics.forEach(topic => {
      client.subscriptions.add(topic);
    });
    
    this.sendToClient(client, {
      type: 'subscribed',
      topics,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle client unsubscribe requests
   */
  private handleUnsubscribe(client: AthenaClient, topics: string[]): void {
    topics.forEach(topic => {
      client.subscriptions.delete(topic);
    });
    
    this.sendToClient(client, {
      type: 'unsubscribed',
      topics,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send current Athena status to client
   */
  private async sendStatus(client: AthenaClient): Promise<void> {
    try {
      const agents = dynamicAgentSpawner.getSpawnedAgents();
      const activeAgents = agents.filter((a: any) => a.status === 'active').length;
      
      const status = {
        connected: true,
        activeAgents,
        totalAgents: agents.length,
        systemHealth: this.getSystemHealth(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };

      this.sendToClient(client, {
        type: 'status_update',
        status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to send status', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
        clientId: client.id,
      });
    }
  }

  /**
   * Send agent list to client
   */
  private async sendAgentList(client: AthenaClient): Promise<void> {
    try {
      const agents = dynamicAgentSpawner.getSpawnedAgents();
      
      this.sendToClient(client, {
        type: 'agent_list',
        agents: agents.map((agent: any) => ({
          id: agent.id,
          name: agent.specification?.name || 'Unknown',
          purpose: agent.specification?.purpose || 'No purpose defined',
          status: agent.status,
          capabilities: agent.specification?.capabilities || [],
          createdAt: agent.createdAt,
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      log.error('Failed to send agent list', LogContext.WEBSOCKET, {
        error: error instanceof Error ? error.message : String(error),
        clientId: client.id,
      });
    }
  }

  /**
   * Broadcast message to all subscribed clients
   */
  broadcast(topic: string, data: any): void {
    const message = {
      type: 'broadcast',
      topic,
      data,
      timestamp: new Date().toISOString(),
    };

    this.clients.forEach(client => {
      if (client.subscriptions.has(topic) && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: AthenaClient, data: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
    return undefined;
    return undefined;
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    this.clients.delete(clientId);
    
    log.info('🌟 Athena WebSocket disconnected', LogContext.WEBSOCKET, {
      clientId,
      remainingClients: this.clients.size,
    });
  }

  /**
   * Start heartbeat interval to detect disconnected clients
   */
  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          this.handleDisconnection(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, 30000); // 30 seconds
  }

  /**
   * Start periodic status updates
   */
  startStatusUpdates(): void {
    // Send status updates every 10 seconds
    this.statusUpdateInterval = setInterval(() => {
      this.clients.forEach(client => {
        if (client.subscriptions.has('status')) {
          this.sendStatus(client);
        }
      });
    }, 10000);
  }

  /**
   * Setup event listeners for agent updates
   */
  private setupEventListeners(): void {
    // Event listeners for agent updates would go here
    // Currently simplified - can be enhanced when dynamic agent spawner supports events
    log.info('Athena WebSocket event listeners initialized', LogContext.WEBSOCKET);
  }

  /**
   * Get current system health status
   */
  private getSystemHealth(): 'healthy' | 'degraded' | 'error' {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (heapUsedPercent > 90) {
      return 'error';
    } else if (heapUsedPercent > 70) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Send notification to all clients
   */
  notify(level: 'info' | 'warning' | 'error' | 'success', message: string, data?: any): void {
    this.broadcast('notifications', {
      type: 'notification',
      level,
      message,
      data,
    });
  }

  /**
   * Cleanup resources
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    return undefined;
    return undefined;
    
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
    }
    
    return undefined;
    return undefined;

    this.clients.forEach(client => {
      client.ws.close();
    });
    
    this.clients.clear();
    
    log.info('🌟 Athena WebSocket service shut down', LogContext.WEBSOCKET);
  }
}

// Export singleton instance
export const athenaWebSocket = new AthenaWebSocketService();

/**
 * Initialize Athena WebSocket handler
 */
export function handleAthenaWebSocket(ws: WebSocket, req: IncomingMessage): void {
  athenaWebSocket.handleConnection(ws, req);
}