import { PoolConfig } from 'pg';

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercentage: number;
  maxConnections: number;
  maxRequestsPerMinute: number;
  maxFileHandles: number;
}

export interface ConnectionPoolConfig {
  database: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
    propagateCreateError: boolean;
  };
  redis: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
    evictionRunIntervalMillis: number;
    enableOfflineQueue: boolean;
    maxRetriesPerRequest: number;
    retryStrategy: {
      times: number;
      interval: number;
    };
  };
}

export interface MemoryConfig {
  heapSnapshotInterval: number;
  gcInterval: number;
  memoryCheckInterval: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  maxHeapUsagePercent: number;
  enableMemoryProfiling: boolean;
  enableLeakDetection: boolean;
  leakDetectionInterval: number;
  cacheEvictionThreshold: number;
}

export interface MonitoringConfig {
  metricsInterval: number;
  healthCheckInterval: number;
  resourceReportInterval: number;
  performanceProfileInterval: number;
  alertThresholds: {
    memory: number;
    cpu: number;
    connections: number;
    responseTime: number;
    errorRate: number;
  };
}

export interface CleanupPolicy {
  tempFileMaxAge: number;
  cacheMaxAge: number;
  logMaxAge: number;
  sessionMaxAge: number;
  orphanedConnectionTimeout: number;
  staleDataCheckInterval: number;
}

export interface ResourceConfig {
  limits: ResourceLimits;
  connectionPools: ConnectionPoolConfig;
  memory: MemoryConfig;
  monitoring: MonitoringConfig;
  cleanup: CleanupPolicy;
}

// Default configuration
export const defaultResourceConfig: ResourceConfig = {
  limits: {
    maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '2048'),
    maxCpuPercentage: parseInt(process.env.MAX_CPU_PERCENT || '80'),
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100'),
    maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '1000'),
    maxFileHandles: parseInt(process.env.MAX_FILE_HANDLES || '1024')
  },
  connectionPools: {
    database: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
      createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '30000'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '10000'),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000'),
      createRetryIntervalMillis: parseInt(process.env.DB_RETRY_INTERVAL || '200'),
      propagateCreateError: process.env.DB_PROPAGATE_ERRORS === 'true'
    },
    redis: {
      min: parseInt(process.env.REDIS_POOL_MIN || '1'),
      max: parseInt(process.env.REDIS_POOL_MAX || '10'),
      acquireTimeoutMillis: parseInt(process.env.REDIS_ACQUIRE_TIMEOUT || '30000'),
      idleTimeoutMillis: parseInt(process.env.REDIS_IDLE_TIMEOUT || '30000'),
      evictionRunIntervalMillis: parseInt(process.env.REDIS_EVICTION_INTERVAL || '10000'),
      enableOfflineQueue: process.env.REDIS_ENABLE_OFFLINE_QUEUE !== 'false',
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryStrategy: {
        times: parseInt(process.env.REDIS_RETRY_TIMES || '5'),
        interval: parseInt(process.env.REDIS_RETRY_INTERVAL || '100')
      }
    }
  },
  memory: {
    heapSnapshotInterval: parseInt(process.env.HEAP_SNAPSHOT_INTERVAL || '3600000'), // 1 hour
    gcInterval: parseInt(process.env.GC_INTERVAL || '300000'), // 5 minutes
    memoryCheckInterval: parseInt(process.env.MEMORY_CHECK_INTERVAL || '30000'), // 30 seconds
    warningThresholdPercent: parseInt(process.env.MEMORY_WARNING_THRESHOLD || '70'),
    criticalThresholdPercent: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD || '85'),
    maxHeapUsagePercent: parseInt(process.env.MAX_HEAP_USAGE || '90'),
    enableMemoryProfiling: process.env.ENABLE_MEMORY_PROFILING === 'true',
    enableLeakDetection: process.env.ENABLE_LEAK_DETECTION === 'true',
    leakDetectionInterval: parseInt(process.env.LEAK_DETECTION_INTERVAL || '600000'), // 10 minutes
    cacheEvictionThreshold: parseInt(process.env.CACHE_EVICTION_THRESHOLD || '80')
  },
  monitoring: {
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000'), // 1 minute
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'), // 30 seconds
    resourceReportInterval: parseInt(process.env.RESOURCE_REPORT_INTERVAL || '300000'), // 5 minutes
    performanceProfileInterval: parseInt(process.env.PERFORMANCE_PROFILE_INTERVAL || '600000'), // 10 minutes
    alertThresholds: {
      memory: parseInt(process.env.ALERT_MEMORY_THRESHOLD || '80'),
      cpu: parseInt(process.env.ALERT_CPU_THRESHOLD || '75'),
      connections: parseInt(process.env.ALERT_CONNECTION_THRESHOLD || '90'),
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME || '5000'), // ms
      errorRate: parseInt(process.env.ALERT_ERROR_RATE || '5') // percentage
    }
  },
  cleanup: {
    tempFileMaxAge: parseInt(process.env.TEMP_FILE_MAX_AGE || '86400000'), // 24 hours
    cacheMaxAge: parseInt(process.env.CACHE_MAX_AGE || '3600000'), // 1 hour
    logMaxAge: parseInt(process.env.LOG_MAX_AGE || '604800000'), // 7 days
    sessionMaxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 hours
    orphanedConnectionTimeout: parseInt(process.env.ORPHANED_CONNECTION_TIMEOUT || '300000'), // 5 minutes
    staleDataCheckInterval: parseInt(process.env.STALE_DATA_CHECK_INTERVAL || '3600000') // 1 hour
  }
};

// Environment-specific overrides
export function getResourceConfig(): ResourceConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...defaultResourceConfig,
        limits: {
          ...defaultResourceConfig.limits,
          maxMemoryMB: 4096,
          maxCpuPercentage: 90,
          maxConnections: 200
        },
        connectionPools: {
          ...defaultResourceConfig.connectionPools,
          database: {
            ...defaultResourceConfig.connectionPools.database,
            min: 5,
            max: 20
          }
        }
      };
    
    case 'test':
      return {
        ...defaultResourceConfig,
        limits: {
          ...defaultResourceConfig.limits,
          maxMemoryMB: 512,
          maxConnections: 10
        },
        connectionPools: {
          ...defaultResourceConfig.connectionPools,
          database: {
            ...defaultResourceConfig.connectionPools.database,
            min: 1,
            max: 5
          }
        },
        memory: {
          ...defaultResourceConfig.memory,
          memoryCheckInterval: 5000,
          enableMemoryProfiling: false,
          enableLeakDetection: false
        }
      };
    
    default:
      return defaultResourceConfig;
  }
}