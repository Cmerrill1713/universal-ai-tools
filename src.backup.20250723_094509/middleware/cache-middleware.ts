import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'crypto';
import { CacheConsistencyService } from '../services/cache-consistency-service';
import { logger } from '../utils/logger';

interface CacheConfig {
  ttl?: number;
  tags?: string[];
  version?: string;
  varyBy?: string[];
  staleWhileRevalidate?: number;
  mustRevalidate?: boolean;
  public?: boolean;
  private?: boolean;
  noStore?: boolean;
  noCache?: boolean;
}

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  etag: string;
  lastModified: string;
}

export class CacheMiddleware {
  private cacheService: CacheConsistencyService;
  private defaultTTL = 300; // 5 minutes
  private revalidationQueue: Map<string, Promise<unknown>>;

  constructor(cacheService: CacheConsistencyService) {
    this.cacheService = cacheService;
    this.revalidationQueue = new Map();
  }

  cache(config: CacheConfig = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }

      // Check if caching is disabled
      if (config.noStore || config.noCache) {
        this.setNoCacheHeaders(res);
        return next();
      }

      const cacheKey = this.generateCacheKey(req, config.varyBy);
      const etag = req.headers['if-none-match'];
      const ifModifiedSince = req.headers['if-modified-since'];

      try {
        // Check cache
        const cached = await this.cacheService.get<CachedResponse>(cacheKey, {
          version: config.version,
          tags: config.tags,
        });

        if (cached) {
          // Handle conditional requests
          if (etag && etag === cached.etag) {
            res.status(304).end();
            return;
          }

          if (ifModifiedSince && new Date(ifModifiedSince) >= new Date(cached.lastModified)) {
            res.status(304).end();
            return;
          }

          // Check if stale contentcan be served while revalidating
          if (config.staleWhileRevalidate && this.isStale(cached, config.ttl)) {
            this.serveStaleWhileRevalidate(req, res, cached, cacheKey, config);
            return;
          }

          // Serve from cache
          this.serveCachedResponse(res, cached, config);
          return;
        }

        // Cache miss - continue to handler
        this.interceptResponse(req, res, cacheKey, config, next);
      } catch (error) {
        logger.error('Cache middleware _error', error);
        next();
      }
    };
  }

  private generateCacheKey(req: Request, varyBy?: string[]): string {
    const parts = [req.method, req.hostname, req.originalUrl || req.url];

    // Add vary-by headers
    if (varyBy && varyBy.length > 0) {
      for (const header of varyBy) {
        const value = req.headers[header.toLowerCase()];
        if (value) {
          parts.push(`${header}:${value}`);
        }
      }
    }

    // Add query parameters
    const queryKeys = Object.keys(req.query).sort();
    for (const key of queryKeys) {
      parts.push(`${key}:${req.query[key]}`);
    }

    return createHash('sha256').update(parts.join('|')).digest('hex');
  }

  private interceptResponse(
    req: Request,
    res: Response,
    cacheKey: string,
    config: CacheConfig,
    next: NextFunction
  ): void {
    const originalSend = res.send;
    const originalJson = res.json;
    const chunks: Buffer[] = [];

    // Intercept write to capture response body
    const originalWrite = res.write;
    res.write = function (
      chunk: any,
      encodingOrCallback?: BufferEncoding | ((_error Error | null | undefined) => void),
      callback?: (_error Error | null | undefined) => void
    ): boolean {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const encoding = typeof encodingOrCallback === 'string' ? encodingOrCallback : 'utf8';
      const cb = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
      return originalWrite.call(res, chunk, encoding, cb);
    };

    // Intercept send
    res.send = function (body?: any): Response {
      res.send = originalSend;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheResponse(body);
      }
      return originalSend.call(res, body);
    };

    // Intercept json
    res.json = function (body?: any): Response {
      res.json = originalJson;
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheResponse(body);
      }
      return originalJson.call(res, body);
    };

    const cacheResponse = async (body: any) => {
      try {
        const responseBody = body || Buffer.concat(chunks).toString();
        const etag = this.generateETag(responseBody);
        const lastModified = new Date().toUTCString();

        // Set cache headers
        this.setCacheHeaders(res, config, etag, lastModified);

        // Store in cache
        const cachedResponse: CachedResponse = {
          status: res.statusCode,
          headers: this.extractHeaders(res),
          body: responseBody,
          etag,
          lastModified,
        };

        await this.cacheService.set(cacheKey, cachedResponse, {
          ttl: config.ttl || this.defaultTTL,
          tags: config.tags,
          version: config.version,
        });
      } catch (error) {
        logger.error('Error caching response:', error);
      }
    };

    next();
  }

  private generateETag(content any): string {
    const data = typeof content=== 'string' ? content: JSON.stringify(content;
    return `"${createHash('sha256').update(data).digest('hex')}"`;
  }

  private setCacheHeaders(
    res: Response,
    config: CacheConfig,
    etag: string,
    lastModified: string
  ): void {
    const cacheControl: string[] = [];

    if (config.public) {
      cacheControl.push('public');
    } else if (config.private) {
      cacheControl.push('private');
    }

    if (config.ttl) {
      cacheControl.push(`max-age=${config.ttl}`);
    }

    if (config.staleWhileRevalidate) {
      cacheControl.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }

    if (config.mustRevalidate) {
      cacheControl.push('must-revalidate');
    }

    if (cacheControl.length > 0) {
      res.setHeader('Cache-Control', cacheControl.join(', '));
    }

    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);

    if (config.varyBy && config.varyBy.length > 0) {
      res.setHeader('Vary', config.varyBy.join(', '));
    }
  }

  private setNoCacheHeaders(res: Response): void {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  private extractHeaders(res: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    const headerNames = res.getHeaderNames();

    for (const name of headerNames) {
      const value = res.getHeader(name);
      if (value) {
        headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }

    return headers;
  }

  private serveCachedResponse(res: Response, cached: CachedResponse, config: CacheConfig): void {
    // Set original headers
    for (const [name, value] of Object.entries(cached.headers)) {
      res.setHeader(name, value);
    }

    // Update cache headers
    this.setCacheHeaders(res, config, cached.etag, cached.lastModified);

    // Send cached response
    res.status(cached.status).send(cached.body);
  }

  private isStale(cached: CachedResponse, ttl?: number): boolean {
    if (!ttl) return false;

    const age = Date.now() - new Date(cached.lastModified).getTime();
    return age > ttl * 1000;
  }

  private async serveStaleWhileRevalidate(
    req: Request,
    res: Response,
    cached: CachedResponse,
    cacheKey: string,
    config: CacheConfig
  ): Promise<void> {
    // Serve stale contentimmediately
    this.serveCachedResponse(res, cached, config);

    // Check if revalidation is already in progress
    if (this.revalidationQueue.has(cacheKey)) {
      return;
    }

    // Start background revalidation
    const revalidationPromise = this.revalidateInBackground(req, cacheKey, config);

    this.revalidationQueue.set(cacheKey, revalidationPromise);

    try {
      await revalidationPromise;
    } finally {
      this.revalidationQueue.delete(cacheKey);
    }
  }

  private async revalidateInBackground(
    req: Request,
    cacheKey: string,
    config: CacheConfig
  ): Promise<void> {
    try {
      // Create a mock request to the same endpoint
      const { default: axios } = await import('axios');

      const response = await axios({
        method: req.method,
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        headers: {
          ...req.headers,
          'x-cache-revalidation': 'true',
        },
      });

      // The response will be cached by the interceptor
      logger.info(`Background revalidation completed for ${cacheKey}`);
    } catch (error) {
      logger.error('Background revalidation _error', error);
    }
  }

  invalidationMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Allow cache invalidation for mutating operations
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        res.on('finish', async () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Extract invalidation hints from request
            const invalidateTags = req.headers['x-cache-invalidate-tags'];
            const invalidatePattern = req.headers['x-cache-invalidate-_pattern];

            if (invalidateTags || invalidatePattern) {
              const tags = invalidateTags
                ? String(invalidateTags)
                    .split(',')
                    .map((t) => t.trim())
                : undefined;

              await this.cacheService.invalidate(
                invalidatePattern ? String(invalidatePattern) : undefined,
                tags
              );
            }
          }
        });
      }

      next();
    };
  }
}

// Factory function
export function createCacheMiddleware(redisUrl: string): CacheMiddleware {
  const cacheService = new CacheConsistencyService(redisUrl);
  return new CacheMiddleware(cacheService);
}

export default CacheMiddleware;
