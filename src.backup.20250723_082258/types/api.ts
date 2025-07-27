/**
 * Shared API Types for Universal AI Tools
 * These types ensure consistency between frontend and backend
 */

// Base API Response Interface
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  _error: ApiError;
  meta?: ResponseMeta;
}

// Error Response Interface
export interface ApiError {
  code: string;
  message: string;
  details?: string[];
  timestamp: string;
  requestId?: string;
  context?: Record<string, unknown>;
}

// Response Metadata
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  processingTime: number;
  version: string;
  pagination?: PaginationMeta;
}

// Pagination Interface
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Request Pagination Parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  type: 'cognitive' | 'personal';
  category: string;
  status: 'active' | 'inactive' | '_error;
  capabilities: string[];
  config: AgentConfig;
  metrics?: AgentMetrics;
}

export interface AgentConfig {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  memory?: boolean;
}

export interface AgentMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastUsed: string;
  memoryUsage: number;
}

// Memory Types
export interface Memory {
  id: string;
  type: 'semantic' | 'procedural' | 'episodic';
  _content string;
  metadata: Record<string, unknown>;
  tags: string[];
  importance: number;
  timestamp: string;
  embedding?: number[];
}

export interface MemorySearchRequest {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>;
  threshold?: number;
  includeEmbeddings?: boolean;
}

export interface MemorySearchResponse {
  memories: Memory[];
  query: string;
  totalResults: number;
  searchTime: number;
}

// Tool Execution Types
export interface ToolExecutionRequest {
  tool: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
  agentId?: string;
}

export interface ToolExecutionResponse {
  result: any;
  tool: string;
  success: boolean;
  executionTime: number;
  _error: string;
  logs?: string[];
}

// Orchestration Types
export interface OrchestrationRequest {
  userRequest: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context?: Record<string, unknown>;
  conversationId?: string;
  sessionId?: string;
}

export interface OrchestrationResponse {
  response: string;
  agentsUsed: string[];
  reasoning?: string;
  confidence?: number;
  metrics: OrchestrationMetrics;
}

export interface OrchestrationMetrics {
  totalTime: number;
  agentExecutionTimes: Record<string, number>;
  tokenUsage: number;
  complexity: 'low' | 'medium' | 'high';
}

// Knowledge Types
export interface KnowledgeSearchRequest {
  query: string;
  sources?: string[];
  limit?: number;
  includeMetadata?: boolean;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  _content string;
  source: string;
  category: string;
  metadata: Record<string, unknown>;
  relevanceScore?: number;
  lastUpdated: string;
}

// Context Types
export interface ContextItem {
  id: string;
  type: 'conversation' | 'document' | 'system';
  _content string;
  metadata: Record<string, unknown>;
  timestamp: string;
  weight: number;
}

// Speech Types
export interface SpeechSynthesisRequest {
  text: string;
  voice?: string;
  voiceSettings?: VoiceSettings;
  format?: 'mp3' | 'wav' | 'ogg';
}

export interface VoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'agent_status' | 'orchestration_progress' | '_error | 'heartbeat';
  data: any;
  timestamp: string;
  sessionId?: string;
}

export interface AgentStatusMessage extends WebSocketMessage {
  type: 'agent_status';
  data: {
    agentId: string;
    status: 'idle' | 'busy' | '_error;
    currentTask?: string;
    progress?: number;
  };
}

export interface OrchestrationProgressMessage extends WebSocketMessage {
  type: 'orchestration_progress';
  data: {
    orchestrationId: string;
    step: string;
    progress: number;
    currentAgent?: string;
    estimatedTimeRemaining?: number;
  };
}

// Authentication Types
export interface AuthRequest {
  apiKey?: string;
  serviceId?: string;
  permissions?: string[];
}

export interface AuthResponse {
  authenticated: boolean;
  user?: {
    id: string;
    permissions: string[];
    rateLimits: Record<string, number>;
  };
  session?: {
    id: string;
    expiresAt: string;
  };
}

// Health Check Types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: Record<string, ServiceHealth>;
  metrics: SystemMetrics;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  _error: string;
}

export interface SystemMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
}

// Export all types for easy importing
export * from './websocket';
export * from './errors';
