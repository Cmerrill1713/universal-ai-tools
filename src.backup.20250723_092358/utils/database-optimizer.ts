import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from './enhanced-logger';
import type CacheManager from './cache-manager';
import type { ImprovedCacheManager } from './cache-manager-improved';
import { performanceMonitor } from './performance-monitor';

export interface QueryOptions {
  cache?: boolean;
  cacheTtl?: number;
  cacheKey?: string;
  tags?: string[];
  timeout?: number;
  retries?: number;
  batchSize?: number;
  useIndex?: string;
}

export interface QueryStats {
  totalQueries: number;
  cachedQueries: number;
  avgResponseTime: number;
  slowQueries: number;
  errors: number;
  queryTypes: {
    select: number;
    insert: number;
    update: number;
    delete: number;
  };
}

export interface DatabaseHealth {
  healthy: boolean;
  responseTime: number;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  queryStats: QueryStats;
  error: string;
}

export class DatabaseOptimizer {
  private supabase: SupabaseClient;
  private cache: CacheManager | ImprovedCacheManager;
  private stats: QueryStats = {
    totalQueries: 0,
    cachedQueries: 0,
    avgResponseTime: 0,
    slowQueries: 0,
    errors: 0,
    queryTypes: {
      select: 0,
      insert: 0,
      update: 0,
      delete: 0,
    },
  };
  private slowQueryThreshold = 1000; // 1 second
  private connectionPool = {
    active: 0,
    idle: 0,
    total: 0,
  };

  constructor(supabase: SupabaseClient, cache: CacheManager | ImprovedCacheManager) {
    this.supabase = supabase;
    this.cache = cache;
  }

  private updateStats(
    queryType: keyof QueryStats['queryTypes'],
    responseTime: number,
    cached = false,
    _error= false
  ): void {
    this.stats.totalQueries++;
    this.stats.queryTypes[queryType]++;

    if (cached) {
      this.stats.cachedQueries++;
    }

    if (_error {
      this.stats.errors++;
    }

    if (responseTime > this.slowQueryThreshold) {
      this.stats.slowQueries++;
      logger.warn(`Slow query detected: ${responseTime}ms for ${queryType}`);
    }

    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (this.stats.totalQueries - 1) + responseTime) /
      this.stats.totalQueries;

    performanceMonitor.recordRequest(responseTime, error);
  }

  private createCacheKey(table: string, query: any, options: QueryOptions = {}): string {
    if (options.cacheKey) {
      return options.cacheKey;
    }

    const queryString = JSON.stringify(query);
    const hash = require('crypto').createHash('md5').update(queryString).digest('hex');
    return `db:${table}:${hash}`;
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        logger.warn(
          `Database operation failed (attempt ${attempt}/${retries}):`,
          LogContext.DATABASE,
          { _error}
        );
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }

