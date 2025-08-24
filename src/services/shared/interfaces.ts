/**
 * Common Service Interfaces
 * Standard interfaces and types for all services in the Universal AI Tools platform
 */

// ============================================================================
// Base Service Interface
// ============================================================================

export interface BaseService {
  readonly name: string;
  readonly version: string;
  status: 'active' | 'inactive' | 'error' | 'initializing';
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// Service Status and Health
// ============================================================================

export interface ServiceStatus {
  name: string;
  status: 'active' | 'inactive' | 'error' | 'initializing';
  uptime: number;
  lastHealthCheck?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
  error?: string;
  responseTime?: number;
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface ServiceConfig {
  enabled: boolean;
  retryAttempts: number;
  timeout: number;
  healthCheckInterval: number;
  [key: string]: any;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  poolSize?: number;
}

export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
}

// ============================================================================
// AI/LLM Service Interfaces
// ============================================================================

export interface LLMProvider {
  name: string;
  type: 'local' | 'remote' | 'hybrid';
  models: string[];
  endpoint?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMRequest {
  model: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  systemPrompt?: string;
  stream?: boolean;
  user?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  responseTime: number;
  metadata?: Record<string, any>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  type: 'text' | 'multimodal' | 'code' | 'embedding';
  contextLength: number;
  inputCost?: number;
  outputCost?: number;
  available: boolean;
}

// ============================================================================
// Memory and Context Interfaces
// ============================================================================

export interface MemoryEntry {
  id: string;
  userId: string;
  sessionId?: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
  expiresAt?: Date;
}

export interface ContextQuery {
  query: string;
  userId: string;
  sessionId?: string;
  limit?: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface ContextResult {
  entries: MemoryEntry[];
  totalResults: number;
  searchTime: number;
  relevanceScores: number[];
}

// ============================================================================
// Monitoring and Analytics Interfaces
// ============================================================================

export interface MetricPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  uptime: number;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

// ============================================================================
// Error and Alert Interfaces
// ============================================================================

export interface ServiceError {
  id: string;
  service: string;
  type: 'connection' | 'timeout' | 'validation' | 'internal' | 'external';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export interface Alert {
  id: string;
  service: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// ============================================================================
// User and Authentication Interfaces
// ============================================================================

export interface User {
  id: string;
  email?: string;
  isAdmin?: boolean;
  permissions?: string[];
  deviceId?: string;
  deviceType?: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
  trusted?: boolean;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  streamResponses?: boolean;
  enableAnalytics?: boolean;
  notifications?: NotificationPreferences;
}

export interface NotificationPreferences {
  email?: boolean;
  push?: boolean;
  desktop?: boolean;
  alerts?: boolean;
  marketing?: boolean;
}

// ============================================================================
// Communication and Integration Interfaces
// ============================================================================

export interface ExternalAPI {
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  baseDelay: number;
  maxDelay: number;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events: string[];
  headers?: Record<string, string>;
  retryPolicy?: RetryPolicy;
}

// ============================================================================
// File and Storage Interfaces
// ============================================================================

export interface FileMetadata {
  filename: string;
  size: number;
  mimeType: string;
  checksum?: string;
  uploadedAt: Date;
  uploadedBy?: string;
  tags?: string[];
}

export interface StorageProvider {
  name: string;
  type: 'local' | 's3' | 'gcs' | 'azure';
  config: Record<string, any>;
  upload(file: Buffer, metadata: FileMetadata): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

// ============================================================================
// Task and Queue Interfaces
// ============================================================================

export interface Task {
  id: string;
  type: string;
  priority: number;
  data: Record<string, any>;
  createdAt: Date;
  scheduledAt?: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  result?: any;
}

export interface QueueConfig {
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
  priority: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ServiceType = 
  | 'llm-provider'
  | 'memory-store'
  | 'cache'
  | 'database'
  | 'monitoring'
  | 'authentication'
  | 'file-storage'
  | 'queue'
  | 'external-api'
  | 'bridge'
  | 'tool'
  | 'analytics';

export type ServiceDomain = 
  | 'core'
  | 'memory'
  | 'monitoring'
  | 'infrastructure'
  | 'communication'
  | 'user'
  | 'agents'
  | 'tools'
  | 'training';

export type Environment = 'development' | 'staging' | 'production';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================================================
// Generic Response Types
// ============================================================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    requestId?: string;
    timestamp?: string;
    version?: string;
  };
}

export interface PaginatedResponse<T = any> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export interface ServiceEvent {
  type: string;
  service: string;
  timestamp: Date;
  data: Record<string, any>;
}

export type ServiceEventType = 
  | 'service.initialized'
  | 'service.shutdown'
  | 'service.error'
  | 'service.health-check'
  | 'service.config-updated'
  | 'request.started'
  | 'request.completed'
  | 'request.failed'
  | 'alert.created'
  | 'alert.resolved'
  | 'user.authenticated'
  | 'user.action';