import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { telemetryService } from '../services/telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';

interface CacheOperation {
  operation: string;
  key?: string | string[];
  ttl?: number;
  namespace?: string;
}

export class RedisInstrumentation {
  private tracer = telemetryService.getTracer();

  /**
   * Wrap a Redis client to add automatic tracing
   */
  instrumentRedisClient(client: any): any {
    const instrumented = Object.create(client);

    // Common Redis commands to instrument
    const commands = [
      // String operations
      'get',
      'set',
      'mget',
      'mset',
      'del',
      'exists',
      'expire',
      'ttl',
      'incr',
      'decr',
      'incrby',
      'decrby',
      // Hash operations
      'hget',
      'hset',
      'hmget',
      'hmset',
      'hdel',
      'hgetall',
      'hkeys',
      'hvals',
      // List operations
      'lpush',
      'rpush',
      'lpop',
      'rpop',
      'lrange',
      'llen',
      // Set operations
      'sadd',
      'srem',
      'smembers',
      'sismember',
      'scard',
      // Sorted set operations
      'zadd',
      'zrem',
      'zrange',
      'zrevrange',
      'zscore',
      'zcard',
      // Other operations
      'ping',
      'flushdb',
      'flushall',
      'keys',
      'scan',
    ];

    commands.forEach((command) => {
      if (client[command]) {
        instrumented[command] = this.wrapCommand(client, command);
      }
    });

    // Instrument pipeline/multi for batch operations
    if (client.pipeline || client.multi) {
      instrumented.pipeline = this.wrapPipeline(client.pipeline?.bind(client));
      instrumented.multi = this.wrapPipeline(client.multi?.bind(client));
    }

    return instrumented;
  }

