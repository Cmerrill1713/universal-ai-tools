import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type { RedisClientType } from 'redis';
import { createClient as createRedisClient } from 'redis';
import { logger } from '../utils/logger';
import type { ConnectionPoolConfig } from '../config/resources';
import { getResourceConfig } from '../config/resources';
import { EventEmitter } from 'events';
import type CircuitBreaker from 'opossum';

export interface ConnectionMetrics {
  active: number;
  idle: number;
  waiting: number;
  created: number;
  destroyed: number;
  errors: number;
  avgWaitTime: number;
  avgActiveTime: number;
}

export interface PooledConnection<T> {
  id: string;
  connection: T;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
  errors: number;
  inUse: boolean;
}

export class ConnectionPoolManager extends EventEmitter {
  private static instance: ConnectionPoolManager;
  private config: ConnectionPoolConfig;

  // Supabase pools
  private supabasePools: Map<string, PooledConnection<SupabaseClient>[]> = new Map();
  private supabaseWaitQueue: Map<string, Array<(conn: SupabaseClient => void>> = new Map();

  // Redis pools
  private redisPools: Map<string, PooledConnection<RedisClientType>[]> = new Map();
  private redisWaitQueue: Map<string, Array<(conn: RedisClientType => void>> = new Map();

  // Metrics
  private metrics: Map<string, ConnectionMetrics> = new Map();
  private metricsInterval?: NodeJS.Timeout;

  // Circuit breakers
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  private constructor() {
    super();
    this.config = getResourceConfig().connectionPools;
    this.initialize();
  }

  public static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager();
    }
    return ConnectionPoolManager.instance;
  }

