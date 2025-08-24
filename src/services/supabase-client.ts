/**
 * Enhanced Supabase Client Management
 * Provides robust client management with connection pooling, retry logic, and failover
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config } from '@/config/environment';
import { CircuitBreakerRegistry } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';

interface SupabaseClientOptions {
  retryAttempts?: number;
  retryDelay?: number;
  useCircuitBreaker?: boolean;
  enableRealtime?: boolean;
  maxRetries?: number;
}

interface SupabaseConnectionHealth {
  isConnected: boolean;
  lastCheck: Date;
  responseTime: number;
  error?: string;
  retryCount: number;
}

class EnhancedSupabaseClient {
  private client: SupabaseClient | null = null;
  private connectionHealth: SupabaseConnectionHealth;
  private healthCheckInterval: NodeJS.Timer | null = null;
  private reconnectTimer: NodeJS.Timer | null = null;
  
  private readonly options: Required<SupabaseClientOptions> = {
    retryAttempts: 3,
    retryDelay: 2000,
    useCircuitBreaker: true,
    enableRealtime: false,
    maxRetries: 5,
  };

  constructor(options: SupabaseClientOptions = {}) {
    this.options = { ...this.options, ...options };
    this.connectionHealth = {
      isConnected: false,
      lastCheck: new Date(),
      responseTime: 0,
      retryCount: 0,
    };
  }

  /**
   * Get Supabase client with automatic retry and failover
   */
  async getClient(): Promise<SupabaseClient> {
    // Skip Supabase in test mode
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_SUPABASE_IN_TESTS === 'true') {
      throw new Error('Supabase disabled in test mode');
    }

    if (this.client && this.connectionHealth.isConnected) {
      return this.client;
    }

    return await this.initializeWithRetry();
  }

  /**
   * Initialize client with retry logic
   */
  private async initializeWithRetry(attempt = 1): Promise<SupabaseClient> {
    const breaker = this.options.useCircuitBreaker 
      ? CircuitBreakerRegistry.get('supabase-initialization')
      : null;

    const createClientWithConfig = async (): Promise<SupabaseClient> => {
      try {
        if (!config?.supabase?.url || !config?.supabase?.serviceKey) {
          throw new Error('Supabase configuration missing: URL or service key not provided');
        }

        log.debug(`Initializing Supabase client (attempt ${attempt}/${this.options.retryAttempts})`, LogContext.DATABASE);

        const startTime = Date.now();
        
        const client = createClient(config.supabase.url, config.supabase.serviceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
          global: {
            headers: {
              'X-Client-Info': 'universal-ai-tools-enhanced',
              'X-Client-Version': '1.0.0',
            },
          },
          db: {
            schema: 'public',
          },
          realtime: this.options.enableRealtime ? {
            params: {
              eventsPerSecond: 10,
            },
            heartbeatIntervalMs: 30000,
            reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
          } : undefined,
        });

        // Test connection with a simple query using existing table
        const { error } = await client.from('context_storage').select('id').limit(1);
        
        // Allow empty results (PGRST116) as successful connection
        if (error && error.code !== 'PGRST116' && !error.message.includes('does not exist')) {
          throw new Error(`Connection test failed: ${error.message}`);
        }

        const responseTime = Date.now() - startTime;
        
        this.client = client;
        this.connectionHealth = {
          isConnected: true,
          lastCheck: new Date(),
          responseTime,
          retryCount: 0,
        };

        log.info('✅ Supabase client initialized successfully', LogContext.DATABASE, {
          url: config.supabase.url,
          responseTime: `${responseTime}ms`,
          attempt,
          hasRealtime: this.options.enableRealtime,
        });

        // Start health monitoring if not already started
        if (!this.healthCheckInterval) {
          this.startHealthMonitoring();
        }

        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer as NodeJS.Timeout);
          this.reconnectTimer = null;
        }

        return client;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        this.connectionHealth = {
          isConnected: false,
          lastCheck: new Date(),
          responseTime: 0,
          error: errorMessage,
          retryCount: attempt,
        };

        log.error(`Failed to initialize Supabase client (attempt ${attempt}/${this.options.retryAttempts})`, LogContext.DATABASE, {
          error: errorMessage,
          attempt,
          maxAttempts: this.options.retryAttempts,
        });

        if (attempt >= this.options.retryAttempts) {
          throw new Error(`Failed to initialize Supabase client after ${this.options.retryAttempts} attempts: ${errorMessage}`);
        }

        // Exponential backoff with jitter
        const delay = this.options.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        log.debug(`Retrying Supabase client initialization in ${delay}ms`, LogContext.DATABASE);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.initializeWithRetry(attempt + 1);
      }
    };

    try {
      if (breaker) {
        return await breaker.execute(createClientWithConfig);
      } else {
        return await createClientWithConfig();
      }
    } catch (error) {
      log.error('Critical: Failed to initialize Supabase client', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
        totalAttempts: attempt,
      });

      // Schedule automatic reconnect
      this.scheduleReconnect();
      
      throw error;
    }
  }

  /**
   * Execute a query with automatic retry and circuit breaker protection
   */
  async executeWithRetry<T>(
    operation: (client: SupabaseClient) => Promise<T>,
    operationName = 'unknown'
  ): Promise<T> {
    const breaker = this.options.useCircuitBreaker 
      ? CircuitBreakerRegistry.get('supabase-query')
      : null;

    const executeOperation = async (): Promise<T> => {
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
        try {
          const client = await this.getClient();
          const result = await operation(client);
          
          // Reset retry count on success
          this.connectionHealth.retryCount = 0;
          
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          log.warn(`Supabase operation failed (attempt ${attempt}/${this.options.retryAttempts})`, LogContext.DATABASE, {
            operation: operationName,
            error: lastError.message,
            attempt,
          });

          // Mark connection as unhealthy
          this.connectionHealth.isConnected = false;
          this.connectionHealth.error = lastError.message;
          this.connectionHealth.retryCount = attempt;

          // Don't retry on the last attempt
          if (attempt < this.options.retryAttempts) {
            // Try to reinitialize client on connection errors
            if (lastError.message.includes('network') || lastError.message.includes('connection') || lastError.message.includes('timeout')) {
              this.client = null;
            }

            const delay = this.options.retryDelay * Math.pow(1.5, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw lastError || new Error(`Operation ${operationName} failed after ${this.options.retryAttempts} attempts`);
    };

    try {
      if (breaker) {
        return await breaker.execute(executeOperation);
      } else {
        return await executeOperation();
      }
    } catch (error) {
      log.error(`Supabase operation ${operationName} failed completely`, LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
        retryAttempts: this.options.retryAttempts,
      });
      
      // Schedule reconnect for connection-related errors
      if (error instanceof Error && (
        error.message.includes('network') || 
        error.message.includes('connection') || 
        error.message.includes('timeout')
      )) {
        this.scheduleReconnect();
      }
      
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 30000); // Every 30 seconds

    log.debug('Supabase health monitoring started', LogContext.DATABASE);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.client) {return;}

    const startTime = Date.now();
    
    try {
      const { error } = await this.client.from('context_storage').select('id').limit(1);
      
      const responseTime = Date.now() - startTime;
      
      // Consider connection healthy if no error or just empty results
      const isHealthy = !error || error.code === 'PGRST116';
      
      this.connectionHealth = {
        isConnected: isHealthy,
        lastCheck: new Date(),
        responseTime,
        retryCount: isHealthy ? 0 : this.connectionHealth.retryCount,
        error: isHealthy ? undefined : error?.message,
      };

      if (!isHealthy) {
        log.warn('Supabase health check failed', LogContext.DATABASE, {
          error: error?.message,
          responseTime: `${responseTime}ms`,
        });
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.connectionHealth = {
        isConnected: false,
        lastCheck: new Date(),
        responseTime,
        error: errorMessage,
        retryCount: this.connectionHealth.retryCount + 1,
      };

      log.error('Supabase health check error', LogContext.DATABASE, {
        error: errorMessage,
        responseTime: `${responseTime}ms`,
        retryCount: this.connectionHealth.retryCount,
      });

      // Schedule reconnect if health checks keep failing
      if (this.connectionHealth.retryCount >= 3) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Schedule automatic reconnect
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {return;} // Already scheduled

    const delay = Math.min(this.connectionHealth.retryCount * 5000, 30000); // Max 30 seconds
    
    log.info(`Scheduling Supabase reconnect in ${delay}ms`, LogContext.DATABASE);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      
      try {
        log.info('Attempting Supabase reconnect', LogContext.DATABASE);
        this.client = null;
        await this.getClient();
      } catch (error) {
        log.error('Supabase reconnect failed', LogContext.DATABASE, {
          error: error instanceof Error ? error.message : String(error),
        });
        
        // Schedule another reconnect if this one failed
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Get connection health status
   */
  getHealthStatus(): SupabaseConnectionHealth {
    return { ...this.connectionHealth };
  }

  /**
   * Force reconnect
   */
  async forceReconnect(): Promise<void> {
    log.info('Forcing Supabase client reconnect', LogContext.DATABASE);
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer as NodeJS.Timeout);
      this.reconnectTimer = null;
    }
    
    this.client = null;
    await this.getClient();
  }

  /**
   * Shutdown client and cleanup
   */
  shutdown(): void {
    log.info('Shutting down enhanced Supabase client', LogContext.DATABASE);
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval as NodeJS.Timeout);
      this.healthCheckInterval = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer as NodeJS.Timeout);
      this.reconnectTimer = null;
    }
    
    this.client = null;
    this.connectionHealth.isConnected = false;
  }
}