  /**
   * Wrap a cache operation with tracing
   */
  async withCacheSpan<T>(operation: CacheOperation, fn: () => Promise<T>): Promise<T> {
    const spanName = `cache.${operation.operation}`;
    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'redis',
        'db.operation': operation.operation,
        'cache.operation': operation.operation,
        'cache.key': Array.isArray(operation.key)
          ? operation.key.join(',').substring(0, 100)
          : operation.key?.substring(0, 100),
        'cache.key.count': Array.isArray(operation.key) ? operation.key.length : 1,
        'cache.ttl': operation.ttl,
        'cache.namespace': operation.namespace || 'default',
        'net.peer.name': process.env.REDIS_HOST || 'localhost',
        'net.peer.port': parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    });

    const startTime = Date.now();
    let hit = false;

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);

      // Determine cache hit/miss for get operations
      if (operation.operation === 'get' || operation.operation === 'mget') {
        hit = result !== null && result !== undefined;
        if (Array.isArray(result)) {
          hit = result.some((r) => r !== null);
          span.setAttribute('cache.hits', result.filter((r) => r !== null).length);
          span.setAttribute('cache.misses', result.filter((r) => r === null).length);
        }
      }

      span.setAttribute('cache.hit', hit);
      span.setAttribute('cache.duration_ms', Date.now() - startTime);

      // Add size information if available
      if (result !== null && result !== undefined) {
        if (typeof result === 'string') {
          span.setAttribute('cache.item_size', result.length);
        } else if (Buffer.isBuffer(result)) {
          span.setAttribute('cache.item_size', result.byteLength);
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (_error) {
      span.recordException(_erroras Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: _errorinstanceof Error ? _errormessage : 'Cache operation failed',
      });

      logger.error'Cache operation failed', LogContext.SYSTEM, {
        operation: operation.operation,
        key: operation.key,
        _error
        duration: Date.now() - startTime,
      });

      throw _error;
    } finally {
      // Record metrics
      this.recordCacheMetrics(operation.operation, hit, Date.now() - startTime);
      span.end();
    }
  }

  /**
   * Wrap a Redis command
   */
  private wrapCommand(client: any, command: string): any {
    const instrumentation = this;

    return function (...args: any[]) {
      // Extract key from arguments
      let key: string | string[] | undefined;
      if (args.length > 0) {
        if (Array.isArray(args[0])) {
          key = args[0];
        } else if (typeof args[0] === 'string') {
          key = args[0];
        }
      }

      // Extract TTL for set operations
      let ttl: number | undefined;
      if (command === 'set' && args.length > 2) {
        if (args[2] === 'EX' && args[3]) {
          ttl = parseInt(args[3], 10);
        } else if (args[2] === 'PX' && args[3]) {
          ttl = parseInt(args[3], 10) / 1000;
        }
      } else if (command === 'expire' && args.length > 1) {
        ttl = parseInt(args[1], 10);
      }

      const operation: CacheOperation = {
        operation: command,
        key,
        ttl,
      };

      return instrumentation.withCacheSpan(operation, () => {
        return client[command].apply(client, args);
      });
    };
  }

  /**
   * Wrap pipeline/multi for batch operations
   */
  private wrapPipeline(pipelineFn: any): any {
    const instrumentation = this;

    return function () {
      const pipeline = pipelineFn();
      const operations: CacheOperation[] = [];

      // Create a wrapped pipeline that tracks operations
      const wrapped = Object.create(pipeline);

      // Track each operation added to the pipeline
      const commands = Object.getOwnPropertyNames(pipeline).filter(
        (prop) => typeof pipeline[prop] === 'function' && prop !== 'exec'
      );

      commands.forEach((command) => {
        wrapped[command] = function (...args: any[]) {
          operations.push({
            operation: command,
            key: args[0],
          });
          pipeline[command].apply(pipeline, args);
          return wrapped; // Allow chaining
        };
      });

      // Wrap exec to trace the entire batch
      wrapped.exec = function (callback?: Function) {
        const span = instrumentation.tracer.startSpan('cache.pipeline', {
          kind: SpanKind.CLIENT,
          attributes: {
            'db.system': 'redis',
            'db.operation': 'pipeline',
            'cache.operation': 'pipeline',
            'cache.pipeline.commands': operations.length,
            'cache.pipeline.operations': operations.map((op) => op.operation).join(','),
          },
        });

        const startTime = Date.now();

        const executeWithSpan = async () => {
          try {
            const result = await pipeline.exec();

            span.setAttribute('cache.pipeline.duration_ms', Date.now() - startTime);
            span.setStatus({ code: SpanStatusCode.OK });

            return result;
          } catch (_error) {
            span.recordException(_erroras Error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: _errorinstanceof Error ? _errormessage : 'Pipeline execution failed',
            });
            throw _error;
          } finally {
            span.end();
          }
        };

        if (callback) {
          executeWithSpan()
            .then((result) => callback(null, result))
            .catch((_error => callback(_error);
        } else {
          return executeWithSpan();
        }
      };

      return wrapped;
    };
  }

  /**
   * Record cache metrics
   */
  private recordCacheMetrics(operation: string, hit: boolean, duration: number): void {
    // This would typically send metrics to a metrics backend
    // For now, we'll just add attributes to the current span
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(`cache.metrics.${operation}.count`, 1);
      span.setAttribute(`cache.metrics.${operation}.duration_ms`, duration);
      if (operation === 'get' || operation === 'mget') {
        span.setAttribute(`cache.metrics.${operation}.${hit ? 'hits' : 'misses'}`, 1);
      }
    }
  }

  /**
   * Create a cache key with namespace
   */
  createNamespacedKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  /**
   * Wrap a caching function with automatic tracing
   */
  wrapCacheFunction<T extends (...args: any[]) => Promise<unknown>>(
    fn: T,
    options: {
      operation: string;
      keyExtractor: (...args: Parameters<T>) => string;
      ttl?: number;
      namespace?: string;
    }
  ): T {
    const instrumentation = this;

    return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      const key = options.keyExtractor(...args);
      const operation: CacheOperation = {
        operation: options.operation,
        key,
        ttl: options.ttl,
        namespace: options.namespace,
      };

      return instrumentation.withCacheSpan(operation, () => fn(...args));
    } as T;
  }

  /**
   * Monitor cache health metrics
   */
  async monitorCacheHealth(client: any): Promise<void> {
    const span = this.tracer.startSpan('cache.health_check', {
      kind: SpanKind.CLIENT,
    });

    try {
      // Check connection
      const pingStart = Date.now();
      await client.ping();
      const pingDuration = Date.now() - pingStart;

      span.setAttribute('cache.health.ping_duration_ms', pingDuration);
      span.setAttribute('cache.health.connected', true);

      // Get cache info
      if (client.info) {
        const info = await client.info();
        const lines = info.split('\n');
        const stats: Record<string, string> = {};

        lines.forEach((line: string) => {
          const [key, value] = line.split(':');
          if (key && value) {
            stats[key.trim()] = value.trim();
          }
        });

        // Add relevant metrics
        if (stats.used_memory) {
          span.setAttribute('cache.health.memory_used', parseInt(stats.used_memory, 10));
        }
        if (stats.connected_clients) {
          span.setAttribute('cache.health.connected_clients', parseInt(stats.connected_clients, 10));
        }
        if (stats.total_commands_processed) {
          span.setAttribute(
            'cache.health.total_commands',
            parseInt(stats.total_commands_processed, 10)
          );
        }
        if (stats.evicted_keys) {
          span.setAttribute('cache.health.evicted_keys', parseInt(stats.evicted_keys, 10));
        }
        if (stats.keyspace_hits && stats.keyspace_misses) {
          const hits = parseInt(stats.keyspace_hits, 10);
          const misses = parseInt(stats.keyspace_misses, 10);
          const hitRate = hits / (hits + misses);
          span.setAttribute('cache.health.hit_rate', hitRate);
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
    } catch (_error) {
      span.recordException(_erroras Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'Cache health check failed',
      });
      span.setAttribute('cache.health.connected', false);
    } finally {
      span.end();
    }
  }
}

// Export singleton instance
export const redisInstrumentation = new RedisInstrumentation();

// Export convenience functions
export const instrumentRedis = (client: any) => redisInstrumentation.instrumentRedisClient(client);

export const withCacheSpan = <T>(operation: CacheOperation, fn: () => Promise<T>) =>
  redisInstrumentation.withCacheSpan(operation, fn);

export const wrapCacheFunction = <T extends (...args: any[]) => Promise<unknown>>(
  fn: T,
  options: any
) => redisInstrumentation.wrapCacheFunction(fn, options);
