/**
 * Enhanced Logger - Structured logging with context and metadata
 */

export interface LogContext {
  timestamp?: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
  service?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error | any, metadata?: Record<string, any>): void {
    const logMetadata = {
      ...metadata,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };
    this.log('error', message, logMetadata);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  private log(level: string, message: string, metadata?: Record<string, any>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.context.service || 'universal-ai-tools',
      correlationId: this.context.correlationId,
      metadata: {
        ...this.context.metadata,
        ...metadata
      }
    };

    // Simple console output for now
    const colorMap = {
      info: '\x1b[36m', // cyan
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
      debug: '\x1b[90m' // gray
    };
    
    const color = colorMap[level as keyof typeof colorMap] || '';
    const reset = '\x1b[0m';
    
    console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`, 
      metadata ? JSON.stringify(metadata) : '');
  }

  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context });
  }
}

// Export default logger instance
export const logger = new Logger({ service: 'universal-ai-tools' });

export default logger;
