/**
 * Universal AI Tools - Utilities
 * Common utility functions and logging
 */

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: LogContext): string {
    const timestamp = new Date().toISOString();
    const context = { ...this.context, ...data };
    
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...context
    });
  }

  info(message: string, data?: LogContext): void {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: LogContext): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: LogContext): void {
    console.error(this.formatMessage('error', message, data));
  }

  debug(message: string, data?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, data));
    }
  }
}

export const logger = new Logger();

export const formatResponse = (data: any, status: string = 'success') => {
  return {
    status,
    data,
    timestamp: new Date().toISOString()
  };
};

export const logRequest = (path: string, method: string, context?: LogContext): void => {
  logger.info(`${method} ${path}`, context);
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const sanitizeInput = (input: string): string => {
  return input.replace(/[<>]/g, '');
};

export default {
  logger,
  formatResponse,
  logRequest,
  delay,
  isValidUrl,
  sanitizeInput
};