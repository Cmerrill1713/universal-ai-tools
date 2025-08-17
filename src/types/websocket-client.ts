/**
 * WebSocket Client Types and Interfaces
 * 
 * TypeScript definitions for connecting to the real-time broadcast service
 * from frontend applications or other clients.
 */

import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

// Re-export message types from the broadcast service
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

export type BroadcastMessage = 
  | AgentStateMessage 
  | PerformanceMetric 
  | WorkflowExecutionUpdate 
  | MemoryTimelineData 
  | SystemAlert;

export type SubscriptionRoom = 
  | 'agent_states'
  | 'performance_metrics'
  | 'workflow_executions'
  | 'memory_timeline'
  | 'system_alerts'
  | `agent:${string}`
  | `workflow:${string}`;

export interface SubscriptionPreferences {
  rooms: SubscriptionRoom[];
  agentFilters?: string[];
  metricFilters?: string[];
  updateFrequency?: number;
}

// Client configuration
export interface WebSocketClientConfig {
  serverUrl: string;
  autoConnect?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  subscriptions?: SubscriptionPreferences;
  debug?: boolean;
}

// Event handlers
export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onAgentState?: (data: AgentStateMessage) => void;
  onPerformanceMetrics?: (data: PerformanceMetric[]) => void;
  onWorkflowUpdate?: (data: WorkflowExecutionUpdate) => void;
  onMemoryTimeline?: (data: MemoryTimelineData) => void;
  onSystemAlert?: (data: SystemAlert) => void;
  onError?: (error: any) => void;
  onSubscriptionConfirmed?: (data: { subscriptions: SubscriptionRoom[]; timestamp: number }) => void;
  onSubscriptionError?: (data: { error: string; timestamp: number }) => void;
}

// Main WebSocket client class
export class UniversalAIWebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketClientConfig;
  private handlers: WebSocketEventHandlers;
  private isConnected = false;
  private reconnectAttempts = 0;

  constructor(config: WebSocketClientConfig, handlers: WebSocketEventHandlers = {}) {
    this.config = {
      autoConnect: true,
      retryAttempts: 5,
      retryDelay: 2000,
      debug: false,
      ...config,
    };
    this.handlers = handlers;

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  public connect(): void {
    try {
      this.socket = io(this.config.serverUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: this.config.retryAttempts,
        reconnectionDelay: this.config.retryDelay,
        forceNew: false,
      });

      this.setupEventHandlers();

      if (this.config.debug) {
        console.log(`[WebSocket] Connecting to ${this.config.serverUrl}`);
      }
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      this.handlers.onError?.(error);
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  public subscribe(preferences: SubscriptionPreferences): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('subscribe', preferences);
      
      if (this.config.debug) {
        console.log('[WebSocket] Subscribing to rooms:', preferences.rooms);
      }
    } else {
      console.warn('[WebSocket] Cannot subscribe - not connected');
    }
  }

  public unsubscribe(rooms: SubscriptionRoom[]): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('unsubscribe', rooms);
      
      if (this.config.debug) {
        console.log('[WebSocket] Unsubscribing from rooms:', rooms);
      }
    }
  }

  public ping(): void {
    if (this.socket) {
      this.socket.emit('ping');
    }
  }

  public getConnectionStatus(): {
    connected: boolean;
    socketId?: string;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      if (this.config.debug) {
        console.log(`[WebSocket] Connected with ID: ${this.socket?.id}`);
      }
      
      // Auto-subscribe if configured
      if (this.config.subscriptions) {
        this.subscribe(this.config.subscriptions);
      }
      
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      
      if (this.config.debug) {
        console.log(`[WebSocket] Disconnected: ${reason}`);
      }
      
      this.handlers.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      
      if (this.config.debug) {
        console.error(`[WebSocket] Connection error (attempt ${this.reconnectAttempts}):`, error);
      }
      
      this.handlers.onError?.(error);
    });

    // System events
    this.socket.on('connection_established', (data) => {
      if (this.config.debug) {
        console.log('[WebSocket] Connection established:', data);
      }
    });

    this.socket.on('subscription_confirmed', (data) => {
      if (this.config.debug) {
        console.log('[WebSocket] Subscription confirmed:', data);
      }
      this.handlers.onSubscriptionConfirmed?.(data);
    });

    this.socket.on('subscription_error', (data) => {
      console.error('[WebSocket] Subscription error:', data);
      this.handlers.onSubscriptionError?.(data);
    });

    this.socket.on('unsubscription_confirmed', (data) => {
      if (this.config.debug) {
        console.log('[WebSocket] Unsubscription confirmed:', data);
      }
    });

    // Data events
    this.socket.on('agent_state', (data: AgentStateMessage) => {
      if (this.config.debug) {
        console.log('[WebSocket] Agent state update:', data);
      }
      this.handlers.onAgentState?.(data);
    });

    this.socket.on('performance_metrics_batch', (data: PerformanceMetric[]) => {
      if (this.config.debug) {
        console.log(`[WebSocket] Performance metrics batch (${data.length} metrics)`);
      }
      this.handlers.onPerformanceMetrics?.(data);
    });

    this.socket.on('workflow_execution', (data: WorkflowExecutionUpdate) => {
      if (this.config.debug) {
        console.log('[WebSocket] Workflow update:', data);
      }
      this.handlers.onWorkflowUpdate?.(data);
    });

    this.socket.on('memory_timeline', (data: MemoryTimelineData) => {
      if (this.config.debug) {
        console.log('[WebSocket] Memory timeline update:', data);
      }
      this.handlers.onMemoryTimeline?.(data);
    });

    this.socket.on('system_alert', (data: SystemAlert) => {
      if (this.config.debug) {
        console.log('[WebSocket] System alert:', data);
      }
      this.handlers.onSystemAlert?.(data);
    });

    // Ping/pong for connection testing
    this.socket.on('pong', (data) => {
      if (this.config.debug) {
        console.log('[WebSocket] Pong received:', data);
      }
    });
  }
}

