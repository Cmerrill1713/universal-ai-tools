// Main types export file;

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | { code: string; message: string; details?: any };
  message?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ServiceCredentials {
  apiKey: string;
  endpoint?: string;
  model?: string;
}

export interface ServiceConfiguration {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  credentials?: ServiceCredentials;
  metadata?: Record<string, any>;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface EnvironmentConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  apiKeys: Record<string, string>;
}

export * from './agent';
export * from './llm';
export * from './memory';
export * from './vision';
export * from './ab-mcts';
export * from './architecture';

// Additional missing types;
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data?: T[];
  pagination: PaginationMeta;
  error?: string | { code: string; message: string; details?: any };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export enum ErrorCode {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export interface ServiceConfig {
  host: string;
  port: number;
  timeout?: number;
  retryAttempts?: number;
  enableHealthCheck?: boolean;
  database?: {
    url: string;
    host: string;
    port: number;
    name: string;
    poolSize?: number;
    ssl?: boolean;
    maxConnections?: number;
  };
  redis?: {
    url: string;
    host: string;
    port: number;
    retryAttempts?: number;
  };
  supabase?: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  environment?: string;
  jwt?: {
    secret: string;
    expiresIn: string;
  };
}

export interface OptimizedParameters {
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  confidence: number;
  reasoning: string;
  contextLength?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  userPromptTemplate?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  explanation?: string;
}

export interface VisionDebugData {
  imageUrl: string;
  analysis: string;
  metadata: Record<string, any>;
  timestamp: string;
  console_errors?: Array<{
    message: string;
    file?: string;
    line?: number;
    severity: 'error' | 'warning' | 'info';
  }>;
  ui_elements?: Array<{
    type: string;
    coordinates?: { x: number; y: number; width: number; height: number };
    text?: string;
    severity: string;
    description: string;
  }>;
  network_issues?: Array<{
    url: string;
    status: number;
    method: string;
    responseTime?: number;
    error?: string;
  }>;
  performance?: Array<{
    name: string;
    value: number;
    threshold?: number;
  }>;
  confidence?: number;
  fallback?: boolean;
}

export interface ExpectedOutcome {
  description: string;
  confidence: number;
  metadata?: Record<string, any>;
  objects?: VisualObject[];
}

export interface LearningDelta {
  parameter: string;
  oldValue: any;
  newValue: any;
  improvement: number;
  added?: any[];
}

export interface ObjectDifference {
  added: any[];
  removed: any[];
  modified: any[];
}

export interface VisualObject {
  id: string;
  type: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  metadata?: Record<string, any>;
  class?: string;
}

export enum LogContext {
  ERROR = 'ERROR',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  WARN = 'WARN',
  PROJECT = 'PROJECT',
  WEBSOCKET = 'WEBSOCKET'
}

// Missing types from AB-MCTS Auto Pilot Service;
export interface AnalysisResult {
  status: 'success' | 'error' | 'pending';
  insights: string[];
  recommendations: string[];
  confidence: number;
  metadata?: Record<string, any>;
  // Performance analysis properties;
  averageScore?: number;
  averageTime?: number;
  totalFeedback?: number;
  scoreDistribution?: Record<string, number>;
  trends?: Record<string, any>;
  improving?: boolean;
  recentAverage?: number;
  historicalAverage?: number;
  trend?: number;
}

export interface AutoPilotResult {
  taskId: string;
  decision: string;
  executedActions: string[];
  outcome: 'success' | 'failure' | 'partial';
  performance: {
    executionTime: number;
    resourcesUsed: number;
    confidence: number;
  };
  learningDeltas: LearningDelta[];
  nextSteps: string[];
  totalTime?: number;
  resourcesUsed?: {
    tokensUsed?: number;
    agents?: number;
  };
  searchResult?: any;
}

export interface FeedbackItem {
  id: string;
  type: 'positive' | 'negative' | 'neutral';
  rating: number; // 1-5 scale;
  comment?: string;
  metadata: Record<string, any>;
  timestamp: number;
  source: string;
  score?: number;
  reward?: number;
  processingTime?: number;
}

export interface PerformanceAnalysisData {
  metrics: {
    avgResponseTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
  };
  trends: {
    direction: 'improving' | 'degrading' | 'stable';
    strength: number;
    timeframe: string;
  };
  benchmarks: Record<string, number>;
  recommendations: string[];
}

export interface UpdateData {
  id: string;
  type: 'parameter' | 'model' | 'strategy' | 'configuration';
  changes: Record<string, any>;
  reason: string;
  expectedImpact: number;
  rollbackPlan?: string;
  timestamp: number;
  // Metrics-specific properties;
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
  processingTime?: number;
}

// Add EmbeddingResult for server?.ts;
export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
  metadata?: Record<string, any>;
}

// Add AgentRequest for mobile-dspy-orchestrator?.ts;
export interface AgentRequest {
  id: string;
  type: string;
  payload: Record<string, any>;
  timestamp: number;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}