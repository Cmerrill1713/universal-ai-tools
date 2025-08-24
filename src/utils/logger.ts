import * as winston from 'winston';

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
  ML = 'ml',
  CONTEXT_INJECTION = 'context_injection',
  SYNTAX_FIXING = 'syntax_fixing',
  MONITORING = 'monitoring',
  WEBHOOK = 'webhook',
  STARTUP = 'startup',
  PROCESS = 'process',
}

const logLevel = process.env.LOG_LEVEL || 'warn'; // Reduce default log level to improve performance
const isDevelopment = process.env.NODE_ENV === 'development';

// Create optimized Winston logger with reduced overhead
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }), // Shorter timestamp format
    winston.format.errors({ stack: false }), // Disable stack traces for performance
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
      const contextStr = context ? `[${context}] ` : '';
      // Only include metadata for error and warn levels to reduce overhead
      const metaStr = (level === 'error' || level === 'warn') && Object.keys(meta).length 
        ? ` ${JSON.stringify(meta, null, 0)}` // Compact JSON formatting
        : '';
      return `${timestamp} ${level.toUpperCase()}: ${contextStr}${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), 
        winston.format.simple()
      ),
      // Add throttling for console output to prevent flooding
      handleExceptions: false,
      handleRejections: false,
    }),
  ],
  // Disable exception and rejection handling for performance
  handleExceptions: false,
  handleRejections: false,
  exitOnError: false,
});

// Add file transport for production
if (!isDevelopment) {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Enhanced logging methods with context and performance optimizations
export const log = {
  info: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    // Only log info in development or if explicitly enabled
    if (isDevelopment || process.env.LOG_LEVEL === 'info' || process.env.LOG_LEVEL === 'debug') {
      logger.info(message, { context, ...meta });
    }
  },

  error: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    logger.error(message, { context, ...meta });
  },

  warn: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    logger.warn(message, { context, ...meta });
  },

  debug: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    // Only log debug in development
    if (isDevelopment || process.env.LOG_LEVEL === 'debug') {
      logger.debug(message, { context, ...meta });
    }
  },
};

export { logger };
export default logger;
