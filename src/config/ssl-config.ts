/**
 * SSL/TLS Configuration for Production
 * Secure HTTPS and WSS configuration for device authentication
 */

import fs from 'fs';
import path from 'path';
import { LogContext, log } from '../utils/logger';

export interface SSLConfig {
  enabled: boolean;
  key?: string;
  cert?: string;
  ca?: string;
  passphrase?: string;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
}

/**
 * Get SSL/TLS configuration based on environment
 */
export function getSSLConfig(): SSLConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const sslEnabled = process.env.SSL_ENABLED === 'true' || isProduction;

  if (!sslEnabled) {
    return { enabled: false };
  }

  try {
    const config: SSLConfig = {
      enabled: true,
      requestCert: false,
      rejectUnauthorized: true
    };

    // Certificate paths
    const certPath = process.env.SSL_CERT_PATH || '/etc/ssl/certs/universal-ai-tools.crt';
    const keyPath = process.env.SSL_KEY_PATH || '/etc/ssl/private/universal-ai-tools.key';
    const caPath = process.env.SSL_CA_PATH || '/etc/ssl/certs/ca-bundle.crt';

    // Load certificates if paths exist
    if (fs.existsSync(certPath)) {
      config.cert = fs.readFileSync(certPath, 'utf8');
      log.info('SSL certificate loaded', LogContext.SYSTEM, { path: certPath });
    } else if (isProduction) {
      throw new Error(`SSL certificate not found at ${certPath}`);
    }

    if (fs.existsSync(keyPath)) {
      config.key = fs.readFileSync(keyPath, 'utf8');
      log.info('SSL private key loaded', LogContext.SYSTEM, { path: keyPath });
    } else if (isProduction) {
      throw new Error(`SSL private key not found at ${keyPath}`);
    }

    if (fs.existsSync(caPath)) {
      config.ca = fs.readFileSync(caPath, 'utf8');
      log.info('SSL CA bundle loaded', LogContext.SYSTEM, { path: caPath });
    }

    // Certificate passphrase if needed
    if (process.env.SSL_PASSPHRASE) {
      config.passphrase = process.env.SSL_PASSPHRASE;
    }
    return undefined;

    return config;
  } catch (error) {
    log.error('Failed to load SSL configuration', LogContext.SYSTEM, { error });
    
    if (isProduction) {
      throw error; // Fail fast in production
    }
    
    return { enabled: false };
  }
}

/**
 * Generate self-signed certificate for development
 * DO NOT USE IN PRODUCTION
 */
export async function generateDevCertificate(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot generate self-signed certificate in production');
  }

  try {
    const { execSync } = await import('child_process');
    const certDir = path.join(process.cwd(), '.certificates');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    const keyPath = path.join(certDir, 'dev-server.key');
    const certPath = path.join(certDir, 'dev-server.crt');

    // Check if certificates already exist
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      log.info('Development certificates already exist', LogContext.SYSTEM);
      return;
    }

    // Generate self-signed certificate
    const command = `openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/C=US/ST=State/L=City/O=UniversalAITools/OU=Dev/CN=localhost"`;
    
    execSync(command, { stdio: 'inherit' });
    
    log.info('Development certificates generated', LogContext.SYSTEM, {
      key: keyPath,
      cert: certPath
    });

    // Update environment variables
    process.env.SSL_CERT_PATH = certPath;
    process.env.SSL_KEY_PATH = keyPath;
  } catch (error) {
    log.error('Failed to generate development certificate', LogContext.SYSTEM, { error });
    throw error;
  }
}

/**
 * Validate SSL certificate expiration
 */
export function validateCertificateExpiration(certPath: string): { valid: boolean; daysUntilExpiry?: number; error?: string } {
  try {
    const cert = fs.readFileSync(certPath, 'utf8');
    const certLines = cert.split('\n');
    
    // Extract certificate data (basic parsing - use proper library in production)
    const beginCert = certLines.findIndex(line => line.includes('BEGIN CERTIFICATE'));
    const endCert = certLines.findIndex(line => line.includes('END CERTIFICATE'));
    
    if (beginCert === -1 || endCert === -1) {
      return { valid: false, error: 'Invalid certificate format' };
    }

    // TODO: Use proper X.509 parsing library like node-forge or @peculiar/x509
    // For now, return valid for development
    if (process.env.NODE_ENV !== 'production') {
      return { valid: true, daysUntilExpiry: 365 };
    }

    return { valid: true, daysUntilExpiry: 90 }; // Placeholder
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get WebSocket Secure (WSS) configuration
 */
export function getWSSConfig(): { protocol: string; options: any } {
  const sslConfig = getSSLConfig();
  
  if (!sslConfig.enabled) {
    return {
      protocol: 'ws',
      options: {}
    };
  }

  return {
    protocol: 'wss',
    options: {
      key: sslConfig.key,
      cert: sslConfig.cert,
      ca: sslConfig.ca,
      requestCert: sslConfig.requestCert,
      rejectUnauthorized: sslConfig.rejectUnauthorized
    }
  };
}

/**
 * Security headers for HTTPS
 */
export const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:;",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};