/**
 * Security Configuration
 * Centralized security settings for the application
 */

import { LogContext, log } from '../utils/logger';

export const securityConfig = {
  // JWT Configuration
  jwt: {
    expiresIn: '24h',
    refreshExpiresIn: '7d',
    algorithm: 'HS256' as const,
  },
  
  // Password Requirements
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
  },
  
  // Session Configuration
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
  },
  
  // CORS Origins
  cors: {
    allowedOrigins: process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS?.split(',') || [])
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:9999'],
  },
  
  // API Key Configuration
  apiKey: {
    minLength: 32,
    prefix: 'uai_',
    rotationPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  
  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyDerivationIterations: 100000,
  },
};

// Validate security configuration on startup
export function validateSecurityConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    // Check JWT secret
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      log.error('JWT secret is missing or too short in production', LogContext.SECURITY);
      throw new Error('Invalid JWT configuration');
    }
    
    // Check encryption key
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
      log.error('Encryption key is missing or too short in production', LogContext.SECURITY);
      throw new Error('Invalid encryption configuration');
    }
    
    // Check CORS origins
    if (!process.env.ALLOWED_ORIGINS) {
      log.warn('No CORS origins configured for production', LogContext.SECURITY);
    }
    
    // Ensure HTTPS
    if (!process.env.FORCE_HTTPS) {
      log.warn('FORCE_HTTPS not enabled in production', LogContext.SECURITY);
    }
  }
  
  log.info('Security configuration validated', LogContext.SECURITY);
}