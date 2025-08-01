/**
 * Port Finder Utility
 * Finds available ports for services to avoid conflicts
 */

import net from 'net';
import { LogContext, log } from './logger';

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * Find an available port starting from a base port
 */
export async function findAvailablePort(
  basePort: number,
  maxAttempts = 10
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = basePort + i;
    const available = await isPortAvailable(port);
    
    if (available) {
      log.info(`Found available port: ${port}`, LogContext.SYSTEM);
      return port;
    }
  }
  
  log.error(`No available port found starting from ${basePort}`, LogContext.SYSTEM);
  return null;
}

/**
 * Get a safe port for a service
 */
export async function getSafePort(
  serviceName: string,
  preferredPort: number,
  fallbackPorts: number[] = []
): Promise<number> {
  // First try the preferred port
  if (await isPortAvailable(preferredPort)) {
    log.info(`Using preferred port ${preferredPort} for ${serviceName}`, LogContext.SYSTEM);
    return preferredPort;
  }
  
  log.warn(`Preferred port ${preferredPort} is busy for ${serviceName}`, LogContext.SYSTEM);
  
  // Try fallback ports
  for (const port of fallbackPorts) {
    if (await isPortAvailable(port)) {
      log.info(`Using fallback port ${port} for ${serviceName}`, LogContext.SYSTEM);
      return port;
    }
  }
  
  // Find any available port starting from preferred + 1
  const availablePort = await findAvailablePort(preferredPort + 1);
  
  if (availablePort) {
    log.info(`Using dynamically found port ${availablePort} for ${serviceName}`, LogContext.SYSTEM);
    return availablePort;
  }
  
  throw new Error(`No available port found for ${serviceName}`);
}