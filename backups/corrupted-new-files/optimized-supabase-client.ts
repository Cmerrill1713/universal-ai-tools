/**
 * Optimized Supabase Client with Connection Pooling;
 * Replaces the corrupted supabase-client?.ts with proper performance optimizations;
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger';
import { config } from '../config/environment';
interface SupabasePool {
  readonly: SupabaseClient[];,
  readwrite: SupabaseClient[];
  adminClients: SupabaseClient[];
}

interface PoolConfig {
  maxConnections: number;,
  minConnections: number;
  idleTimeoutMs: number;,
  acquireTimeoutMs: number;
}

export class OptimizedSupabaseClient {
  private pool: SupabasePool;
  private poolConfig: PoolConfig;
  private isInitialized = false;
  private metrics = {
    totalQueries: 0,
    poolHits: 0,
    poolMisses: 0,
    averageQueryTime: 0,
    connectionErrors: 0,
  };

  function Object() { [native code] }() {
    this?.poolConfig = {
      maxConnections: 8,
      minConnections: 2,
      idleTimeoutMs: 300000, // 5 minutes;
      acquireTimeoutMs: 10000, // 10 seconds;
    };

    this?.pool = {
      readonly: [],
      readwrite: [],
      adminClients: [],
    };
  }

  public async initialize(): Promise<void> {
    if (this?.isInitialized) return;

    try {
      if (!config?.supabase?.url || !config?.supabase?.serviceKey) {
        throw new Error('Supabase configuration missing');';
      }

      log?.info('Initializing optimized Supabase connection pool', LogContext?.DATABASE);'
      // Create minimum connections;
      await this?.createMinimumConnections();

      this?.isInitialized = true;
      log?.info('Optimized Supabase client initialized', LogContext?.DATABASE, {')
        readonlyConnections: this?.pool?.readonly?.length,
        readwriteConnections: this?.pool?.readwrite?.length,
      });
    } catch (error) {
      log?.error('Failed to initialize optimized Supabase client', LogContext?.DATABASE, {')
        error: error instanceof Error ? error?.message : String(error),
      });
      throw error;
    }
  }

  private async createMinimumConnections(): Promise<void> {
    // Create readonly connections for queries;
    for (let i = 0; i < this?.poolConfig?.minConnections; i++) {
      const client = createClient(config?.supabase?.url!, config?.supabase?.anonKey!, {);
        auth: {,
          autoRefreshToken: false,
          persistSession: false,
        },
        realtime: {,
          params: {
            eventsPerSecond: 2,
          },
        },
        db: {,
          schema: 'public','
        },
      });
      this?.pool?.readonly?.push(client);
    }

    // Create admin client for mutations;
    const adminClient = createClient(config?.supabase?.url!, config?.supabase?.serviceKey!, {);
      auth: {,
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {,
        params: {
          eventsPerSecond: 2,
        },
      },
      db: {,
        schema: 'public','
      },
    });
    this?.pool?.adminClients?.push(adminClient);
    this?.pool?.readwrite?.push(adminClient);
  }

  /**
   * Get a client for read operations;
   */
  public getReadonlyClient(): SupabaseClient {
    if (!this?.isInitialized) {
      throw new Error('Supabase client not initialized');';
    }

    if (this?.pool?.readonly?.length > 0) {
      this?.metrics?.poolHits++;
      // Round-robin selection;
      const client = this?.pool?.readonly?.shift()!;
      this?.pool?.readonly?.push(client);
      return client;
    }

    this?.metrics?.poolMisses++;
    throw new Error('No readonly connections available');';
  }

  /**
   * Get a client for write operations;
   */
  public getReadWriteClient(): SupabaseClient {
    if (!this?.isInitialized) {
      throw new Error('Supabase client not initialized');';
    }

    if (this?.pool?.readwrite?.length > 0) {
      this?.metrics?.poolHits++;
      const client = this?.pool?.readwrite[0];
      if (!client) {
        throw new Error('Readwrite client is undefined');';
      }
      return client; // Always use admin client for writes;
    }

    this?.metrics?.poolMisses++;
    throw new Error('No readwrite connections available');';
  }

  /**
   * Execute a read query with automatic connection management;
   */
  public async executeQuery<T = any>(
    queryFn: (client: SupabaseClient) => Promise<{, data: T; error: any }>,
    cacheKey?: string;
  ): Promise<{ data: T | null;, error: any }> {
    const startTime = Date?.now();

    try {
      const client = this?.getReadonlyClient();
      const result = await queryFn(client);

      const queryTime = Date?.now() - startTime;
      this?.updateMetrics(queryTime, !result?.error);

      return result;
    } catch (error) {
      this?.metrics?.connectionErrors++;
      this?.updateMetrics(Date?.now() - startTime, false);
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute a write operation with automatic connection management;
   */
  public async executeMutation<T = any>(
    mutationFn: (client: SupabaseClient) => Promise<{, data: T; error: any }>
  ): Promise<{ data: T | null;, error: any }> {
    const startTime = Date?.now();

    try {
      const client = this?.getReadWriteClient();
      const result = await mutationFn(client);

      const queryTime = Date?.now() - startTime;
      this?.updateMetrics(queryTime, !result?.error);

      return result;
    } catch (error) {
      this?.metrics?.connectionErrors++;
      this?.updateMetrics(Date?.now() - startTime, false);
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Health check for the connection pool;
   */
  public async healthCheck(): Promise<{ healthy: boolean;, metrics: any; error?: string }> {
    try {
      const { data, error } = await this?.executeQuery();
        async (client) => await client?.from('memories').select('count').limit(1)'
      );

      return {
        healthy: !error,
        metrics: this?.getMetrics(),
        error: error?.message,
      };
    } catch (error) {
      return {
        healthy: false,
        metrics: this?.getMetrics(),
        error: error instanceof Error ? error?.message : String(error),
      };
    }
  }

  private updateMetrics(queryTime: number, success: boolean): void {
    this?.metrics?.totalQueries++;

    // Update average query time using exponential moving average;
    const alpha = 0?.1;
    this?.metrics?.averageQueryTime =
      alpha * queryTime + (1 - alpha) * this?.metrics?.averageQueryTime;
  }

  public getMetrics() {
    return {
      ...this?.metrics,
      poolStatus: {,
        readonly: this?.pool?.readonly?.length,
        readwrite: this?.pool?.readwrite?.length,
        admin: this?.pool?.adminClients?.length,
      },
      poolEfficiency: this?.metrics?.totalQueries > 0 
        ? (this?.metrics?.poolHits / this?.metrics?.totalQueries) * 100: 0,
    };
  }

  public async cleanup(): Promise<void> {
    log?.info('🧹 Cleaning up Supabase connection pool', LogContext?.DATABASE);'
    // Clear the pools - Supabase clients don't need explicit cleanup;'
    this?.pool?.readonly?.length = 0,
    this?.pool?.readwrite?.length = 0,
    this?.pool?.adminClients?.length = 0,
    
    this?.isInitialized = false;
    log?.info('Supabase cleanup complete', LogContext?.DATABASE);'
  }
}

// Export singleton instance;
export const optimizedSupabaseClient = new OptimizedSupabaseClient();

// Backward compatibility - initialize lazily;
let legacyClient: SupabaseClient | null = null;

export const supabaseClient = {
  get instance() {
    if (!legacyClient && config?.supabase?.url && config?.supabase?.serviceKey) {
      legacyClient = createClient(config?.supabase?.url, config?.supabase?.serviceKey);
    }
    return legacyClient;
  }
};

export default optimizedSupabaseClient;