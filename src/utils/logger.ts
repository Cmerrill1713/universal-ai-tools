import winston from 'winston';

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
}

const logLevel = process.env.LOG_LEVEL || 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

// Create Winston logger
const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
      const contextStr = context ? `[${context}] ` : '';
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level.toUpperCase()}: ${contextStr}${message}${metaStr}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
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

// Enhanced logging methods with context
export const log = {
  info: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    logger.info(message, { context, ...meta });
  },

  error: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    logger.error(message, { context, ...meta });
  },

  warn: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    logger.warn(message, { context, ...meta });
  },

  debug: (message: string, context?: LogContext, meta?: Record<string, unknown>) => {
    logger.debug(message, { context, ...meta });
  },
};

export { logger };
export default logger;