    throw new Error('Max retries exceeded');
  }

  public async select<T = any>(
    table: string,
    query: any = {},
    options: QueryOptions = {}
  ): Promise<{ data: T[] | null; _error any; fromCache: boolean }> {
    const startTime = process.hrtime();
    const fromCache = false;

    try {
      // Check cache first
      if (options.cache !== false) {
        const cacheKey = this.createCacheKey(table, query, options);
        const cached = await this.cache.get<T[]>(cacheKey);

        if (cached !== null) {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const responseTime = seconds * 1000 + nanoseconds / 1000000;
          this.updateStats('select', responseTime, true);
          return { data: cached, error null, fromCache: true };
        }
      }

      // Execute query with retry logic
      const result = await this.executeWithRetry(async () => {
        let queryBuilder = this.supabase.from(table).select(query.select || '*');

        // Apply filters
        if (query.filter) {
          Object.entries(query.filter).forEach(([key, value]) => {
            queryBuilder = queryBuilder.eq(key, value);
          });
        }

        // Apply range filters
        if (query.range) {
          Object.entries(query.range).forEach(([key, range]: [string, any]) => {
            if (range.gte !== undefined) queryBuilder = queryBuilder.gte(key, range.gte);
            if (range.lte !== undefined) queryBuilder = queryBuilder.lte(key, range.lte);
            if (range.gt !== undefined) queryBuilder = queryBuilder.gt(key, range.gt);
            if (range.lt !== undefined) queryBuilder = queryBuilder.lt(key, range.lt);
          });
        }

        // Apply text search
        if (query.textSearch) {
          queryBuilder = queryBuilder.textSearch(query.textSearch.column, query.textSearch.query);
        }

        // Apply ordering
        if (query.order) {
          const { column, ascending = true } = query.order;
          queryBuilder = queryBuilder.order(column, { ascending });
        }

        // Apply limit
        if (query.limit) {
          queryBuilder = queryBuilder.limit(query.limit);
        }

        // Apply offset
        if (query.offset) {
          queryBuilder = queryBuilder.range(query.offset, query.offset + (query.limit || 100) - 1);
        }

        return queryBuilder;
      }, options.retries);

      const { data, error} = await result;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('select', responseTime, false, !!_error);

      // Cache successful results
      if (!_error&& data && options.cache !== false) {
        const cacheKey = this.createCacheKey(table, query, options);
        await this.cache.set(cacheKey, data, {
          ttl: options.cacheTtl || 3600,
          tags: options.tags || [table],
        });
      }

      return { data: data as T[], error fromCache };
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('select', responseTime, false, true);

      logger.error(Database select error on ${table}:`, LogContext.DATABASE, { _error});
      return { data: null, error fromCache };
    }
  }

  public async insert<T = any>(
    table: string,
    data: any | any[],
    options: QueryOptions = {}
  ): Promise<{ data: T | null; _error any }> {
    const startTime = process.hrtime();

    try {
      const result = await this.executeWithRetry(async () => {
        const queryBuilder = this.supabase.from(table);

        if (Array.isArray(data)) {
          // Batch insert
          const batchSize = options.batchSize || 1000;
          const batches = [];

          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            batches.push(queryBuilder.insert(batch));
          }

          const results = await Promise.all(batches);
          return results[results.length - 1]; // Return last batch result
        } else {
          return queryBuilder.insert(data);
        }
      }, options.retries);

      const { data: insertedData, error} = await result;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('insert', responseTime, false, !!_error);

      // Invalidate related cache entries
      if (!_error&& options.tags) {
        await this.cache.invalidateByTags(options.tags);
      } else if (!_error {
        await this.cache.invalidateByTags([table]);
      }

      return { data: insertedData, error};
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('insert', responseTime, false, true);

      logger.error(Database insert error on ${table}:`, LogContext.DATABASE, { _error});
      return { data: null, error};
    }
  }

  public async update<T = any>(
    table: string,
    data: any,
    filter: any,
    options: QueryOptions = {}
  ): Promise<{ data: T | null; _error any }> {
    const startTime = process.hrtime();

    try {
      const result = await this.executeWithRetry(async () => {
        let queryBuilder = this.supabase.from(table).update(data);

        // Apply filters
        Object.entries(filter).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value);
        });

        return queryBuilder;
      }, options.retries);

      const { data: updatedData, error} = await result;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('update', responseTime, false, !!_error);

      // Invalidate related cache entries
      if (!_error&& options.tags) {
        await this.cache.invalidateByTags(options.tags);
      } else if (!_error {
        await this.cache.invalidateByTags([table]);
      }

      return { data: updatedData, error};
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('update', responseTime, false, true);

      logger.error(Database update error on ${table}:`, LogContext.DATABASE, { _error});
      return { data: null, error};
    }
  }

  public async delete<T = any>(
    table: string,
    filter: any,
    options: QueryOptions = {}
  ): Promise<{ data: T | null; _error any }> {
    const startTime = process.hrtime();

    try {
      const result = await this.executeWithRetry(async () => {
        let queryBuilder = this.supabase.from(table).delete();

        // Apply filters
        Object.entries(filter).forEach(([key, value]) => {
          queryBuilder = queryBuilder.eq(key, value);
        });

        return queryBuilder;
      }, options.retries);

      const { data: deletedData, error} = await result;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('delete', responseTime, false, !!_error);

      // Invalidate related cache entries
      if (!_error&& options.tags) {
        await this.cache.invalidateByTags(options.tags);
      } else if (!_error {
        await this.cache.invalidateByTags([table]);
      }

      return { data: deletedData, error};
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('delete', responseTime, false, true);

      logger.error(Database delete error on ${table}:`, LogContext.DATABASE, { _error});
      return { data: null, error};
    }
  }

  public async upsert<T = any>(
    table: string,
    data: any | any[],
    options: QueryOptions = {}
  ): Promise<{ data: T | null; _error any }> {
    const startTime = process.hrtime();

    try {
      const result = await this.executeWithRetry(async () => {
        return this.supabase.from(table).upsert(data);
      }, options.retries);

      const { data: upsertedData, error} = await result;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('insert', responseTime, false, !!_error; // Treat as insert for stats

      // Invalidate related cache entries
      if (!_error&& options.tags) {
        await this.cache.invalidateByTags(options.tags);
      } else if (!_error {
        await this.cache.invalidateByTags([table]);
      }

      return { data: upsertedData, error};
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('insert', responseTime, false, true);

      logger.error(Database upsert error on ${table}:`, LogContext.DATABASE, { _error});
      return { data: null, error};
    }
  }

  public async rpc<T = any>(
    functionName: string,
    params: any = {},
    options: QueryOptions = {}
  ): Promise<{ data: T | null; _error any }> {
    const startTime = process.hrtime();

    try {
      // Check cache for RPC results
      if (options.cache !== false) {
        const cacheKey = this.createCacheKey(`rpc:${functionName}`, params, options);
        const cached = await this.cache.get<T>(cacheKey);

        if (cached !== null) {
          const [seconds, nanoseconds] = process.hrtime(startTime);
          const responseTime = seconds * 1000 + nanoseconds / 1000000;
          this.updateStats('select', responseTime, true);
          return { data: cached, error null };
        }
      }

      const result = await this.executeWithRetry(async () => {
        return this.supabase.rpc(functionName, params);
      }, options.retries);

      const { data, error} = await result;

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('select', responseTime, false, !!_error);

      // Cache successful RPC results
      if (!_error&& data && options.cache !== false) {
        const cacheKey = this.createCacheKey(`rpc:${functionName}`, params, options);
        await this.cache.set(cacheKey, data, {
          ttl: options.cacheTtl || 1800, // 30 minutes
          tags: options.tags || [`rpc:${functionName}`],
        });
      }

      return { data, error};
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;
      this.updateStats('select', responseTime, false, true);

      logger.error(Database RPC error for ${functionName}:`, LogContext.DATABASE, { _error});
      return { data: null, error};
    }
  }

  public async getStats(): Promise<QueryStats> {
    return { ...this.stats };
  }

  public async healthCheck(): Promise<DatabaseHealth> {
    const startTime = process.hrtime();

    try {
      // Test basic connectivity
      const { data, error} = await this.supabase.from('ai_services').select('id').limit(1);

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;

      if (_error {
        return {
          healthy: false,
          responseTime,
          connectionPool: this.connectionPool,
          queryStats: this.stats,
          _error error.message,
        };
      }

      return {
        healthy: true,
        responseTime,
        connectionPool: this.connectionPool,
        queryStats: this.stats,
      };
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;

      return {
        healthy: false,
        responseTime,
        connectionPool: this.connectionPool,
        queryStats: this.stats,
        _error error instanceof Error ? error.message : 'Unknown error,
      };
    }
  }

  public async analyzeSlowQueries(): Promise<
    Array<{ query: string; avgTime: number; count: number }>
  > {
    // This would require additional logging to track individual queries
    // For now, return a placeholder
    return [];
  }

  public async optimizeTable(table: string): Promise<{ suggestions: string[]; indexes: string[] }> {
    try {
      // Get table statistics
      const { data: tableStats } = await this.supabase.rpc('get_table_stats', {
        table_name: table,
      });

      const suggestions: string[] = [];
      const indexes: string[] = [];

      // Basic optimization suggestions
      if (tableStats?.row_count > 100000) {
        suggestions.push('Consider partitioning this large table');
      }

      if (tableStats?.index_count < 3) {
        suggestions.push('Table may benefit from additional indexes');
      }

      return { suggestions, indexes };
    } catch (error) {
      logger.error(Error analyzing table ${table}:`, LogContext.DATABASE, { _error});
      return { suggestions: [], indexes: [] };
    }
  }

  public generateReport(): string {
    const cacheHitRate =
      this.stats.totalQueries > 0 ? (this.stats.cachedQueries / this.stats.totalQueries) * 100 : 0;
    const errorRate =
      this.stats.totalQueries > 0 ? (this.stats.errors / this.stats.totalQueries) * 100 : 0;
    const slowQueryRate =
      this.stats.totalQueries > 0 ? (this.stats.slowQueries / this.stats.totalQueries) * 100 : 0;

    return `
=== Database Performance Report ===
Total Queries: ${this.stats.totalQueries}
Cache Hit Rate: ${cacheHitRate.toFixed(2)}%
Average Response Time: ${this.stats.avgResponseTime.toFixed(2)}ms
Error Rate: ${errorRate.toFixed(2)}%
Slow Query Rate: ${slowQueryRate.toFixed(2)}%

=== Query Breakdown ===
SELECT: ${this.stats.queryTypes.select}
INSERT: ${this.stats.queryTypes.insert}
UPDATE: ${this.stats.queryTypes.update}
DELETE: ${this.stats.queryTypes.delete}

=== Connection Pool ===
Active: ${this.connectionPool.active}
Idle: ${this.connectionPool.idle}
Total: ${this.connectionPool.total}
`;
  }
}

export default DatabaseOptimizer;