// Utility functions for common use cases
export function createBasicClient(serverUrl: string): UniversalAIWebSocketClient {
  return new UniversalAIWebSocketClient(
    { serverUrl },
    {
      onConnect: () => console.log('[WebSocket] Connected to Universal AI Tools'),
      onDisconnect: (reason) => console.log(`[WebSocket] Disconnected: ${reason}`),
      onError: (error) => console.error('[WebSocket] Error:', error),
    }
  );
}

export function createMonitoringClient(
  serverUrl: string,
  onUpdate: (type: string, data: any) => void
): UniversalAIWebSocketClient {
  return new UniversalAIWebSocketClient(
    {
      serverUrl,
      subscriptions: {
        rooms: ['agent_states', 'performance_metrics', 'system_alerts'],
      },
    },
    {
      onAgentState: (data) => onUpdate('agent_state', data),
      onPerformanceMetrics: (data) => onUpdate('performance_metrics', data),
      onSystemAlert: (data) => onUpdate('system_alert', data),
    }
  );
}

export function createWorkflowClient(
  serverUrl: string,
  workflowId: string,
  onWorkflowUpdate: (data: WorkflowExecutionUpdate) => void
): UniversalAIWebSocketClient {
  return new UniversalAIWebSocketClient(
    {
      serverUrl,
      subscriptions: {
        rooms: [`workflow:${workflowId}`, 'workflow_executions'],
      },
    },
    {
      onWorkflowUpdate,
      onSystemAlert: (data) => {
        if (data.details?.workflowId === workflowId) {
          console.warn(`[Workflow ${workflowId}] Alert:`, data.message);
        }
      },
    }
  );
}

// Export all types
export type {
  BroadcastMessage as ClientBroadcastMessage,
  WebSocketClientConfig as ClientConfig,
  SubscriptionPreferences as ClientSubscriptionPreferences,
  SubscriptionRoom as ClientSubscriptionRoom,
  WebSocketEventHandlers as EventHandlers,
};