import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface SQLProtectionOptions {
  blockOnDetection?: boolean;
  logAttempts?: boolean;
  customPatterns?: RegExp[];
  allowedSQLKeywords?: string[];
  checkHeaders?: boolean;
  checkCookies?: boolean;
}

export class SQLInjectionProtection {
  private options: Required<SQLProtectionOptions>;
  private suspiciousIPs: Map<string, number> = new Map();
  
  // Common SQL injection patterns
  private sqlPatterns: RegExp[] = [
    // Basic SQL injection patterns
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b[\s\S]*\b(from|into|where|table|database)\b)/gi,
    
    // SQL comments
    /(--|#|\/\*|\*\/)/g,
    
    // SQL operators and functions
    /(\b(and|or)\b\s*\d+\s*=\s*\d+)/gi,
    /(\b(and|or)\b\s*'[^']*'\s*=\s*'[^']*')/gi,
    
    // Common SQL injection payloads
    /('|(\')|"|(\"))\s*(or|and)\s*(\'|\"|\d+)\s*=\s*(\'|\"|\d+)/gi,
    /(\d+\s*(or|and)\s*\d+\s*=\s*\d+)/gi,
    
    // Hex encoding attempts
    /(0x[0-9a-f]+)/gi,
    
    // Time-based blind SQL injection
    /(sleep|benchmark|waitfor\s+delay|pg_sleep)\s*\(/gi,
    
    // Stacked queries
    /;\s*(select|insert|update|delete|drop|create)/gi,
    
    // SQL functions that can be abused
    /(concat|substring|ascii|char|length|lower|upper|substr)\s*\(/gi,
    
    // Database-specific dangerous functions
    /(load_file|into\s+(out|dump)file|information_schema|sysobjects|syscolumns|xp_cmdshell)/gi,
    
    // Boolean-based blind SQL injection
    /(\b(true|false)\b\s*(and|or)\s*\d+\s*=\s*\d+)/gi,
    
    // UNION-based attacks
    /union\s+(all\s+)?select/gi,
    
    // Escape sequence abuse
    /(\\x[0-9a-f]{2}|\\[0-7]{1,3})/gi,
  ];
  
  // Additional patterns for NoSQL injection
  private noSqlPatterns: RegExp[] = [
    // MongoDB injection patterns
    /(\$\w+)\s*:/g,
    /\{[^}]*\$\w+[^}]*\}/g,
    
    // JavaScript injection in NoSQL
    /function\s*\(/g,
    /\bthis\b/g,
  ];

  constructor(options: SQLProtectionOptions = {}) {
    this.options = {
      blockOnDetection: options.blockOnDetection ?? true,
      logAttempts: options.logAttempts ?? true,
      customPatterns: options.customPatterns || [],
      allowedSQLKeywords: options.allowedSQLKeywords || [],
      checkHeaders: options.checkHeaders ?? true,
      checkCookies: options.checkCookies ?? true,
    };
  }

  /**
   * Main middleware function
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const suspicious = this.checkRequest(req);
        
        if (suspicious.length > 0) {
          this.handleSuspiciousRequest(req, res, suspicious);
          
          if (this.options.blockOnDetection) {
            return res.status(400).json({
              error: 'Invalid request',
              message: 'Your request contains potentially malicious content',
            });
          }
        }
        
        next();
      } catch (error) {
        logger.error('SQL injection protection error:', error);
        // Fail open to avoid blocking legitimate requests
        next();
      }
    };
  }

  /**
   * Check entire request for SQL injection attempts
   */
  private checkRequest(req: Request): string[] {
    const suspicious: string[] = [];
    
    // Check URL path
    if (this.containsSQLInjection(req.path)) {
      suspicious.push(`Path: ${req.path}`);
    }
    
    // Check query parameters
    if (req.query) {
      const queryCheck = this.checkObject(req.query, 'Query');
      suspicious.push(...queryCheck);
    }
    
    // Check body
    if (req.body) {
      const bodyCheck = this.checkObject(req.body, 'Body');
      suspicious.push(...bodyCheck);
    }
    
    // Check headers if enabled
    if (this.options.checkHeaders && req.headers) {
      const headerCheck = this.checkHeaders(req.headers);
      suspicious.push(...headerCheck);
    }
    
    // Check cookies if enabled
    if (this.options.checkCookies && req.cookies) {
      const cookieCheck = this.checkObject(req.cookies, 'Cookie');
      suspicious.push(...cookieCheck);
    }
    
    return suspicious;
  }

  /**
   * Check object recursively for SQL injection
   */
  private checkObject(obj: any, prefix: string): string[] {
    const suspicious: string[] = [];
    
    if (!obj || typeof obj !== 'object') {
      return suspicious;
    }
    
    for (const [key, value] of Object.entries(obj)) {
      // Check the key itself
      if (this.containsSQLInjection(key)) {
        suspicious.push(`${prefix} key: ${key}`);
      }
      
      // Check the value
      if (typeof value === 'string') {
        if (this.containsSQLInjection(value)) {
          suspicious.push(`${prefix} ${key}: ${this.truncate(value)}`);
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'string' && this.containsSQLInjection(item)) {
            suspicious.push(`${prefix} ${key}[${index}]: ${this.truncate(item)}`);
          } else if (typeof item === 'object') {
            const nested = this.checkObject(item, `${prefix} ${key}[${index}]`);
            suspicious.push(...nested);
          }
        });
      } else if (typeof value === 'object') {
        const nested = this.checkObject(value, `${prefix} ${key}`);
        suspicious.push(...nested);
      }
    }
    
    return suspicious;
  }

