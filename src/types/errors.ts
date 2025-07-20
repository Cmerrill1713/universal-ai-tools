/**
 * Error Types and Constants for Consistent Error Handling
 * Shared between frontend and backend for uniform error handling
 */

// Error Codes - Consistent across frontend and backend
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_API_KEY = 'INVALID_API_KEY',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',

  // Agent Related
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_UNAVAILABLE = 'AGENT_UNAVAILABLE',
  AGENT_EXECUTION_ERROR = 'AGENT_EXECUTION_ERROR',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  AGENT_OVERLOAD = 'AGENT_OVERLOAD',

  // Orchestration
  ORCHESTRATION_ERROR = 'ORCHESTRATION_ERROR',
  COORDINATION_FAILED = 'COORDINATION_FAILED',
  ORCHESTRATION_TIMEOUT = 'ORCHESTRATION_TIMEOUT',
  INVALID_ORCHESTRATION_MODE = 'INVALID_ORCHESTRATION_MODE',

  // Memory & Knowledge
  MEMORY_NOT_FOUND = 'MEMORY_NOT_FOUND',
  MEMORY_STORAGE_ERROR = 'MEMORY_STORAGE_ERROR',
  KNOWLEDGE_SEARCH_ERROR = 'KNOWLEDGE_SEARCH_ERROR',
  EMBEDDING_ERROR = 'EMBEDDING_ERROR',

  // Tools
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  INVALID_TOOL_PARAMETERS = 'INVALID_TOOL_PARAMETERS',

  // System & Infrastructure
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Network & Communication
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',

  // File & Upload
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_ERROR = 'UPLOAD_ERROR',

  // Speech & Audio
  SPEECH_SYNTHESIS_ERROR = 'SPEECH_SYNTHESIS_ERROR',
  AUDIO_PROCESSING_ERROR = 'AUDIO_PROCESSING_ERROR',
  VOICE_NOT_AVAILABLE = 'VOICE_NOT_AVAILABLE',

  // Configuration
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  FEATURE_NOT_ENABLED = 'FEATURE_NOT_ENABLED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION'
}

// Error Severity Levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Structured Error Interface
export interface AppError {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  details?: string | Record<string, any>;
  timestamp: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  stack?: string;
  context?: Record<string, any>;
}

// Error Response for API
export interface ErrorResponse {
  success: false;
  error: AppError;
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

// Validation Error Details
export interface ValidationError {
  field: string;
  value: any;
  message: string;
  constraint?: string;
}

export interface ValidationErrorResponse extends ErrorResponse {
  error: AppError & {
    code: ErrorCode.VALIDATION_ERROR;
    validationErrors: ValidationError[];
  };
}

// Rate Limit Error Details
export interface RateLimitError extends AppError {
  code: ErrorCode.RATE_LIMIT_EXCEEDED;
  retryAfter: number; // seconds
  limit: number;
  remaining: number;
  resetTime: string;
}

// Agent Error Details
export interface AgentError extends AppError {
  agentId: string;
  agentName: string;
  task?: string;
  executionTime?: number;
}

// Tool Error Details
export interface ToolError extends AppError {
  toolName: string;
  parameters?: Record<string, any>;
  executionTime?: number;
}

// System Error Details
export interface SystemError extends AppError {
  systemComponent: string;
  resourceUsage?: {
    memory: number;
    cpu: number;
  };
  dependencyStatus?: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

// Error Factory Functions for consistent error creation
export class ErrorFactory {
  static createValidationError(
    message: string,
    validationErrors: ValidationError[],
    requestId?: string
  ): ValidationErrorResponse {
    return {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date().toISOString(),
        requestId,
        validationErrors
      }
    };
  }

  static createAgentError(
    agentId: string,
    agentName: string,
    message: string,
    details?: any
  ): AgentError {
    return {
      code: ErrorCode.AGENT_EXECUTION_ERROR,
      message,
      severity: ErrorSeverity.HIGH,
      timestamp: new Date().toISOString(),
      agentId,
      agentName,
      details
    };
  }

  static createRateLimitError(
    limit: number,
    retryAfter: number
  ): RateLimitError {
    return {
      code: ErrorCode.RATE_LIMIT_EXCEEDED,
      message: `Rate limit exceeded. Maximum ${limit} requests allowed.`,
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date().toISOString(),
      retryAfter,
      limit,
      remaining: 0,
      resetTime: new Date(Date.now() + (retryAfter * 1000)).toISOString()
    };
  }

  static createSystemError(
    component: string,
    message: string,
    details?: any
  ): SystemError {
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message,
      severity: ErrorSeverity.CRITICAL,
      timestamp: new Date().toISOString(),
      systemComponent: component,
      details
    };
  }
}

// HTTP Status Code Mapping
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_FORMAT]: 400,
  [ErrorCode.REQUEST_TOO_LARGE]: 413,
  
  [ErrorCode.AGENT_NOT_FOUND]: 404,
  [ErrorCode.AGENT_UNAVAILABLE]: 503,
  [ErrorCode.AGENT_EXECUTION_ERROR]: 500,
  [ErrorCode.AGENT_TIMEOUT]: 408,
  [ErrorCode.AGENT_OVERLOAD]: 503,
  
  [ErrorCode.ORCHESTRATION_ERROR]: 500,
  [ErrorCode.COORDINATION_FAILED]: 500,
  [ErrorCode.ORCHESTRATION_TIMEOUT]: 408,
  [ErrorCode.INVALID_ORCHESTRATION_MODE]: 400,
  
  [ErrorCode.MEMORY_NOT_FOUND]: 404,
  [ErrorCode.MEMORY_STORAGE_ERROR]: 500,
  [ErrorCode.KNOWLEDGE_SEARCH_ERROR]: 500,
  [ErrorCode.EMBEDDING_ERROR]: 500,
  
  [ErrorCode.TOOL_NOT_FOUND]: 404,
  [ErrorCode.TOOL_EXECUTION_ERROR]: 500,
  [ErrorCode.TOOL_TIMEOUT]: 408,
  [ErrorCode.INVALID_TOOL_PARAMETERS]: 400,
  
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.CIRCUIT_BREAKER_OPEN]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  
  [ErrorCode.NETWORK_ERROR]: 500,
  [ErrorCode.TIMEOUT]: 408,
  [ErrorCode.CONNECTION_ERROR]: 500,
  [ErrorCode.WEBSOCKET_ERROR]: 500,
  
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.INVALID_FILE_TYPE]: 400,
  [ErrorCode.UPLOAD_ERROR]: 500,
  
  [ErrorCode.SPEECH_SYNTHESIS_ERROR]: 500,
  [ErrorCode.AUDIO_PROCESSING_ERROR]: 500,
  [ErrorCode.VOICE_NOT_AVAILABLE]: 404,
  
  [ErrorCode.CONFIGURATION_ERROR]: 500,
  [ErrorCode.FEATURE_NOT_ENABLED]: 501,
  [ErrorCode.INVALID_CONFIGURATION]: 500
};