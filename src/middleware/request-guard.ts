import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

function generateRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }
}

export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const existing = (req.headers['x-request-id'] as string) || '';
    const id = existing && existing.length < 128 ? existing : generateRequestId();
    (req as any).requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
  };
}

export function enforceJsonMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const ct = (req.headers['content-type'] || '').toString();
      if (!ct.includes('application/json')) {
        return res.status(415).json({
          success: false,
          error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Use application/json' },
        });
      }
    }
    next();
    return undefined;
  };
}

export function limitQueryMiddleware(options?: {
  maxKeys?: number;
  maxKeyLength?: number;
  maxValueLength?: number;
  maxQueryStringLength?: number;
}) {
  const cfg = {
    maxKeys: options?.maxKeys ?? 100,
    maxKeyLength: options?.maxKeyLength ?? 100,
    maxValueLength: options?.maxValueLength ?? 2000,
    maxQueryStringLength: options?.maxQueryStringLength ?? 8000,
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const raw = req.url.split('?')[1] || '';
    if (raw.length > cfg.maxQueryStringLength) {
      return res.status(414).json({ success: false, error: { code: 'URI_TOO_LONG' } });
    }
    const keys = Object.keys(req.query || {});
    if (keys.length > cfg.maxKeys) {
      return res.status(400).json({ success: false, error: { code: 'TOO_MANY_PARAMS' } });
    }
    for (const k of keys) {
      if (k.length > cfg.maxKeyLength) {
        return res.status(400).json({ success: false, error: { code: 'PARAM_TOO_LONG' } });
      }
      const val = req.query[k];
      const str = Array.isArray(val) ? val.join(',') : String(val);
      if (str.length > cfg.maxValueLength) {
        return res.status(400).json({ success: false, error: { code: 'VALUE_TOO_LONG' } });
      }
    }
    next();
    return undefined;
  };
}

export function jsonDepthGuardMiddleware(options?: {
  maxDepth?: number;
  maxKeysPerObject?: number;
  maxArrayLength?: number;
}) {
  const cfg = {
    maxDepth: options?.maxDepth ?? 25,
    maxKeysPerObject: options?.maxKeysPerObject ?? 2000,
    maxArrayLength: options?.maxArrayLength ?? 50000,
  };

  function check(value: unknown, depth: number): boolean {
    if (depth > cfg.maxDepth) return false;
    if (Array.isArray(value)) {
      if (value.length > cfg.maxArrayLength) return false;
      for (const item of value) if (!check(item, depth + 1)) return false;
      return true;
    }
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length > cfg.maxKeysPerObject) return false;
      // Prevent prototype pollution vectors
      if ('__proto__' in obj || 'constructor' in obj) return false;
      for (const key of keys) {
        if (!check(obj[key], depth + 1)) return false;
      }
      return true;
    }
    return true;
  }

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      if (!check(req.body, 0)) {
        return res.status(400).json({
          success: false,
          error: { code: 'REQUEST_TOO_COMPLEX', message: 'Payload exceeds complexity limits' },
        });
      }
    }
    next();
    return undefined;
  };
}
