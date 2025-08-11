import type { NextFunction, Request, Response } from 'express';

// Very lightweight guard targeting obvious SQLi payloads in URL/query/params.
// We intentionally avoid deep body scanning to reduce false positives; JSON body
// validation should be handled by validators/schemas upstream.
const SUSPICIOUS_PATTERN = /(;|--|\/\*|\*\/|\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bALTER\b)/i;

function containsSuspicious(input: unknown): boolean {
  if (typeof input === 'string') {
    // Ignore small strings to reduce noise
    if (input.length <= 2) return false;
    return SUSPICIOUS_PATTERN.test(input);
  }
  if (Array.isArray(input)) {
    return input.some((v) => containsSuspicious(v));
  }
  if (input && typeof input === 'object') {
    for (const value of Object.values(input as Record<string, unknown>)) {
      if (containsSuspicious(value)) return true;
    }
  }
  return false;
}

export function sqlInjectionProtection() {
  return function sqlInjectionProtectionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Check URL, params, and query only
      if (
        containsSuspicious(req.originalUrl) ||
        containsSuspicious(req.path) ||
        containsSuspicious(req.params) ||
        containsSuspicious(req.query)
      ) {
        res.setHeader('X-Security-Event', 'sql-injection-detected');
        return res.status(400).json({ success: false, error: 'Invalid request' });
      }
    } catch {
      // Fail-open to avoid DOS due to guard failure
    }
    return next();
  };
}

export default sqlInjectionProtection;