  /**
   * Check headers for SQL injection
   */
  private checkHeaders(headers: any): string[] {
    const suspicious: string[] = [];
    const headersToCheck = ['user-agent', 'referer', 'x-forwarded-for', 'x-real-ip'];
    
    for (const header of headersToCheck) {
      if (headers[header] && this.containsSQLInjection(headers[header])) {
        suspicious.push(`Header ${header}: ${this.truncate(headers[header])}`);
      }
    }
    
    return suspicious;
  }

  /**
   * Check if string contains SQL injection patterns
   */
  private containsSQLInjection(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    
    // Convert to lowercase for case-insensitive matching
    const lowercaseValue = value.toLowerCase();
    
    // Skip if it's an allowed SQL keyword
    if (this.options.allowedSQLKeywords.some(keyword => 
      lowercaseValue === keyword.toLowerCase()
    )) {
      return false;
    }
    
    // Check against all patterns
    const allPatterns = [
      ...this.sqlPatterns,
      ...this.noSqlPatterns,
      ...this.options.customPatterns,
    ];
    
    return allPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Handle suspicious request
   */
  private handleSuspiciousRequest(req: Request, res: Response, suspicious: string[]): void {
    const ip = this.getClientIP(req);
    
    // Track suspicious IPs
    const count = (this.suspiciousIPs.get(ip) || 0) + 1;
    this.suspiciousIPs.set(ip, count);
    
    if (this.options.logAttempts) {
      logger.warn('SQL injection attempt detected', {
        ip,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        suspicious: suspicious.slice(0, 5), // Limit logged items
        attemptCount: count,
      });
    }
    
    // Auto-block IP after multiple attempts
    if (count > 5) {
      logger.error('Multiple SQL injection attempts from IP', {
        ip,
        attemptCount: count,
      });
      // You might want to integrate with a firewall or IP blocking service here
    }
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  /**
   * Truncate string for logging
   */
  private truncate(str: string, length: number = 100): string {
    return str.length > length ? str.substring(0, length) + '...' : str;
  }

  /**
   * Sanitize SQL query parameters
   */
  public static sanitizeParam(param: any): string {
    if (param === null || param === undefined) {
      return 'NULL';
    }
    
    if (typeof param === 'number') {
      return param.toString();
    }
    
    if (typeof param === 'boolean') {
      return param ? 'TRUE' : 'FALSE';
    }
    
    if (param instanceof Date) {
      return `'${param.toISOString()}'`;
    }
    
    // For strings, escape single quotes and remove dangerous characters
    if (typeof param === 'string') {
      return "'" + param
        .replace(/'/g, "''")  // Escape single quotes
        .replace(/\\/g, '\\\\') // Escape backslashes
        .replace(/\0/g, '')     // Remove null bytes
        .replace(/\n/g, '\\n')  // Escape newlines
        .replace(/\r/g, '\\r')  // Escape carriage returns
        .replace(/\x1a/g, '')   // Remove SUB character
        + "'";
    }
    
    // For arrays and objects, JSON stringify and treat as string
    return SQLInjectionProtection.sanitizeParam(JSON.stringify(param));
  }

  /**
   * Create parameterized query helper
   */
  public static parameterize(query: string, params: any[]): {
    query: string;
    params: any[];
  } {
    let paramIndex = 0;
    const sanitizedParams: any[] = [];
    
    // Replace ? placeholders with $1, $2, etc. for PostgreSQL
    const parameterizedQuery = query.replace(/\?/g, () => {
      paramIndex++;
      return `$${paramIndex}`;
    });
    
    // Sanitize parameters
    for (const param of params) {
      sanitizedParams.push(param); // Let the database driver handle escaping
    }
    
    return {
      query: parameterizedQuery,
      params: sanitizedParams,
    };
  }

  /**
   * Validate table/column names (for dynamic queries)
   */
  public static validateIdentifier(identifier: string): boolean {
    // Allow only alphanumeric characters, underscores, and dots (for schema.table)
    const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/;
    return identifierPattern.test(identifier);
  }

  /**
   * Get suspicious IP statistics
   */
  public getStats(): {
    totalSuspiciousIPs: number;
    topOffenders: Array<{ ip: string; attempts: number }>;
  } {
    const topOffenders = Array.from(this.suspiciousIPs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, attempts]) => ({ ip, attempts }));
    
    return {
      totalSuspiciousIPs: this.suspiciousIPs.size,
      topOffenders,
    };
  }

  /**
   * Clear suspicious IP tracking
   */
  public clearTracking(): void {
    this.suspiciousIPs.clear();
  }
}

// Create default instance
export const sqlProtection = new SQLInjectionProtection();

// Export middleware
export const preventSQLInjection = sqlProtection.middleware();

// Export utilities
export const { sanitizeParam, parameterize, validateIdentifier } = SQLInjectionProtection;

export default SQLInjectionProtection;