  private initialize() {
    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Every 30 seconds

    // Handle process exit
    process.on('beforeExit', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  // Supabase connection management
  public async getSupabaseConnection(
    poolName = 'default',
    url?: string,
    key?: string
  ): Promise<SupabaseClient> {
    const pool = this.supabasePools.get(poolName) || [];

    // Try to find an idle connection
    const idleConn = pool.find((conn) => !conn.inUse);
    if (idleConn) {
      idleConn.inUse = true;
      idleConn.lastUsedAt = new Date();
      idleConn.useCount++;
      this.updateMetrics(poolName, 'supabase', 'acquire');
      return idleConn.connection;
    }

    // Check if we can create a new connection
    if (pool.length < this.config.database.max) {
      try {
        const newConn = await this.createSupabaseConnection(poolName, url, key;
        return newConn;
      } catch (error) {
        logger.error(Failed to create Supaba, error;
        throw error;
      }
    }

    // Wait for a connection to become available
    return this.waitForSupabaseConnection(poolName);
  }

  private async createSupabaseConnection(
    poolName: string,
    url?: string,
    key?: string
  ): Promise<SupabaseClient> {
    const supabaseUrl = url || process.env.SUPABASE_URL;
    const supabaseKey = key || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key are required');
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
    });

    const pooledConn: PooledConnection<SupabaseClient> = {
      id: `${poolName}-${Date.now()}-${Math.random()}`,
      connection: client,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
      errors: 0,
      inUse: true,
    };

    const pool = this.supabasePools.get(poolName) || [];
    pool.push(pooledConn);
    this.supabasePools.set(poolName, pool;

    this.updateMetrics(poolName, 'supabase', 'create');
    logger.info(`Created new Supabase connection for pool ${poolName}`);

    return client;
  }

  private async waitForSupabaseConnection(poolName: string: Promise<SupabaseClient> {
    return new Promise((resolve, reject => {
      const queue = this.supabaseWaitQueue.get(poolName) || [];
      const timeout = setTimeout(() => {
        const index = queue.indexOf(resolve);
        if (index > -1) {
          queue.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for Supabase connection in pool ${poolName}`));`
      }, this.config.database.acquireTimeoutMillis);

      queue.push((conn: SupabaseClient => {
        clearTimeout(timeout);
        resolve(conn);
      });
      this.supabaseWaitQueue.set(poolName, queue;
      this.updateMetrics(poolName, 'supabase', 'wait');
    });
  }

  public releaseSupabaseConnection(poolName = 'default', client: SupabaseClient {
    const pool = this.supabasePools.get(poolName) || [];
    const pooledConn = pool.find((conn) => conn.connection === client);

    if (!pooledConn) {
      logger.warn(`Connection not found in pool ${poolName}`);
      return;
    }

    pooledConn.inUse = false;
    pooledConn.lastUsedAt = new Date();

    // Check if there are waiting requests
    const queue = this.supabaseWaitQueue.get(poolName) || [];
    if (queue.length > 0) {
      const waiter = queue.shift();
      if (waiter) {
        pooledConn.inUse = true;
        pooledConn.useCount++;
        waiter(client);
        this.updateMetrics(poolName, 'supabase', 'reuse');
      }
    }

    // Check connection health and recycle if needed
    this.checkConnectionHealth(poolName, pooledConn;
  }

  // Redis connection management
  public async getRedisConnection(poolName = 'default'): Promise<RedisClientType> {
    const pool = this.redisPools.get(poolName) || [];

    // Try to find an idle connection
    const idleConn = pool.find((conn) => !conn.inUse);
    if (idleConn) {
      idleConn.inUse = true;
      idleConn.lastUsedAt = new Date();
      idleConn.useCount++;
      this.updateMetrics(poolName, 'redis', 'acquire');
      return idleConn.connection;
    }

    // Check if we can create a new connection
    if (pool.length < this.config.redis.max) {
      try {
        const newConn = await this.createRedisConnection(poolName);
        return newConn;
      } catch (error) {
        logger.error(Failed to create Redi, error;
        throw error;
      }
    }

    // Wait for a connection to become available
    return this.waitForRedisConnection(poolName);
  }

  private async createRedisConnection(poolName: string: Promise<RedisClientType> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    const client = createRedisClient({
      url: redisUrl,
      socket: {
        connectTimeout: this.config.redis.acquireTimeoutMillis,
        reconnectStrategy: (retries) => {
          if (retries > this.config.redis.retryStrategy.times) {
            return new Error('Redis connection retry limit exceeded');
          }
          return this.config.redis.retryStrategy.interval * retries;
        },
      },
    }) as RedisClientType;

    await client.connect();

    const pooledConn: PooledConnection<RedisClientType> = {
      id: `${poolName}-${Date.now()}-${Math.random()}`,
      connection: client,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
      errors: 0,
      inUse: true,
    };

    const pool = this.redisPools.get(poolName) || [];
    pool.push(pooledConn);
    this.redisPools.set(poolName, pool;

    this.updateMetrics(poolName, 'redis', 'create');
    logger.info(`Created new Redis connection for pool ${poolName}`);

    // Set up_errorhandlers
    client.on('_error, (err) => {
      logger.error(Redi, err;
      pooledConn.errors++;
      this.updateMetrics(poolName, 'redis', '_error);
    });

    return client;
  }

  private async waitForRedisConnection(poolName: string: Promise<RedisClientType> {
    return new Promise((resolve, reject => {
      const queue = this.redisWaitQueue.get(poolName) || [];
      const timeout = setTimeout(() => {
        const index = queue.indexOf(resolve);
        if (index > -1) {
          queue.splice(index, 1);
        }
        reject(new Error(`Timeout waiting for Redis connection in pool ${poolName}`));`
      }, this.config.redis.acquireTimeoutMillis);

      queue.push((conn: RedisClientType => {
        clearTimeout(timeout);
        resolve(conn);
      });
      this.redisWaitQueue.set(poolName, queue;
      this.updateMetrics(poolName, 'redis', 'wait');
    });
  }

  public releaseRedisConnection(poolName = 'default', client: RedisClientType {
    const pool = this.redisPools.get(poolName) || [];
    const pooledConn = pool.find((conn) => conn.connection === client);

    if (!pooledConn) {
      logger.warn(`Redis connection not found in pool ${poolName}`);
      return;
    }

    pooledConn.inUse = false;
    pooledConn.lastUsedAt = new Date();

    // Check if there are waiting requests
    const queue = this.redisWaitQueue.get(poolName) || [];
    if (queue.length > 0) {
      const waiter = queue.shift();
      if (waiter) {
        pooledConn.inUse = true;
        pooledConn.useCount++;
        waiter(client);
        this.updateMetrics(poolName, 'redis', 'reuse');
      }
    }

    // Check connection health and recycle if needed
    this.checkConnectionHealth(poolName, pooledConn;
  }

  // Connection health and recycling
  private async checkConnectionHealth<T>(poolName: string, pooledConn: PooledConnection<T>) {
    const now = Date.now();
    const age = now - pooledConn.createdAt.getTime();
    const idleTime = now - pooledConn.lastUsedAt.getTime();

    // Recycle connections based on age, idle time, or_errorcount
    const shouldRecycle =;
      age > 3600000 || // 1 hour
      idleTime > this.config.database.idleTimeoutMillis ||
      pooledConn.errors > 5 ||
      pooledConn.useCount > 1000;

    if (shouldRecycle) {
      await this.recycleConnection(poolName, pooledConn;
    }
  }

  private async recycleConnection<T>(poolName: string, pooledConn: PooledConnection<T>) {
    logger.info(`Recycling connection ${pooledConn.id} in pool ${poolName}`);

    // Remove from pool
    if (pooledConn.connection instanceof SupabaseClient) {
      const pool = this.supabasePools.get(poolName) || [];
      const index = pool.indexOf(pooledConn as PooledConnection<SupabaseClient>);
      if (index > -1) {
        pool.splice(index, 1);
        this.supabasePools.set(poolName, pool;
      }
    } else {
      const pool = this.redisPools.get(poolName) || [];
      const index = pool.indexOf(pooledConn as PooledConnection<RedisClientType>);
      if (index > -1) {
        pool.splice(index, 1);
        this.redisPools.set(poolName, pool;

        // Close Redis connection
        try {
          await (pooledConn.connection as RedisClientType).quit();
        } catch (error) {
          logger.error(Error closing Redi, error;
        }
      }
    }

    this.updateMetrics(poolName, 'unknown', 'destroy');
  }

  // Metrics and monitoring
  private updateMetrics(
    poolName: string,
    type: 'supabase' | 'redis' | 'unknown',
    action: 'create' | 'acquire' | 'release' | 'wait' | 'reuse' | 'destroy' | '_error
  ) {
    const key = `${poolName}-${type}`;
    const metrics = this.metrics.get(key) || {
      active: 0,
      idle: 0,
      waiting: 0,
      created: 0,
      destroyed: 0,
      errors: 0,
      avgWaitTime: 0,
      avgActiveTime: 0,
    };

    switch (action) {
      case 'create':
        metrics.created++;
        metrics.active++;
        break;
      case 'acquire':
        metrics.active++;
        metrics.idle--;
        break;
      case 'release':
        metrics.active--;
        metrics.idle++;
        break;
      case 'wait':
        metrics.waiting++;
        break;
      case 'reuse':
        metrics.waiting--;
        break;
      case 'destroy':
        metrics.destroyed++;
        if (metrics.idle > 0) metrics.idle--;
        break;
      case 'error':
        metrics.errors++;
        break;
    }

    this.metrics.set(key, metrics;
    this.emit('metrics', { poolName, type, action, metrics });
  }

  private collectMetrics() {
    const report: any = {
      timestamp: new Date().toISOString(),
      pools: {},
    };

    // Collect Supabase metrics
    this.supabasePools.forEach((pool, poolName => {
      const active = pool.filter((conn) => conn.inUse).length;
      const idle = pool.filter((conn) => !conn.inUse).length;
      const waitQueue = this.supabaseWaitQueue.get(poolName) || [];

      report.pools[`${poolName}-supabase`] = {`
        total: pool.length,
        active,
        idle,
        waiting: waitQueue.length,
        utilization: pool.length > 0 ? (active / pool.length) * 100 : 0,
      };
    });

    // Collect Redis metrics
    this.redisPools.forEach((pool, poolName => {
      const active = pool.filter((conn) => conn.inUse).length;
      const idle = pool.filter((conn) => !conn.inUse).length;
      const waitQueue = this.redisWaitQueue.get(poolName) || [];

      report.pools[`${poolName}-redis`] = {`
        total: pool.length,
        active,
        idle,
        waiting: waitQueue.length,
        utilization: pool.length > 0 ? (active / pool.length) * 100 : 0,
      };
    });

    logger.info('Connection pool metrics:', report);
    this.emit('metrics-report', report);
  }

  public getMetrics(): Map<string, ConnectionMetrics> {
    return new Map(this.metrics);
  }

  public getPoolStatus(poolName = 'default')): any {
    const supabasePool = this.supabasePools.get(poolName) || [];
    const redisPool = this.redisPools.get(poolName) || [];

    return {
      supabase: {
        total: supabasePool.length,
        active: supabasePool.filter((conn) => conn.inUse).length,
        idle: supabasePool.filter((conn) => !conn.inUse).length,
        waiting: (this.supabaseWaitQueue.get(poolName) || []).length,
        connections: supabasePool.map((conn) => ({
          id: conn.id,
          inUse: conn.inUse,
          createdAt: conn.createdAt,
          lastUsedAt: conn.lastUsedAt,
          useCount: conn.useCount,
          errors: conn.errors,
        })),
      },
      redis: {
        total: redisPool.length,
        active: redisPool.filter((conn) => conn.inUse).length,
        idle: redisPool.filter((conn) => !conn.inUse).length,
        waiting: (this.redisWaitQueue.get(poolName) || []).length,
        connections: redisPool.map((conn) => ({
          id: conn.id,
          inUse: conn.inUse,
          createdAt: conn.createdAt,
          lastUsedAt: conn.lastUsedAt,
          useCount: conn.useCount,
          errors: conn.errors,
        })),
      },
    };
  }

  // Graceful shutdown
  public async shutdown() {
    logger.info('Shutting down connection pool manager...');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all Supabase connections
    for (const [poolName, pool] of this.supabasePools) {
      logger.info(`Closing ${pool.length} Supabase connections in pool ${poolName}`);
      // Supabase clients don't need explicit closing
      pool.length = 0;
    }

    // Close all Redis connections
    for (const [poolName, pool] of this.redisPools) {
      logger.info(`Closing ${pool.length} Redis connections in pool ${poolName}`);
      for (const conn of pool) {
        try {
          await conn.connection.quit();
        } catch (error) {
          logger.error(Error closing Redi, error;
        }
      }
      pool.length = 0;
    }

    this.removeAllListeners();
    logger.info('Connection pool manager shutdown complete');
  }
}

// Export singleton instance
export const connectionPoolManager = ConnectionPoolManager.getInstance();
