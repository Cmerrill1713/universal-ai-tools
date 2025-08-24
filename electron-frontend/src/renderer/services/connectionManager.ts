/**
 * Connection Manager with Retry Logic
 * Handles all API and Supabase connections with automatic retries
 */

import { logger } from '../utils/logger';

interface ConnectionConfig {
  url: string;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  name: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  lastError?: string;
  retryCount: number;
  lastAttempt?: Date;
}

class ConnectionManager {
  private connections: Map<string, ConnectionStatus> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private configs: Map<string, ConnectionConfig> = new Map();

  constructor() {
    this.initializeConnections();
  }

  /**
   * Initialize connection configurations
   */
  private initializeConnections(): void {
    // Backend API configuration
    this.configs.set('backend', {
      url: process.env.REACT_APP_API_URL || 'http://localhost:9999',
      maxRetries: 5,
      retryDelay: 2000,
      timeout: 5000,
      name: 'Backend API',
    });

    // Supabase configuration
    this.configs.set('supabase', {
      url: process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321',
      maxRetries: 3,
      retryDelay: 3000,
      timeout: 5000,
      name: 'Supabase',
    });

    // WebSocket configuration
    this.configs.set('websocket', {
      url: process.env.REACT_APP_WS_URL || 'ws://localhost:9999',
      maxRetries: -1, // Infinite retries for WebSocket
      retryDelay: 5000,
      timeout: 10000,
      name: 'WebSocket',
    });

    // Initialize status for each connection
    this.configs.forEach((config, key) => {
      this.connections.set(key, {
        isConnected: false,
        retryCount: 0,
      });
    });
  }

  /**
   * Test connection to a service
   */
  public async testConnection(service: string): Promise<boolean> {
    const config = this.configs.get(service);
    if (!config) {
      logger.warn(`[ConnectionManager] Unknown service: ${service}`);
      return false;
    }

    const status = this.connections.get(service) || {
      isConnected: false,
      retryCount: 0,
    };

    try {
      // Different test methods for different services
      let isConnected = false;

      switch (service) {
        case 'backend':
          isConnected = await this.testBackendConnection(config);
          break;
        case 'supabase':
          isConnected = await this.testSupabaseConnection(config);
          break;
        case 'websocket':
          isConnected = await this.testWebSocketConnection(config);
          break;
        default:
          isConnected = await this.testHttpConnection(config);
      }

      // Update status
      status.isConnected = isConnected;
      status.lastAttempt = new Date();

      if (isConnected) {
        status.retryCount = 0;
        delete status.lastError;
        logger.info(`[ConnectionManager] Connected to ${config.name}`);
      } else {
        throw new Error(`Failed to connect to ${config.name}`);
      }

      this.connections.set(service, status);
      return isConnected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update status with error
      status.isConnected = false;
      status.lastError = errorMessage;
      status.lastAttempt = new Date();
      status.retryCount++;
      this.connections.set(service, status);

      // Log the error silently (don't spam console)
      logger.debug(`[ConnectionManager] ${config.name} connection failed: ${errorMessage}`);

      // Schedule retry if within limits
      if (config.maxRetries === -1 || status.retryCount < config.maxRetries) {
        this.scheduleRetry(service, config, status);
      } else {
        logger.warn(`[ConnectionManager] ${config.name} max retries reached`);
      }

      return false;
    }
  }

  /**
   * Test backend API connection
   */
  private async testBackendConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.url}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      // Silently fail - don't log to console
      return false;
    }
  }

  /**
   * Test Supabase connection
   */
  private async testSupabaseConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.url}/rest/v1/`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          apikey: process.env.REACT_APP_SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      // Supabase returns 200 even for the base endpoint
      return response.status === 200 || response.status === 401; // 401 means connected but needs auth
    } catch (error) {
      return false;
    }
  }

  /**
   * Test WebSocket connection
   */
  private async testWebSocketConnection(config: ConnectionConfig): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const ws = new WebSocket(config.url);

        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, config.timeout);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch (error) {
        resolve(false);
      }
    });
  }

  /**
   * Test generic HTTP connection
   */
  private async testHttpConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Schedule a retry for a service
   */
  private scheduleRetry(service: string, config: ConnectionConfig, status: ConnectionStatus): void {
    // Clear existing timer
    const existingTimer = this.retryTimers.get(service);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(config.retryDelay * Math.pow(2, status.retryCount - 1), 30000);

    logger.debug(
      `[ConnectionManager] Retrying ${config.name} in ${delay}ms (attempt ${status.retryCount})`
    );

    const timer = setTimeout(() => {
      this.testConnection(service);
    }, delay);

    this.retryTimers.set(service, timer);
  }

  /**
   * Get connection status for a service
   */
  public getStatus(service: string): ConnectionStatus | undefined {
    return this.connections.get(service);
  }

  /**
   * Get all connection statuses
   */
  public getAllStatuses(): Map<string, ConnectionStatus> {
    return new Map(this.connections);
  }

  /**
   * Force reconnect to a service
   */
  public async reconnect(service: string): Promise<boolean> {
    const status = this.connections.get(service);
    if (status) {
      status.retryCount = 0;
    }
    return this.testConnection(service);
  }

  /**
   * Start monitoring all connections
   */
  public startMonitoring(): void {
    // Test all connections initially
    this.configs.forEach((_, service) => {
      this.testConnection(service);
    });

    // Periodic health checks every 30 seconds
    setInterval(() => {
      this.configs.forEach((_, service) => {
        const status = this.connections.get(service);
        if (status && !status.isConnected) {
          this.testConnection(service);
        }
      });
    }, 30000);
  }

  /**
   * Stop all retry timers
   */
  public stopAllRetries(): void {
    this.retryTimers.forEach(timer => clearTimeout(timer));
    this.retryTimers.clear();
  }

  /**
   * Make a safe fetch request with fallback
   */
  public async safeFetch(url: string, options?: RequestInit): Promise<Response> {
    // Determine which service this URL belongs to
    let service = 'backend';
    if (url.includes('54321')) {
      service = 'supabase';
    }

    // Check if service is connected
    const status = this.connections.get(service);
    if (status && !status.isConnected) {
      // Try to reconnect first
      await this.testConnection(service);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      // Log silently and return a mock response
      logger.debug(`[ConnectionManager] Fetch failed for ${url}:`, error);

      // Return a mock response to prevent app crashes
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
  }

  /**
   * Create a safe WebSocket connection
   */
  public createSafeWebSocket(url: string): WebSocket | null {
    try {
      const ws = new WebSocket(url);

      ws.onerror = error => {
        logger.debug('[ConnectionManager] WebSocket error:', error);
      };

      ws.onclose = () => {
        logger.debug('[ConnectionManager] WebSocket closed, will retry...');
        // Schedule reconnection
        setTimeout(() => {
          this.createSafeWebSocket(url);
        }, 5000);
      };

      return ws;
    } catch (error) {
      logger.debug('[ConnectionManager] Failed to create WebSocket:', error);
      return null;
    }
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();

// Start monitoring on initialization
if (typeof window !== 'undefined') {
  connectionManager.startMonitoring();

  // Make available globally for debugging
  (window as any).__CONNECTION_MANAGER__ = connectionManager;
}

export default connectionManager;
