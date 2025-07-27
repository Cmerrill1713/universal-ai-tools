import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { AgentPerformanceTracker } from './agent-performance-tracker';
import type { SwarmOrchestrator } from './swarm-orchestrator';

interface WebSocketMessage {
  type: string;
  data?: any;
  error: string;
}

export class AgentPerformanceWebSocket extends EventEmitter {
  private clients: Set<WebSocket> = new Set();
  private performanceTracker?: AgentPerformanceTracker;
  private swarmOrchestrator?: SwarmOrchestrator;

  constructor() {
    super();
  }

  // Initialize with existing services
  initialize(swarmOrchestrator: SwarmOrchestrator): void {
    this.swarmOrchestrator = swarmOrchestrator;

    // Listen to performance events from SwarmOrchestrator
    if (this.swarmOrchestrator) {
      this.swarmOrchestrator.on('performance:taskStarted', (data) => {
        this.broadcast({
          type: 'performance:taskStarted',
          data,
        });
      });

      this.swarmOrchestrator.on('performance:taskCompleted', (data) => {
        this.broadcast({
          type: 'performance:taskCompleted',
          data,
        });
      });

      this.swarmOrchestrator.on('performance:metricRecorded', (data) => {
        this.broadcast({
          type: 'performance:metricRecorded',
          data,
        });
      });

      // Listen to general swarm events
      this.swarmOrchestrator.on('task:assigned', (data) => {
        this.broadcast({
          type: 'task:assigned',
          data,
        });
      });

      this.swarmOrchestrator.on('task:progress', (data) => {
        this.broadcast({
          type: 'task:progress',
          data,
        });
      });

      this.swarmOrchestrator.on('task:completed', (data) => {
        this.broadcast({
          type: 'task:completed',
          data,
        });
      });

      this.swarmOrchestrator.on('agent:status', (data) => {
        this.broadcast({
          type: 'agent:status',
          data,
        });
      });

      this.swarmOrchestrator.on('metrics:updated', (data) => {
        this.broadcast({
          type: 'metrics:updated',
          data,
        });
      });
    }

    logger.info('Agent Performance WebSocket initialized', LogContext.WEBSOCKET);
  }

  // Handle new WebSocket connection
  handleConnection(ws: WebSocket, req: any): void {
    logger.info('New WebSocket client connected for agent performance', LogContext.WEBSOCKET);
    this.clients.add(ws);

    // Send welcome message
    this.sendMessage(ws, {
      type: 'welcome',
      data: {
        message: 'Connected to Agent Performance Tracker',
        timestamp: new Date().toISOString(),
      },
    });

    // Handle messages from client
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleClientMessage(ws, data);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info('WebSocket client disconnected', LogContext.WEBSOCKET);
    });

    // Handle errors
    ws.on('_error, (error => {
      logger.error('WebSocket _error, LogContext.WEBSOCKET, { error});
      this.clients.delete(ws);
    });
  }

  // Handle messages from clients
  private async handleClientMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'getAgentMetrics':
          if (this.swarmOrchestrator) {
            const metrics = await this.swarmOrchestrator.getAgentPerformanceMetrics(
              message.data?.agentId
            );
            this.sendMessage(ws, {
              type: 'agentMetrics',
              data: metrics,
            });
          }
          break;

        case 'getPerformanceTrends':
          if (this.swarmOrchestrator && message.data?.agentId) {
            const trends = await this.swarmOrchestrator.getPerformanceTrends(
              message.data.agentId,
              message.data.period || 'day',
              message.data.lookback || 7
            );
            this.sendMessage(ws, {
              type: 'performanceTrends',
              data: trends,
            });
          }
          break;

        case 'getSwarmMetrics':
          if (this.swarmOrchestrator) {
            const metrics = await this.swarmOrchestrator.getMetrics();
            this.sendMessage(ws, {
              type: 'swarmMetrics',
              data: metrics,
            });
          }
          break;

        case 'getProgressReport':
          if (this.swarmOrchestrator) {
            const report = await this.swarmOrchestrator.getProgressReport();
            this.sendMessage(ws, {
              type: 'progressReport',
              data: { report },
            });
          }
          break;

        case 'ping':
          this.sendMessage(ws, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
          });
          break;

        default:
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling client message', LogContext.WEBSOCKET, { _error message });
      this.sendError(ws, 'Failed to process message');
    }
  }

  // Send message to a specific client
  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Send _errorto a specific client
  private sendError(ws: WebSocket, error string): void {
    this.sendMessage(ws, {
      type: '_error,
      _error
    });
  }

  // Broadcast message to all connected clients
  private broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Get number of connected clients
  getClientCount(): number {
    return this.clients.size;
  }

  // Cleanup
  destroy(): void {
    // Close all client connections
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutting down');
      }
    });
    this.clients.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const agentPerformanceWebSocket = new AgentPerformanceWebSocket();
