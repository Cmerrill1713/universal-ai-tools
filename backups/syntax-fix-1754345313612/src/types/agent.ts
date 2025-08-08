// Agent-related types;

export interface AgentContext {
  userRequest: string;
  requestId: string;
  sessionId?: string;
  userId?: string;
  workingDirectory?: string;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  response?: string;
  message?: string;
  confidence?: number;
  reasoning?: string,
  metadata?: Record<string, any>;
  error?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  type: string;
  description: string;
  capabilities: string[];
  maxTokens?: number;
  temperature?: number;
  priority?: number;
  maxLatencyMs?: number;
  retryAttempts?: number;
  dependencies?: string[];
  memoryEnabled?: boolean;
  toolExecutionEnabled?: boolean;
  allowedTools?: string[];
  isActive: boolean;
}

export interface AgentPerformanceMetrics {
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  lastRequestTime?: Date;
  uptime: number;
}

export enum AgentCategory {
  COGNITIVE = 'cognitive',
  PERSONAL = 'personal',
  SPECIALIZED = 'specialized',
  UTILITY = 'utility',
  CORE = 'core'
}

export interface AgentDefinition {
  id: string;
  name: string;
  category: AgentCategory;
  type: string;
  description: string;
  capabilities: string[];
  config: AgentConfig;
  version: string;
  isBuiltIn: boolean;
  priority?: number;
  dependencies?: string[];
  maxLatencyMs?: number;
  retryAttempts?: number;
  memoryEnabled?: boolean;
  className?: string;
  modulePath?: string;
  specification?: Record<string, any>;
  status?: 'active' | 'inactive' | 'pending' | 'error';
  createdAt?: Date | string;
  performance?: Record<string, any>;
  evolutionHistory?: Record<string, any>[];
}

export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  estimatedDuration: number;
  dependencies: string[];
  resources: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  tasks?: any[];
}

export interface MobileOptimizedRequest {
  taskType: 'quick_response' | 'deep_analysis' | 'creative_task' | 'ios_development' | 'swift_coding';
  userInput: string;
  deviceContext: {
    deviceId: string;
    batteryLevel: number;
    availableMemory: number;
    preferredBackend?: string;
    userId?: string;
  };
  optimizationPreferences: {
    prioritizeBattery: boolean;
    preferCachedResults: boolean;
    maxProcessingTime: number;
    qualityLevel: 'low' | 'balanced' | 'high';
  };
  contextEnrichment: boolean;
  userRequest?: string;
  maxContextTokens?: number;
  includeMemory?: boolean;
  prioritizeSpeed?: boolean;
}

export interface CodeAssistantResponse {
  code: string;
  explanation: string;
  language: string;
  confidence: number;
  suggestions?: string[];
  errors?: string[];
  warnings?: string[];
}