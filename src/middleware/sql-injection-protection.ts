import type { Request, Response, NextFunction } from 'express';
import sqlstring from 'sqlstring';
import { log, LogContext } from '../utils/logger';
import { sendError } from '../utils/api-response';

/**
 * SQL Injection Protection Middleware
 * Validates and sanitizes inputs to prevent SQL injection attacks
 */

// Patterns that indicate potential SQL injection attempts
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|declare|script|javascript|vbscript|onload|onclick|onerror|onmouseover|alert|confirm|prompt)\b)/gi,
  /(-{2}|\/\*|\*\/|;|\||&&|\|\|)/g, // SQL comments and operators
  /(xp_|sp_|@@|0x|hex|char|nchar|varchar|nvarchar|cast|convert|exec)/gi, // SQL functions
  /(<script|<\/script|<iframe|<\/iframe|javascript:|vbscript:|onload=|onerror=|onclick=)/gi, // XSS patterns
];

// Fields that commonly contain SQL queries (these need special handling)
const SQL_QUERY_FIELDS = ['query', 'search', 'filter', 'where', 'orderBy', 'groupBy'];

/**
 * Check if a value contains potential SQL injection patterns
 */
function containsSQLInjection(value: string): boolean {
  if (typeof value !== 'string') return false;
  
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Sanitize a SQL value
 */
function sanitizeSQLValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number') {
    return value.toString();
  }
  
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  
  if (value instanceof Date) {
    return sqlstring.escape(value.toISOString());
  }
  
  // For strings, use sqlstring to properly escape
  return sqlstring.escape(value);
}

/**
 * Recursively check object for SQL injection patterns
 */
function checkObjectForSQLInjection(obj: any, path: string = ''): string[] {
  const violations: string[] = [];
  
  if (typeof obj === 'string') {
    if (containsSQLInjection(obj)) {
      violations.push(path || 'root');
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      violations.push(...checkObjectForSQLInjection(item, `${path}[${index}]`));
    });
  } else if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      violations.push(...checkObjectForSQLInjection(obj[key], path ? `${path}.${key}` : key));
    });
  }
  
  return violations;
}

/**
 * SQL Injection Protection Middleware
 */
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  try {
    const violations: string[] = [];
    
    // Check query parameters
    if (req.query) {
      violations.push(...checkObjectForSQLInjection(req.query, 'query'));
    }
    
    // Check request body
    if (req.body) {
      violations.push(...checkObjectForSQLInjection(req.body, 'body'));
    }
    
    // Check URL parameters
    if (req.params) {
      violations.push(...checkObjectForSQLInjection(req.params, 'params'));
    }
    
    // If violations found, log and block the request
    if (violations.length > 0) {
      log.error('SQL injection attempt detected', LogContext.SECURITY, {
        ip: req.ip,
        method: req.method,
        path: req.path,
        violations,
        userAgent: req.get('user-agent'),
      });
      
      return sendError(res, 'SECURITY_VIOLATION', 'Invalid input detected', 400);
    }
    
    next();
  } catch (error) {
    log.error('SQL injection protection error', LogContext.SECURITY, { error });
    next(); // Allow request to proceed on error to prevent DoS
  }
};

/**
 * SQL Query Builder Helper
 * Use this to safely build SQL queries
 */
export class SafeSQLBuilder {
  private query: string = '';
  private values: any[] = [];
  
  select(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    // Validate column names (alphanumeric, underscore, and dot for table.column)
    const validCols = cols.filter(col => /^[a-zA-Z0-9_.]+$/.test(col));
    this.query = `SELECT ${validCols.join(', ')}`;
    return this;
  }
  
  from(table: string): this {
    // Validate table name
    if (!/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid table name');
    }
    this.query += ` FROM ${table}`;
    return this;
  }
  
  where(column: string, operator: string, value: any): this {
    // Validate column name and operator
    if (!/^[a-zA-Z0-9_.]+$/.test(column)) {
      throw new Error('Invalid column name');
    }
    
    const validOperators = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN'];
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new Error('Invalid operator');
    }
    
    const whereClause = this.query.includes('WHERE') ? ' AND' : ' WHERE';
    this.query += `${whereClause} ${column} ${operator} ?`;
    this.values.push(value);
    return this;
  }
  
  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    // Validate column name and direction
    if (!/^[a-zA-Z0-9_.]+$/.test(column)) {
      throw new Error('Invalid column name');
    }
    
    if (!['ASC', 'DESC'].includes(direction.toUpperCase())) {
      throw new Error('Invalid sort direction');
    }
    
    this.query += ` ORDER BY ${column} ${direction}`;
    return this;
  }
  
  limit(limit: number, offset?: number): this {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('Invalid limit');
    }
    
    this.query += ` LIMIT ${limit}`;
    
    if (offset !== undefined) {
      if (!Number.isInteger(offset) || offset < 0) {
        throw new Error('Invalid offset');
      }
      this.query += ` OFFSET ${offset}`;
    }
    
    return this;
  }
  
  build(): { query: string; values: any[] } {
    return {
      query: this.query,
      values: this.values,
    };
  }
}

/**
 * Middleware to add SQL sanitization helpers to request
 */
export const addSQLHelpers = (req: Request, res: Response, next: NextFunction) => {
  // Add sanitization function to request
  (req as any).sanitizeSQL = sanitizeSQLValue;
  (req as any).SQLBuilder = SafeSQLBuilder;
  next();
};