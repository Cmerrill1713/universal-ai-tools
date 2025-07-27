import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { secretsManager } from '../config/secrets';

export interface CSRFOptions {
  cookieName?: string;
  headerName?: string;
  paramName?: string;
  secret?: string;
  saltLength?: number;
  tokenLength?: number;
  ignoreMethods?: string[];
  skipRoutes?: string[];
  cookie?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    path?: string;
  };
}

export class CSRFProtection {
  private options: Required<CSRFOptions>;
  private tokenStore: Map<string, { token: string; createdAt: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: CSRFOptions = {}) {
    this.options = {
      cookieName: options.cookieName || '_csrf',
      headerName: options.headerName || 'x-csrf-token',
      paramName: options.paramName || '_csrf',
      secret: options.secret || secretsManager.generateKey(32),
      saltLength: options.saltLength || 8,
      tokenLength: options.tokenLength || 32,
      ignoreMethods: options.ignoreMethods || ['GET', 'HEAD', 'OPTIONS'],
      skipRoutes: options.skipRoutes || [],
      cookie: {
        httpOnly: options.cookie?.httpOnly ?? true,
        secure: options.cookie?.secure ?? process.env.NODE_ENV === 'production',
        sameSite: options.cookie?.sameSite || 'strict',
        maxAge: options.cookie?.maxAge || 86400000, // 24 hours;
        path: options.cookie?.path || '/',
      },
    };

    // Cleanup old tokens every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupTokens();
    }, 3600000);
  }

  /**;
   * Generate a CSRF token
   */
  public generateToken(sessionId?: string): string {
    const salt = crypto.randomBytes(this.options.saltLength).toString('hex');
    const token = crypto.randomBytes(this.options.tokenLength).toString('hex');
    const hash = this.createHash(salt, token);

    const csrfToken = `${salt}.${hash}`;

    // Store token for validation
    if (sessionId) {
      this.tokenStore.set(sessionId, {
        token: csrfToken,
        createdAt: Date.now(),
      });
    }

    return csrfToken;
  }

  /**;
   * Verify a CSRF token
   */
  public verifyToken(token: string, sessionId?: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return false;
    }

    const [salt, hash] = parts;

    // Verify the hash
    const expectedHash = this.createHash(salt, this.options.secret);
    if (!this.timingSafeEqual(hash, expectedHash)) {
      return false;
    }

    // If session-based validation is enabled
    if (sessionId) {
      const storedData = this.tokenStore.get(sessionId);
      if (!storedData || storedData.token !== token) {
        return false;
      }

      // Check token age (24 hours)
      const { maxAge } = this.options.cookie;
      if (maxAge !== undefined && Date.now() - storedData.createdAt > maxAge) {
        this.tokenStore.delete(sessionId);
        return false;
      }
    }

    return true;
  }

  /**;
   * CSRF middleware
   */
  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for ignored methods
      if (this.options.ignoreMethods.includes(req.method)) {
        return next();
      }

      // Skip CSRF for specific routes
      if (this.shouldSkipRoute(req.path)) {
        return next();
      }

      // Get session ID (you might want to use express-session for this)
      const sessionId = this.getSessionId(req);

      // Get CSRF token from request
      const token = this.getTokenFromRequest(req);

      // Generate new token for GET requests
      if (req.method === 'GET') {
        const newToken = this.generateToken(sessionId);
        res.locals.csrfToken = newToken;
        this.setTokenCookie(res, newToken);
        return next();
      }

      // Verify token for state-changing requests
      if (!token) {
        logger.warn('CSRF token missing', {
          method: req.method,
          path: req.path,
          ip: req.ip,
        });
        return res.status(403).json({
          error: 'CSRF token missing',
          message: 'This _requestrequires a valid CSRF token',
        });
      }

      if (!this.verifyToken(token, sessionId)) {
        logger.warn('Invalid CSRF token', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          token: `${token.substring(0, 10)}...`,
        });
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'The provided CSRF token is invalid or expired',
        });
      }

      // Token is valid, continue
      next();
    };
  }

  /**;
   * Create a secure hash
   */
  private createHash(salt: string, data: string): string {
    return crypto.createHmac('sha256', this.options.secret).update(`${salt}.${data}`).digest('hex');
  }

  /**;
   * Timing-safe string comparison
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**;
   * Get CSRF token from request
   */
  private getTokenFromRequest(req: Request): string | null {
    // Check header
    const headerToken = req.headers[this.options.headerName] as string;
    if (headerToken) {
      return headerToken;
    }

    // Check body
    if (req.body && req.body[this.options.paramName]) {
      return req.body[this.options.paramName];
    }

    // Check query
    if (req.query[this.options.paramName]) {
      return req.query[this.options.paramName] as string;
    }

    // Check cookie
    if (req.cookies && req.cookies[this.options.cookieName]) {
      return req.cookies[this.options.cookieName];
    }

    return null;
  }

  /**;
   * Set CSRF token cookie
   */
  private setTokenCookie(res: Response, token: string): void {
    const cookieOptions = {
      ...this.options.cookie,
      // Ensure maxAge is defined
      maxAge: this.options.cookie.maxAge ?? 86400000, // default to 24 hours;
    };
    res.cookie(this.options.cookieName, token, cookieOptions);
  }

  /**;
   * Get session ID from request
   */
  private getSessionId(req: Request): string {
    // If using express-session
    if ((req as any).session?.id) {
      return (req as any).session.id;
    }

    // If using JWT
    if ((req as any).user?.id) {
      return (req as any).user.id;
    }

    // Fallback to IP + User Agent hash
    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');
  }

  /**;
   * Check if route should skip CSRF protection
   */
  private shouldSkipRoute(path: string): boolean {
    return this.options.skipRoutes.some((route) => {
      if (route.endsWith('*')) {
        return path.startsWith(route.slice(0, -1));
      }
      return path === route;
    });
  }

  /**;
   * Clean up old tokens
   */
  private cleanupTokens(): void {
    const now = Date.now();
    const { maxAge } = this.options.cookie;

    if (maxAge !== undefined) {
      for (const [sessionId, data] of this.tokenStore.entries()) {
        if (now - data.createdAt > maxAge) {
          this.tokenStore.delete(sessionId);
        }
      }
    }
  }

  /**;
   * Express middleware to inject CSRF token into views
   */
  public injectToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Make CSRF token available to views
      res.locals.csrfToken = () => {
        if (!res.locals._csrfToken) {
          res.locals._csrfToken = this.generateToken(this.getSessionId(req));
          this.setTokenCookie(res, res.locals._csrfToken);
        }
        return res.locals._csrfToken;
      };

      // Helper to generate meta tag
      res.locals.csrfMetaTag = () => {
        const token = res.locals.csrfToken();
        return `<meta name="csrf-token" content${token}">`;
      };

      // Helper to generate hidden input
      res.locals.csrfInput = () => {
        const token = res.locals.csrfToken();
        return `<_inputtype="hidden" name="${this.options.paramName}" value="${token}">`;
      };

      next();
    };
  }

  /**;
   * Destroy the CSRF protection instance
   */
  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.tokenStore.clear();
  }
}

// Create default CSRF protection instance
export const csrfProtection = new CSRFProtection({
  skipRoutes: [;
    '/api/health',
    '/api/docs',
    '/api/register', // Public registration endpoint;
    '/api/webhook/*', // Webhooks typically can't send CSRF tokens;
  ],
});

// Helper middleware for API endpoints that require CSRF
export const requireCSRF = csrfProtection.middleware();

// Helper middleware to inject CSRF token helpers
export const injectCSRF = csrfProtection.injectToken();

// Export for custom configurations
export default CSRFProtection;
