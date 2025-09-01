/**
 * Network Authentication Middleware
 * Simple authentication for network connections
 */

import type { NextFunction, Request, Response } from 'express';
import { LogContext, log } from '../utils/logger';
import { sendError } from '../utils/api-response';
import { secretsManager } from '../services/secrets-manager';

const NETWORK_API_KEY = 'universal-ai-tools-network-2025-secure-key';
const TRUSTED_LOCAL_NETWORKS = [
  '192.168.',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.'
];

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const realIP = req.headers['x-real-ip'] as string;
  const remoteAddress = req.socket?.remoteAddress;
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  if (realIP) {
    return realIP;
  }
  if (remoteAddress) {
    return remoteAddress.replace('::ffff:', ''); // Remove IPv6 prefix
  }
  
  return 'unknown';
}

/**
 * Check if IP is from a trusted local network
 */
function isLocalNetworkIP(ip: string): boolean {
  if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
    return true;
  }
  
  return TRUSTED_LOCAL_NETWORKS.some(network => ip.startsWith(network));
}

/**
 * Network authentication middleware
 * - Allows localhost connections without authentication
 * - Requires API key for local network connections
 * - Blocks external connections unless authenticated
 */
export const networkAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIP = getClientIP(req);
    const apiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers.authorization;
    
    log.info('Network auth check', LogContext.AUTH, {
      clientIP,
      hasApiKey: !!apiKey,
      hasAuthHeader: !!authHeader,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    });

    // Allow localhost connections (same machine)
    if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'localhost') {
      log.info('Allowing localhost connection', LogContext.AUTH, { clientIP });
      return next();
    }

    // For local network connections, require API key
    if (isLocalNetworkIP(clientIP)) {
      if (!apiKey) {
        log.warn('Local network connection without API key', LogContext.AUTH, { clientIP });
        return sendError(res, 'UNAUTHORIZED', 'API key required for network access', 401);
      }

      // Simple API key validation
      if (apiKey !== NETWORK_API_KEY) {
        log.warn('Invalid API key from local network', LogContext.AUTH, { clientIP, providedKey: apiKey.substring(0, 10) + '...' });
        return sendError(res, 'AUTHENTICATION_ERROR', 'Invalid API key', 401);
      }

      log.info('Local network connection authenticated', LogContext.AUTH, { clientIP });
      return next();
    }

    // Block all external connections for security
    log.warn('Blocking external connection', LogContext.AUTH, { clientIP });
    return sendError(res, 'UNAUTHORIZED', 'External connections not allowed', 403);

  } catch (error) {
    log.error('Network authentication error', LogContext.AUTH, {
      error: error instanceof Error ? error.message : String(error),
    });
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Authentication error', 500);
  }
};

/**
 * Generate a simple API key for network access
 */
export function generateNetworkApiKey(): string {
  return NETWORK_API_KEY;
}

/**
 * Development-only: Allow all origins in development mode
 */
export const developmentBypass = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'development') {
    log.warn('Development mode: bypassing network authentication', LogContext.AUTH, {
      clientIP: getClientIP(req)
    });
    return next();
  }
  return networkAuthenticate(req, res, next);
};