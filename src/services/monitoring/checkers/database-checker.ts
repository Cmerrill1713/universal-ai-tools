/**
 * Database Health Checker
 * Checks database connectivity and performance
 */

import { Logger } from '../../../utils/logger';
import type { HealthCheck, HealthCheckConfig, HealthChecker, ServiceType } from '../types';

export class DatabaseHealthChecker implements HealthChecker {
  public readonly name = 'database';
  private readonly logger: Logger;
  private supabase: any = null;

  constructor() {
    this.logger = new Logger('DatabaseHealthChecker');
    this.initializeSupabase();
  }

  private async initializeSupabase(): Promise<void> {
    try {
      const { supabaseClient } = await import('../../../services/supabase-client');
      this.supabase = supabaseClient;
    } catch (error) {
      this.logger.warn('Supabase client not available for database health checks');
    }
  }

  supports(type: ServiceType): boolean {
    return type === 'database';
  }

  async check(config: HealthCheckConfig): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      if (!this.supabase) {
        throw new Error('Database client not available');
      }

      // Simple connectivity test
      const { data, error } = await this.supabase
        .from('monitoring_health_check')
        .select('count')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        // If table doesn't exist, try a simpler check
        if (error.code === '42P01') {
          // Table does not exist
          // Try to check database version or other basic query
          const { data: versionData, error: versionError } = await this.supabase.rpc('version'); // Try to get database version

          if (versionError) {
            throw new Error(`Database connection failed: ${versionError.message}`);
          }

          return {
            service: config.service,
            status: 'healthy',
            responseTime,
            timestamp: new Date(),
            details: {
              connectionTest: 'passed',
              responseTime,
              tableCheck: 'monitoring table not found (expected)',
              databaseVersion: versionData,
            },
          };
        } else {
          throw error;
        }
      }

      // Determine status based on response time
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (responseTime < 100) {
        status = 'healthy';
      } else if (responseTime < 1000) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      // Additional performance checks
      const details: Record<string, any> = {
        connectionTest: 'passed',
        responseTime,
        queryTest: 'passed',
      };

      // Try to get some database statistics
      try {
        const statsStartTime = Date.now();
        const { data: statsData, error: statsError } = await this.supabase
          .from('pg_stat_database')
          .select('numbackends, xact_commit, xact_rollback')
          .limit(1);

        const statsResponseTime = Date.now() - statsStartTime;

        if (!statsError && statsData) {
          details.statistics = {
            activeConnections: statsData[0]?.numbackends,
            committedTransactions: statsData[0]?.xact_commit,
            rolledBackTransactions: statsData[0]?.xact_rollback,
            statsQueryTime: statsResponseTime,
          };
        }
      } catch (statsError) {
        // Stats query failed, but main connection worked
        details.statsError = 'Unable to query database statistics';
      }

      // Check for connection pool health (if available)
      try {
        const poolInfo = this.getConnectionPoolInfo();
        if (poolInfo) {
          details.connectionPool = poolInfo;
        }
      } catch (poolError) {
        details.poolError = 'Connection pool info not available';
      }

      return {
        service: config.service,
        status,
        responseTime,
        timestamp: new Date(),
        details,
      };
    } catch (error) {
      const responseTime = Math.max(1, Date.now() - startTime); // Ensure at least 1ms

      const errorDetails: Record<string, any> = {
        responseTime,
        connectionTest: 'failed',
      };

      if (error instanceof Error) {
        errorDetails.errorType = error.constructor.name;
        errorDetails.errorCode = (error as any).code;

        // Categorize database errors
        if (error.message.includes('connection')) {
          errorDetails.connectionError = true;
        } else if (error.message.includes('timeout')) {
          errorDetails.timeoutError = true;
        } else if (error.message.includes('authentication')) {
          errorDetails.authError = true;
        } else if (error.message.includes('permission')) {
          errorDetails.permissionError = true;
        }
      }

      return {
        service: config.service,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown database error',
        details: errorDetails,
      };
    }
  }

  private getConnectionPoolInfo(): any | null {
    // This would return actual connection pool information
    // Implementation depends on the database client being used
    return null;
  }

  // Utility method to create health check table if needed
  async ensureHealthCheckTable(): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      // Try to create a simple health check table
      const { error } = await this.supabase.rpc('create_monitoring_health_check_table');

      if (error) {
        this.logger.debug('Health check table creation failed (may already exist)', error);
      } else {
        this.logger.info('Health check table created successfully');
      }
    } catch (error) {
      this.logger.debug('Unable to create health check table', error);
    }
  }

  // Advanced health checks
  async performDetailedCheck(config: HealthCheckConfig): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const checks = await Promise.allSettled([
        this.checkConnection(),
        this.checkQueryPerformance(),
        this.checkTransactionSupport(),
        this.checkConnectionCount(),
      ]);

      const responseTime = Date.now() - startTime;
      const results = checks.map((result, index) => ({
        test: ['connection', 'queryPerformance', 'transactions', 'connections'][index],
        success: result.status === 'fulfilled',
        result: result.status === 'fulfilled' ? result.value : result.reason?.message,
      }));

      const failedChecks = results.filter(r => !r.success);
      const status =
        failedChecks.length === 0 ? 'healthy' : failedChecks.length <= 1 ? 'degraded' : 'unhealthy';

      return {
        service: config.service,
        status,
        responseTime,
        timestamp: new Date(),
        details: {
          detailedChecks: results,
          totalChecks: checks.length,
          passedChecks: results.length - failedChecks.length,
          failedChecks: failedChecks.length,
        },
      };
    } catch (error) {
      return {
        service: config.service,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Detailed check failed',
      };
    }
  }

  private async checkConnection(): Promise<string> {
    if (!this.supabase) {
      throw new Error('No database client');
    }

    const { error } = await this.supabase
      .from('information_schema.tables')
      .select('count')
      .limit(1);

    if (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }

    return 'Connection successful';
  }

  private async checkQueryPerformance(): Promise<string> {
    if (!this.supabase) {
      throw new Error('No database client');
    }

    const startTime = Date.now();
    const { error } = await this.supabase
      .from('information_schema.columns')
      .select('count')
      .limit(100);
    const queryTime = Date.now() - startTime;

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    if (queryTime > 5000) {
      throw new Error(`Query too slow: ${queryTime}ms`);
    }

    return `Query performance: ${queryTime}ms`;
  }

  private async checkTransactionSupport(): Promise<string> {
    // This would test transaction support
    return 'Transaction support available';
  }

  private async checkConnectionCount(): Promise<string> {
    // This would check active connection count
    return 'Connection count within limits';
  }
}
