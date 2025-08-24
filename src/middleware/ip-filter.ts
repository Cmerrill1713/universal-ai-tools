import type { NextFunction, Request, Response } from 'express';

export function ipFilterMiddleware(
  allowList: string[] = []
): (req: Request, res: Response, next: NextFunction) => void {
  const normalized = new Set(allowList.map((s) => s.trim()).filter(Boolean));
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (normalized.size === 0) {return next();}
      const ip = req.ip || req.connection.remoteAddress || '';
      if (normalized.has(ip)) {return next();}
      res.status(403).json({ success: false, error: 'Forbidden IP' });
      
    } catch {
      return next();
    }
  };
}
