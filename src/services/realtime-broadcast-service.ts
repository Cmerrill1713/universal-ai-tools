import { EventEmitter } from 'events';
import type { Server as SocketIOServer,Socket } from 'socket.io';

import { logger } from '../utils/logger';

// Message Types and Interfaces
export interface AgentStateMessage {
  type: 'agent_state';
  agentId: string;
  status: 'idle' | 'active' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    activeConnections: number;
  };
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface PerformanceMetric {
  type: 'performance_metric';
  metricName: string;
  value: number;
  unit: string;
  category: 'system' | 'agent' | 'network' | 'database';
  agentId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface WorkflowExecutionUpdate {
  type: 'workflow_execution';
  workflowId: string;
  executionId: string;
  stage: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  agentId?: string;
  result?: any;
  error?: string;
  timestamp: number;
}

export interface MemoryTimelineData {
  type: 'memory_timeline';
  memoryId: string;
  action: 'created' | 'updated' | 'accessed' | 'deleted';
  content?: string;
  importance: number;
  tags: string[];
  agentId?: string;
  timestamp: number;
}

export interface SystemAlert {
  type: 'system_alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  details?: Record<string, any>;
  timestamp: number;
}

export interface ErrorNotification {
  type: 'error_notification';
  correlationId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category:
    | 'client'
    | 'server'
    | 'network'
    | 'database'
    | 'auth'
    | 'validation'
    | 'rate_limit'
    | 'external_api'
    | 'system';
  errorName: string;
  message: string;
  path: string;
  isRecoverable: boolean;
  recoveryActions?: string[];
  timestamp: number;
  affectedUsers?: number;
}

export interface HealthStatusUpdate {
  type: 'health_status';
  overall: 'healthy' | 'degraded' | 'critical';
  errorRate: number;
  criticalErrors: number;
  serviceAvailability: number;
  systemAlerts: number;
  timestamp: number;
}

export interface ErrorPatternAlert {
  type: 'error_pattern';
  patternId: string;
  errorName: string;
  path: string;
  occurrences: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestedFix?: string;
  affectedUsers: number;
  timestamp: number;
}

export type BroadcastMessage =
  | AgentStateMessage
  | PerformanceMetric
  | WorkflowExecutionUpdate
  | MemoryTimelineData
  | SystemAlert
  | ErrorNotification
  | HealthStatusUpdate
  | ErrorPatternAlert;

// Room subscription types
export type SubscriptionRoom =
  | 'agent_states'
  | 'performance_metrics'
  | 'workflow_executions'
  | 'memory_timeline'
  | 'system_alerts'
  | 'voice_sessions'
  | 'voice_rooms'
  | 'knowledge_graph'
  | 'error_notifications'
  | 'health_status'
  | 'error_patterns'
  | 'critical_errors'
  | `agent:${string}`
  | `workflow:${string}`
  | `voice_room:${string}`;

// Client subscription preferences
export interface SubscriptionPreferences {
  rooms: SubscriptionRoom[];
  agentFilters?: string[];
  metricFilters?: string[];
  updateFrequency?: number; // ms
}

export class RealtimeBroadcastService extends EventEmitter {
  private io: SocketIOServer;
  private connectedClients: Map<string, Socket> = new Map();
  private clientSubscriptions: Map<string, SubscriptionPreferences> = new Map();
  private metricsBuffer: Map<string, PerformanceMetric[]> = new Map();
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly BUFFER_FLUSH_INTERVAL = 1000; // 1 second

  constructor(io: SocketIOServer) {
    super();
    this.io = io;
    this.setupSocketHandlers();
    this.startBufferFlushTimer();
    logger.info('RealtimeBroadcastService initialized');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      this.handleClientConnection(socket);

      socket.on('subscribe', (preferences: SubscriptionPreferences) => {
        this.handleSubscription(socket, preferences);
      });

      socket.on('unsubscribe', (rooms: SubscriptionRoom[]) => {
        this.handleUnsubscription(socket, rooms);
      });

      socket.on('disconnect', () => {
        this.handleClientDisconnection(socket);
      });

      socket.on('error', (error) => {
        logger.error('Socket error:', error);
        this.broadcastSystemAlert({
          severity: 'error',
          component: 'websocket',
          message: 'Socket connection error',
          details: { socketId: socket.id, error: error.message },
        });
      });
    });
  }

  private handleClientConnection(socket: Socket): void {
    this.connectedClients.set(socket.id, socket);
    logger.info(`Client connected: ${socket.id}`);

    // Send initial connection message
    socket.emit('connection_established', {
      socketId: socket.id,
      timestamp: Date.now(),
      availableRooms: [
        'agent_states',
        'performance_metrics',
        'workflow_executions',
        'memory_timeline',
        'system_alerts',
        'voice_sessions',
        'voice_rooms',
        'knowledge_graph',
      ],
    });

    this.broadcastSystemAlert({
      severity: 'info',
      component: 'websocket',
      message: 'New client connected',
      details: { socketId: socket.id, totalClients: this.connectedClients.size },
    });
  }

  private handleSubscription(socket: Socket, preferences: SubscriptionPreferences): void {
    try {
      // Validate subscription preferences
      this.validateSubscriptionPreferences(preferences);

      // Store client preferences
      this.clientSubscriptions.set(socket.id, preferences);

      // Join requested rooms
      preferences.rooms.forEach((room) => {
        socket.join(room);
      });

      socket.emit('subscription_confirmed', {
        subscriptions: preferences.rooms,
        timestamp: Date.now(),
      });

      logger.info(`Client ${socket.id} subscribed to rooms: ${preferences.rooms.join(', ')}`);
    } catch (error) {
      socket.emit('subscription_error', {
        error: error instanceof Error ? error.message : 'Invalid subscription preferences',
        timestamp: Date.now(),
      });
    }
  }

  private handleUnsubscription(socket: Socket, rooms: SubscriptionRoom[]): void {
    rooms.forEach((room) => {
      socket.leave(room);
    });

    // Update client preferences
    const currentPrefs = this.clientSubscriptions.get(socket.id);
    if (currentPrefs) {
      currentPrefs.rooms = currentPrefs.rooms.filter((room) => !rooms.includes(room));
      this.clientSubscriptions.set(socket.id, currentPrefs);
    }

    socket.emit('unsubscription_confirmed', {
      unsubscribed: rooms,
      timestamp: Date.now(),
    });

    logger.info(`Client ${socket.id} unsubscribed from rooms: ${rooms.join(', ')}`);
  }

  private handleClientDisconnection(socket: Socket): void {
    this.connectedClients.delete(socket.id);
    this.clientSubscriptions.delete(socket.id);
    logger.info(`Client disconnected: ${socket.id}`);

    this.broadcastSystemAlert({
      severity: 'info',
      component: 'websocket',
      message: 'Client disconnected',
      details: { socketId: socket.id, totalClients: this.connectedClients.size },
    });
  }

  private validateSubscriptionPreferences(preferences: SubscriptionPreferences): void {
    if (!preferences.rooms || !Array.isArray(preferences.rooms)) {
      throw new Error('Invalid rooms specification');
    }

    const validRooms = [
      'agent_states',
      'performance_metrics',
      'workflow_executions',
      'memory_timeline',
      'system_alerts',
      'voice_sessions',
      'voice_rooms',
      'knowledge_graph',
    ];

    preferences.rooms.forEach((room) => {
      if (
        !validRooms.includes(room) &&
        !room.startsWith('agent:') &&
        !room.startsWith('workflow:') &&
        !room.startsWith('voice_room:')
      ) {
        throw new Error(`Invalid room: ${room}`);
      }
    });
  }

  // Public broadcasting methods
  public broadcastAgentState(state: Omit<AgentStateMessage, 'type' | 'timestamp'>): void {
    const message: AgentStateMessage = {
      ...state,
      type: 'agent_state',
      timestamp: Date.now(),
    };

    this.io.to('agent_states').emit('agent_state', message);
    this.io.to(`agent:${state.agentId}`).emit('agent_state', message);

    this.emit('agent_state_broadcast', message);
  }

  public broadcastPerformanceMetric(metric: Omit<PerformanceMetric, 'type' | 'timestamp'>): void {
    const message: PerformanceMetric = {
      ...metric,
      type: 'performance_metric',
      timestamp: Date.now(),
    };

    // Buffer metrics for batch sending
    this.bufferMetric(message);
  }

  private bufferMetric(metric: PerformanceMetric): void {
    const bufferKey = metric.category;
    if (!this.metricsBuffer.has(bufferKey)) {
      this.metricsBuffer.set(bufferKey, []);
    }

    const buffer = this.metricsBuffer.get(bufferKey)!;
    buffer.push(metric);

    // If buffer is full, flush immediately
    if (buffer.length >= this.BUFFER_SIZE) {
      this.flushMetricsBuffer(bufferKey);
    }
  }

  private flushMetricsBuffer(bufferKey?: string): void {
    const keysToFlush = bufferKey ? [bufferKey] : Array.from(this.metricsBuffer.keys());

    keysToFlush.forEach((key) => {
      const buffer = this.metricsBuffer.get(key);
      if (buffer && buffer.length > 0) {
        this.io.to('performance_metrics').emit('performance_metrics_batch', buffer);
        this.metricsBuffer.set(key, []);
      }
    });
  }

  private startBufferFlushTimer(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, this.BUFFER_FLUSH_INTERVAL);
  }

  public broadcastWorkflowUpdate(
    update: Omit<WorkflowExecutionUpdate, 'type' | 'timestamp'>
  ): void {
    const message: WorkflowExecutionUpdate = {
      ...update,
      type: 'workflow_execution',
      timestamp: Date.now(),
    };

    this.io.to('workflow_executions').emit('workflow_execution', message);
    this.io.to(`workflow:${update.workflowId}`).emit('workflow_execution', message);

    this.emit('workflow_update_broadcast', message);
  }

  public broadcastMemoryTimeline(data: Omit<MemoryTimelineData, 'type' | 'timestamp'>): void {
    const message: MemoryTimelineData = {
      ...data,
      type: 'memory_timeline',
      timestamp: Date.now(),
    };

    this.io.to('memory_timeline').emit('memory_timeline', message);

    if (data.agentId) {
      this.io.to(`agent:${data.agentId}`).emit('memory_timeline', message);
    }

    this.emit('memory_timeline_broadcast', message);
  }

  public broadcastSystemAlert(alert: Omit<SystemAlert, 'type' | 'timestamp'>): void {
    const message: SystemAlert = {
      ...alert,
      type: 'system_alert',
      timestamp: Date.now(),
    };

    this.io.to('system_alerts').emit('system_alert', message);
    this.emit('system_alert_broadcast', message);

    // Also log critical alerts
    if (alert.severity === 'critical') {
      logger.error(`Critical system alert: ${alert.message}`, alert.details);
    }
  }

  /**
   * Broadcast error notification to subscribed clients
   */
  public broadcastErrorNotification(error: Omit<ErrorNotification, 'type' | 'timestamp'>): void {
    const message: ErrorNotification = {
      ...error,
      type: 'error_notification',
      timestamp: Date.now(),
    };

    // Broadcast to general error notifications room
    this.io.to('error_notifications').emit('error_notification', message);

    // Also broadcast critical errors to critical_errors room
    if (error.severity === 'critical') {
      this.io.to('critical_errors').emit('critical_error', message);
    }

    this.emit('error_notification_broadcast', message);

    // Log critical error notifications
    if (error.severity === 'critical') {
      logger.error(`Critical error notification: ${error.errorName} on ${error.path}`, {
        correlationId: error.correlationId,
        category: error.category,
        recoverable: error.isRecoverable,
      });
    }
  }

  /**
   * Broadcast health status update to subscribed clients
   */
  public broadcastHealthStatus(health: Omit<HealthStatusUpdate, 'type' | 'timestamp'>): void {
    const message: HealthStatusUpdate = {
      ...health,
      type: 'health_status',
      timestamp: Date.now(),
    };

    this.io.to('health_status').emit('health_status', message);
    this.emit('health_status_broadcast', message);

    // Log health status changes
    if (health.overall !== 'healthy') {
      logger.warn(`System health status: ${health.overall}`, {
        errorRate: health.errorRate,
        criticalErrors: health.criticalErrors,
        availability: health.serviceAvailability,
      });
    }
  }

  /**
   * Broadcast error pattern alert to subscribed clients
   */
  public broadcastErrorPattern(pattern: Omit<ErrorPatternAlert, 'type' | 'timestamp'>): void {
    const message: ErrorPatternAlert = {
      ...pattern,
      type: 'error_pattern',
      timestamp: Date.now(),
    };

    this.io.to('error_patterns').emit('error_pattern', message);

    // Also broadcast critical patterns to critical_errors room
    if (pattern.severity === 'critical') {
      this.io.to('critical_errors').emit('critical_pattern', message);
    }

    this.emit('error_pattern_broadcast', message);

    // Log pattern alerts
    logger.warn(`Error pattern detected: ${pattern.errorName} on ${pattern.path}`, {
      patternId: pattern.patternId,
      occurrences: pattern.occurrences,
      affectedUsers: pattern.affectedUsers,
      suggestedFix: pattern.suggestedFix,
    });
  }

  /**
   * Broadcast real-time error with immediate delivery (for critical errors)
   */
  public broadcastImmediateError(error: {
    correlationId: string;
    severity: 'critical';
    category:
      | 'client'
      | 'server'
      | 'network'
      | 'database'
      | 'auth'
      | 'validation'
      | 'rate_limit'
      | 'external_api'
      | 'system';
    errorName: string;
    message: string;
    path: string;
    recoveryActions?: string[];
  }): void {
    // Immediate broadcast to all connected clients for critical errors
    const message = {
      type: 'immediate_error',
      ...error,
      timestamp: Date.now(),
      urgent: true,
    };

    // Send to all connected clients regardless of subscription
    this.io.emit('immediate_error', message);

    // Also send specific notifications
    this.broadcastErrorNotification({
      correlationId: error.correlationId,
      severity: error.severity,
      category: error.category,
      errorName: error.errorName,
      message: error.message,
      path: error.path,
      isRecoverable: !!error.recoveryActions && error.recoveryActions.length > 0,
      recoveryActions: error.recoveryActions,
    });

    this.emit('immediate_error_broadcast', message);

    logger.error(`IMMEDIATE ERROR BROADCAST: ${error.errorName}`, {
      correlationId: error.correlationId,
      path: error.path,
      category: error.category,
    });
  }

  // Utility methods
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  public getClientSubscriptions(socketId: string): SubscriptionPreferences | undefined {
    return this.clientSubscriptions.get(socketId);
  }

  public getRoomMemberCount(room: SubscriptionRoom): number {
    return this.io.sockets.adapter.rooms.get(room)?.size || 0;
  }

  public broadcastToRoom(room: SubscriptionRoom, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  // Health check method
  public getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connectedClients: number;
    activeRooms: string[];
    bufferStatus: Record<string, number>;
  } {
    const activeRooms = Array.from(this.io.sockets.adapter.rooms.keys());
    const bufferStatus: Record<string, number> = {};

    this.metricsBuffer.forEach((buffer, key) => {
      bufferStatus[key] = buffer.length;
    });

    const status = this.connectedClients.size > 0 ? 'healthy' : 'degraded';

    return {
      status,
      connectedClients: this.connectedClients.size,
      activeRooms,
      bufferStatus,
    };
  }

  // Cleanup method
  public destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }

    // Flush remaining metrics
    this.flushMetricsBuffer();

    // Clear all data
    this.connectedClients.clear();
    this.clientSubscriptions.clear();
    this.metricsBuffer.clear();

    logger.info('RealtimeBroadcastService destroyed');
  }
}

// Export singleton instance creation helper
export function createRealtimeBroadcastService(io: SocketIOServer): RealtimeBroadcastService {
  return new RealtimeBroadcastService(io);
}

// Export types for external use
export type {
  BroadcastMessage as BroadcastMessageType,
  SubscriptionPreferences as SubscriptionPreferencesType,
  SubscriptionRoom as SubscriptionRoomType,
};
