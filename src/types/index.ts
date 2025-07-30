// Core Types for Universal AI Tools
export interface AgentConfig {
  name: string;,
  description: string;
  priority: number;,
  capabilities: AgentCapability[];
  maxLatencyMs: number;,
  retryAttempts: number;
  dependencies: string[];
  memoryEnabled?: boolean;
  toolExecutionEnabled?: boolean;
  allowedTools?: string[];
}

export interface AgentCapability {
  name: string;,
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  requiresTools?: string[];
}

export interface AgentContext {
  userRequest: string;,
  requestId: string;
  workingDirectory?: string;
  memoryContext?: unknown;
  userId?: string;
  previousContext?: unknown;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;,
  data: unknown;
  confidence: number;,
  message: string;
  reasoning: string;
  metadata?: Record<string, unknown>;
}

export interface Memory {
  id: string;,
  type: string;
  content: string;,
  metadata: Record<string, unknown>;
  tags: string[];,
  importance: number;
  timestamp: string;
  embedding?: number[];
}

export interface OrchestrationRequest {
  requestId: string;,
  userRequest: string;
  userId: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';'
  context: Record<string, unknown>;
  timestamp: Date;
}

export interface OrchestrationResponse {
  requestId: string;,
  success: boolean;
  mode: string;,
  result: unknown;
  complexity?: string;
  confidence?: number;
  reasoning?: string;
  participatingAgents?: string[];
  executionTime?: number;
  error?: string;
}

export enum AgentCategory {
  CORE = 'core','
  COGNITIVE = 'cognitive','
  PERSONAL = 'personal','
  UTILITY = 'utility','
  SPECIALIZED = 'specialized','
}

export interface AgentDefinition {
  name: string;,
  category: AgentCategory;
  description: string;,
  priority: number;
  className: string;,
  modulePath: string;
  dependencies: string[];,
  capabilities: string[];
  memoryEnabled: boolean;,
  maxLatencyMs: number;
  retryAttempts: number;
}

export interface ServiceConfig {
  port: number;,
  environment: string;
  database: {,
    url: string;
    poolSize: number;
  };
  redis?: {
    url: string;,
    retryAttempts: number;
  };
  supabase: {,
    url: string;
    anonKey: string;,
    serviceKey: string;
  };
  jwt: {,
    secret: string;
    expiresIn: string;
  };
  llm: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaUrl?: string;
  };
  vision: {,
    enableSdxlRefiner: boolean;
    sdxlRefinerPath: string;,
    preferredBackend: 'mlx' | 'gguf' | 'auto';'
    maxVram: number;,
    enableCaching: boolean;
  };
}

export interface ErrorCode {
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD';,'
  INVALID_FORMAT: 'INVALID_FORMAT';'
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE';,'
  MEMORY_STORAGE_ERROR: 'MEMORY_STORAGE_ERROR';'
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR';,'
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR';'
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND';,'
  ORCHESTRATION_ERROR: 'ORCHESTRATION_ERROR';'
  VALIDATION_ERROR: 'VALIDATION_ERROR';,'
  NOT_FOUND: 'NOT_FOUND';'
  UNAUTHORIZED: 'UNAUTHORIZED';,'
  INTERNAL_ERROR: 'INTERNAL_ERROR';'
  ANALYSIS_ERROR: 'ANALYSIS_ERROR';,'
  GENERATION_ERROR: 'GENERATION_ERROR';'
  EMBEDDING_ERROR: 'EMBEDDING_ERROR';,'
  SERVICE_ERROR: 'SERVICE_ERROR';'
  REFINEMENT_ERROR: 'REFINEMENT_ERROR';'
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: keyof ErrorCode;,
    message: string;
    details?: unknown;
  };
  metadata?: {
    requestId: string;,
    timestamp: string;
    version: string;
    processingTime?: number;
  };
}

export interface PaginationMeta {
  page: number;,
  limit: number;
  total: number;,
  totalPages: number;
  hasNext: boolean;,
  hasPrev: boolean;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}
