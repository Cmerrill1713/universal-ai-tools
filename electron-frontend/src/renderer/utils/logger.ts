/**
 * Development-aware Logger Utility
 * Prevents ESLint console statement warnings while providing proper logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private static isDev = process.env.NODE_ENV === 'development';

  static debug(...args: unknown[]): void {
    if (this.isDev) {
      console.log('[DEBUG]', ...args);
    }
  }

  static info(...args: unknown[]): void {
    if (this.isDev) {
      console.info('[INFO]', ...args);
    }
  }

  static warn(...args: unknown[]): void {
    console.warn('[WARN]', ...args);
  }

  static error(...args: unknown[]): void {
    console.error('[ERROR]', ...args);
  }

  static log(...args: unknown[]): void {
    if (this.isDev) {
      console.log('[LOG]', ...args);
    }
  }

  // Conditional logging based on level
  static conditionalLog(level: LogLevel, ...args: unknown[]): void {
    switch (level) {
      case 'debug':
        this.debug(...args);
        break;
      case 'info':
        this.info(...args);
        break;
      case 'warn':
        this.warn(...args);
        break;
      case 'error':
        this.error(...args);
        break;
    }
  }

  // Component-specific logging
  static component(componentName: string, message: string, ...args: unknown[]): void {
    if (this.isDev) {
      console.log(`[COMPONENT:${componentName}]`, message, ...args);
    }
  }

  // Performance logging
  static perf(label: string, ...args: unknown[]): void {
    if (this.isDev) {
      console.log(`[PERF:${label}]`, ...args);
    }
  }
}

export default Logger;
export { Logger };
export const logger = Logger;
