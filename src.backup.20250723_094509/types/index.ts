/**
 * Universal AI Tools - Shared Type Definitions
 *
 * This module exports all shared types for use across the application
 * and for coordination with the frontend.
 *
 * Usage:
 * import { ApiResponse, Agent, Memory } from '../types';
 * import type { WebSocketMessage } from '../types/websocket';
 * import { ErrorCode } from '../types/errors';
 */

// Re-export all API types
export * from './api';

// Re-export WebSocket types
export * from './websocket';

// Re-export Error types
export * from './errors';

// Version information for API compatibility
export const API_VERSION = '1.0.0';
export const TYPE_DEFINITIONS_VERSION = '1.0.0';

// Type guards for runtime type checking
export function isApiResponse<T = any>(obj: any): obj is import('./api').ApiResponse<T> {
  return typeof obj === 'object' && obj !== null && typeof obj.success === 'boolean';
}

export function isApiError(obj: any): obj is import('./api').ApiError {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.code === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.timestamp === 'string'
  );
}

export function isWebSocketMessage(obj: any): obj is import('./websocket').WebSocketMessage {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    obj.event &&
    typeof obj.event.type === 'string' &&
    typeof obj.event.timestamp === 'string'
  );
}

// Utility types for common patterns
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
export type OptionalExcept<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>;

// Common requestresponse wrappers
export type ApiRequest<T = any> = {
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    userAgent?: string;
    sessionId?: string;
  };
};

export type PaginatedResponse<T> = import('./api').ApiResponse<T[]> & {
  meta: import('./api').ResponseMeta & {
    pagination: import('./api').PaginationMeta;
  };
};

// Agent-specific type combinations
export type AgentWithMetrics = import('./api').Agent & {
  metrics: Required<import('./api').AgentMetrics>;
};

export type MemoryWithEmbedding = import('./api').Memory & {
  embedding: number[];
};

// WebSocket event type helpers
export type WebSocketEventType = import('./websocket').AnyWebSocketEvent['type'];
export type WebSocketEventData<T extends WebSocketEventType> = Extract<
  import('./websocket').AnyWebSocketEvent,
  { type: T }
>['data'];

// Error type helpers
export type ErrorCodeType = import('./errors').ErrorCode;
export type ErrorSeverityType = import('./errors').ErrorSeverity;

// Constants for frontend coordination
export const DEFAULT_API_CONFIG = {
  baseURL: 'http://localhost:9999/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
} as const;

export const DEFAULT_WEBSOCKET_CONFIG = {
  url: 'ws://localhost:9999/ws',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  timeout: 30000,
} as const;

export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 10,
  sort: 'createdAt',
  order: 'desc' as const,
};

// Type definitions for package.json if this becomes a shared package
export const PACKAGE_INFO = {
  name: '@universal-ai-tools/types',
  version: TYPE_DEFINITIONS_VERSION,
  description: 'Shared TypeScript type definitions for Universal AI Tools',
  main: 'index.ts',
  types: 'index.ts',
} as const;
