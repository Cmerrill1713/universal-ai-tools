/**
 * WebSocket Message Types for Real-time Communication
 * Used by frontend and backend for consistent WebSocket messaging
 */

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
  id?: string;
}

// Connection Events
export interface ConnectionEvent extends WebSocketEvent {
  type: 'connection' | 'disconnection' | 'reconnection';
  data: {
    clientId: string;
    sessionId?: string;
    userAgent?: string;
  };
}

// Agent Events
export interface AgentEvent extends WebSocketEvent {
  type: 'agent_started' | 'agent_completed' | 'agent__error | 'agent_progress';
  data: {
    agentId: string;
    agentName: string;
    task?: string;
    progress?: number;
    result?: any;
    error: string;
  };
}

// Orchestration Events
export interface OrchestrationEvent extends WebSocketEvent {
  type:
    | 'orchestration_started'
    | 'orchestration_step'
    | 'orchestration_completed'
    | 'orchestration__error);
  data: {
    orchestrationId: string;
    step?: string;
    totalSteps?: number;
    currentStep?: number;
    agentInvolved?: string;
    result?: any;
    error: string;
  };
}

// Memory Events
export interface MemoryEvent extends WebSocketEvent {
  type: 'memory_stored' | 'memory_retrieved' | 'memory_updated';
  data: {
    memoryId: string;
    type: 'semantic' | 'procedural' | 'episodic';
    relevanceScore?: number;
  };
}

// System Events
export interface SystemEvent extends WebSocketEvent {
  type: 'system_status' | 'performance_update' | 'error_alert';
  data: {
    status?: 'healthy' | 'degraded' | 'unhealthy';
    metrics?: {
      memoryUsage: number;
      cpuUsage: number;
      activeConnections: number;
    };
    alert?: {
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      component: string;
    };
  };
}

// Tool Events
export interface ToolEvent extends WebSocketEvent {
  type: 'tool_executed' | 'tool__error);
  data: {
    toolName: string;
    executionTime: number;
    success: boolean;
    result?: any;
    error: string;
  };
}

// Chat/Conversation Events
export interface ConversationEvent extends WebSocketEvent {
  type: 'message_received' | 'message_processed' | 'typing_started' | 'typing_stopped';
  data: {
    conversationId: string;
    messageId?: string;
    content: string;
    sender?: string;
    participants?: string[];
  };
}

// Voice/Speech Events
export interface SpeechEvent extends WebSocketEvent {
  type: 'speech_started' | 'speech_completed' | 'speech__error);
  data: {
    text: string;
    voice?: string;
    audioUrl?: string;
    duration?: number;
    error: string;
  };
}

// Knowledge Events
export interface KnowledgeEvent extends WebSocketEvent {
  type: 'knowledge_updated' | 'knowledge_searched' | 'knowledge_indexed';
  data: {
    source?: string;
    category?: string;
    itemsCount?: number;
    searchQuery?: string;
    results?: number;
  };
}

// Union type for all WebSocket events
export type AnyWebSocketEvent =
  | ConnectionEvent
  | AgentEvent
  | OrchestrationEvent
  | MemoryEvent
  | SystemEvent
  | ToolEvent
  | ConversationEvent
  | SpeechEvent
  | KnowledgeEvent;

// WebSocket Message Wrapper
export interface WebSocketMessage {
  event: AnyWebSocketEvent;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// Client-side WebSocket connection state
export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string;
  lastHeartbeat?: string;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  timeout: number;
}
