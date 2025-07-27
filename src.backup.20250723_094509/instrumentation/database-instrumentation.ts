import { SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { telemetryService } from '../services/telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';

interface DatabaseOperation {
  operation: string;
  table?: string;
  query?: string;
  params?: any[];
  database?: string;
}

interface DatabaseResult<T = any> {
  data: T;
  count?: number;
  error: Error;
}

export class DatabaseInstrumentation {
  private tracer = telemetryService.getTracer();

  /**
   * Wrap a Supabase client to add automatic tracing
   */
  instrumentSupabaseClient(client: any): any {
    const instrumented = Object.create(client);

    // Instrument common Supabase methods
    const methods = ['from', 'rpc', 'auth', 'storage', 'realtime'];

    methods.forEach((method) => {
      if (client[method]) {
        instrumented[method] = this.wrapMethod(client, method);
      }
    });

    return instrumented;
  }

  /**
   * Wrap a database query function with tracing
   */
  wrapQuery<T extends (...args: any[]) => Promise<unknown>>(fn: T, operation: DatabaseOperation): T {
    const instrumentation = this;

    return async function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
      return instrumentation.withDatabaseSpan(operation, async () => {
        return fn.apply(this, args);
      });
    } as T;
  }

  /**
   * Execute a database operation with tracing
   */
  async withDatabaseSpan<T>(operation: DatabaseOperation, fn: () => Promise<T>): Promise<T> {
    const spanName = `db.${operation.operation}${operation.table ? ` ${operation.table}` : ''}`;
    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.DB_SYSTEM]: 'postgresql',
        [SemanticAttributes.DB_OPERATION]: operation.operation,
        [SemanticAttributes.DB_NAME]: operation.database || process.env.SUPABASE_DB || 'supabase',
        'db.table': operation.table,
        'db.statement': operation.query?.substring(0, 500), // Limit query size
        'db.params.count': operation.params?.length || 0,
      },
    });

    const startTime = Date.now();

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);

      // Add result metrics
      const duration = Date.now() - startTime;
      span.setAttribute('db.duration_ms', duration);

      if (result && typeof result === 'object') {
        if ('count' in result) {
          span.setAttribute('db.rows_affected', Number(result.count));
        }
        if (Array.isArray(result)) {
          span.setAttribute('db.rows_returned', result.length);
        }
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Database operation failed',
      });

      // Add _errordetails
      if (error instanceof Error) {
        span.setAttribute('_errortype', error.name);
        span.setAttribute('error.message', error.message);
        span.setAttribute('error.stack', error.stack?.substring(0, 1000) || '');
      }

      logger.error('Database operation failed', LogContext.DATABASE, {
        operation: operation.operation,
        table: operation.table,
        _error
        duration: Date.now() - startTime,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Instrument a Supabase query builder
   */
  instrumentQueryBuilder(builder: any, table: string): any {
    const instrumented = Object.create(builder);
    const operation: DatabaseOperation = { operation: 'query', table };

    // Track query building
    const queryParts: string[] = [];

    // Instrument chainable methods
    const chainableMethods = [
      'select',
      'insert',
      'update',
      'upsert',
      'delete',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'like',
      'ilike',
      'is',
      'in',
      'contains',
      'containedBy',
      'range',
      'order',
      'limit',
      'offset',
      'single',
      'maybeSingle',
    ];

    chainableMethods.forEach((method) => {
      if (builder[method]) {
        instrumented[method] = function (...args: any[]) {
          queryParts.push(`${method}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
          const result = builder[method].apply(builder, args);

          // Update operation type based on method
          if (['select', 'insert', 'update', 'upsert', 'delete'].includes(method)) {
            operation.operation = method;
          }

          // Return instrumented result if it's chainable
          return result === builder ? instrumented : result;
        };
      }
    });

    // Instrument execution methods
    const executionMethods = ['then', 'catch', 'finally'];

    executionMethods.forEach((method) => {
      if (builder[method]) {
        instrumented[method] = function (this: DatabaseInstrumentation, ...args: any[]) {
          operation.query = queryParts.join('.');

          return this.withDatabaseSpan(operation, () => {
            return builder[method].apply(builder, args);
          });
        }.bind(this);
      }
    });

    return instrumented;
  }

  /**
   * Create a traced database transaction
   */
  async withTransaction<T>(
    name: string,
    fn: (tx: any) => Promise<T>,
    options?: {
      isolationLevel?: 'read-uncommitted' | 'read-committed' | 'repeatable-read' | 'serializable';
      timeout?: number;
    }
  ): Promise<T> {
    const span = this.tracer.startSpan(`db.transaction ${name}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.DB_SYSTEM]: 'postgresql',
        [SemanticAttributes.DB_OPERATION]: 'transaction',
        'db.transaction.name': name,
        'db.transaction.isolation_level': options?.isolationLevel,
        'db.transaction.timeout': options?.timeout,
      },
    });

    const startTime = Date.now();

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () => fn({}));

      span.setAttribute('db.transaction.duration_ms', Date.now() - startTime);
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Transaction failed',
      });

      logger.error('Database transaction failed', LogContext.DATABASE, {
        transaction: name,
        _error
        duration: Date.now() - startTime,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Record database pool metrics
   */
  recordPoolMetrics(metrics: {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  }): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('db.pool.total_connections', metrics.totalConnections);
      span.setAttribute('db.pool.idle_connections', metrics.idleConnections);
      span.setAttribute('db.pool.waiting_clients', metrics.waitingClients);
      span.setAttribute(
        'db.pool.utilization',
        metrics.totalConnections > 0
          ? (metrics.totalConnections - metrics.idleConnections) / metrics.totalConnections
          : 0
      );
    }
  }

  /**
   * Helper to wrap a method with instrumentation
   */
  private wrapMethod(target: any, method: string): any {
    const original = target[method];
    const instrumentation = this;

    return function (...args: any[]) {
      const result = original.apply(target, args);

      // Handle special cases
      if (method === 'from' && typeof args[0] === 'string') {
        return instrumentation.instrumentQueryBuilder(result, args[0]);
      }

      if (method === 'rpc' && typeof args[0] === 'string') {
        return instrumentation.wrapQuery(() => result, {
          operation: 'rpc',
          table: args[0],
          params: args[1],
        })();
      }

      return result;
    };
  }
}

// Export singleton instance
export const databaseInstrumentation = new DatabaseInstrumentation();

// Export convenience functions
export const instrumentSupabase = (client: any) =>
  databaseInstrumentation.instrumentSupabaseClient(client);

export const withDatabaseSpan = <T>(operation: DatabaseOperation, fn: () => Promise<T>) =>
  databaseInstrumentation.withDatabaseSpan(operation, fn);

export const withTransaction = <T>(name: string, fn: (tx: any) => Promise<T>, options?: any) =>
  databaseInstrumentation.withTransaction(name, fn, options);
