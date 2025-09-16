/**
 * Logging types and enums
 */

export enum LogContext {
  SERVER = 'server',
  API = 'api',
  AGENT = 'agent',
  MEMORY = 'memory',
  DATABASE = 'database',
  DSPY = 'dspy',
  SYSTEM = 'system',
  AUTH = 'auth',
  WEBSOCKET = 'websocket',
  AI = 'ai',
  CONFIG = 'config',
  CACHE = 'cache',
  SECURITY = 'security',
  MCP = 'mcp',
  SERVICE = 'service',
  CONTEXT_INJECTION = 'context_injection',
  MIDDLEWARE = 'middleware',
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  meta?: Record<string, any>;
}

export interface Logger {
  info(message: string, context?: LogContext, meta?: Record<string, any>): void;
  error(message: string, context?: LogContext, meta?: Record<string, any>): void;
  warn(message: string, context?: LogContext, meta?: Record<string, any>): void;
  debug(message: string, context?: LogContext, meta?: Record<string, any>): void;
}