// Enhanced singleton instance
const enhancedSupabaseClient = new EnhancedSupabaseClient({
  retryAttempts: 3,
  retryDelay: 2000,
  useCircuitBreaker: true,
  enableRealtime: false,
});

/**
 * Get enhanced Supabase client with automatic retry and failover
 * @deprecated Use enhancedSupabaseClient.getClient() for better error handling
 */
export function getSupabaseClient(): SupabaseClient | null {
  try {
    // For backward compatibility, but logs a warning
    log.warn('Using deprecated getSupabaseClient(). Consider using enhancedSupabaseClient.getClient()', LogContext.DATABASE);
    
    if (!config?.supabase?.url || !config?.supabase?.serviceKey) {
      log.warn('Supabase config missing; database operations disabled', LogContext.DATABASE);
      return null;
    }

    // Return a basic client for backward compatibility
    return createClient(config.supabase.url, config.supabase.serviceKey);
  } catch (error) {
    log.error('Failed to create basic Supabase client', LogContext.DATABASE, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Get enhanced Supabase client with full retry and circuit breaker support
 */
export async function getEnhancedSupabaseClient(): Promise<SupabaseClient> {
  return enhancedSupabaseClient.getClient();
}

/**
 * Execute Supabase operation with automatic retry
 */
export async function executeSupabaseOperation<T>(
  operation: (client: SupabaseClient) => Promise<T>,
  operationName?: string
): Promise<T> {
  return enhancedSupabaseClient.executeWithRetry(operation, operationName);
}

/**
 * Get Supabase connection health
 */
export function getSupabaseHealth(): SupabaseConnectionHealth {
  return enhancedSupabaseClient.getHealthStatus();
}

/**
 * Force Supabase reconnect
 */
export async function forceSupabaseReconnect(): Promise<void> {
  return enhancedSupabaseClient.forceReconnect();
}

// Export the enhanced client instance
export { enhancedSupabaseClient };
