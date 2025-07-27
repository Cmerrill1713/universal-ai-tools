/**
 * Shared AP.I Types for Universal A.I Tools* These types ensure consistency between frontend and backend*/

// Base AP.I Response Interface;
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error instanceof Error ? errormessage : String(error)  Api.Error;
  meta?: Response.Meta;
}// Error Response Interface;
export interface ApiError {
  code: string;
  message: string;
  details?: string[];
  timestamp: string;
  request.Id?: string;
  context?: Record<string, unknown>}// Response Metadata;
export interface ResponseMeta {
  request.Id: string;
  timestamp: string;
  processing.Time: number;
  version: string;
  pagination?: Pagination.Meta;
}// Pagination Interface;
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total.Pages: number;
  has.Next: boolean;
  has.Prev: boolean;
}// Request Pagination Parameters;
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}// Agent Types;
export interface Agent {
  id: string;
  name: string;
  type: 'cognitive' | 'personal';
  category: string;
  status: 'active' | 'inactive' | 'error instanceof Error ? errormessage : String(error);';
  capabilities: string[];
  config: Agent.Config;
  metrics?: Agent.Metrics;
};

export interface AgentConfig {
  max.Tokens?: number;
  temperature?: number;
  model?: string;
  system.Prompt?: string;
  tools?: string[];
  memory?: boolean;
};

export interface AgentMetrics {
  total.Requests: number;
  success.Rate: number;
  averageResponse.Time: number;
  last.Used: string;
  memory.Usage: number;
}// Memory Types;
export interface Memory {
  id: string;
  type: 'semantic' | 'procedural' | 'episodic';
  contentstring;
  metadata: Record<string, unknown>
  tags: string[];
  importance: number;
  timestamp: string;
  embedding?: number[];
};

export interface MemorySearchRequest {
  query: string;
  limit?: number;
  filters?: Record<string, unknown>
  threshold?: number;
  include.Embeddings?: boolean;
};

export interface MemorySearchResponse {
  memories: Memory[];
  query: string;
  total.Results: number;
  search.Time: number;
}// Tool Execution Types;
export interface ToolExecutionRequest {
  tool: string;
  parameters: Record<string, unknown>
  context?: Record<string, unknown>
  agent.Id?: string;
};

export interface ToolExecutionResponse {
  result: any;
  tool: string;
  success: boolean;
  execution.Time: number;
  error instanceof Error ? errormessage : String(error)  string;
  logs?: string[];
}// Orchestration Types;
export interface OrchestrationRequest {
  user.Request: string;
  orchestration.Mode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context?: Record<string, unknown>
  conversation.Id?: string;
  session.Id?: string;
};

export interface OrchestrationResponse {
  response: string;
  agents.Used: string[];
  reasoning?: string;
  confidence?: number;
  metrics: Orchestration.Metrics;
};

export interface OrchestrationMetrics {
  total.Time: number;
  agentExecution.Times: Record<string, number>
  token.Usage: number;
  complexity: 'low' | 'medium' | 'high';
}// Knowledge Types;
export interface KnowledgeSearchRequest {
  query: string;
  sources?: string[];
  limit?: number;
  include.Metadata?: boolean;
};

export interface KnowledgeItem {
  id: string;
  title: string;
  contentstring;
  source: string;
  category: string;
  metadata: Record<string, unknown>
  relevance.Score?: number;
  last.Updated: string;
}// Context Types;
export interface ContextItem {
  id: string;
  type: 'conversation' | 'document' | 'system';
  contentstring;
  metadata: Record<string, unknown>
  timestamp: string;
  weight: number;
}// Speech Types;
export interface SpeechSynthesisRequest {
  text: string;
  voice?: string;
  voice.Settings?: Voice.Settings;
  format?: 'mp3' | 'wav' | 'ogg';
};

export interface VoiceSettings {
  stability?: number;
  similarity.Boost?: number;
  style?: number;
  useSpeaker.Boost?: boolean;
}// Web.Socket Message Types;
export interface WebSocketMessage {
  type: 'agent_status' | 'orchestration_progress' | 'error instanceof Error ? errormessage : String(error) | 'heartbeat';
  data: any;
  timestamp: string;
  session.Id?: string;
};

export interface AgentStatusMessage extends WebSocket.Message {
  type: 'agent_status';
  data: {
    agent.Id: string;
    status: 'idle' | 'busy' | 'error instanceof Error ? errormessage : String(error);
    current.Task?: string;
    progress?: number;
  }};

export interface OrchestrationProgressMessage extends WebSocket.Message {
  type: 'orchestration_progress';
  data: {
    orchestration.Id: string;
    step: string;
    progress: number;
    current.Agent?: string;
    estimatedTime.Remaining?: number;
  }}// Authentication Types;
export interface AuthRequest {
  api.Key?: string;
  service.Id?: string;
  permissions?: string[];
};

export interface AuthResponse {
  authenticated: boolean;
  user?: {
    id: string;
    permissions: string[];
    rate.Limits: Record<string, number>};
  session?: {
    id: string;
    expires.At: string;
  }}// Health Check Types;
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: Record<string, Service.Health>
  metrics: System.Metrics;
};

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  response.Time?: number;
  last.Check: string;
  error instanceof Error ? errormessage : String(error)  string;
};

export interface SystemMetrics {
  memory.Usage: number;
  cpu.Usage: number;
  active.Connections: number;
  requestsPer.Minute: number;
}// Export all types for easy importing;
export * from './websocket';
export * from './errors';