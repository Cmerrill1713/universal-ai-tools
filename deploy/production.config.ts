/**
 * Production Deployment Configuration
 * Settings for deploying device authentication services in production
 */

export const productionConfig = {
  // Server Configuration
  server: {
    port: process.env.PORT || 443,
    host: process.env.HOST || '0.0.0.0',
    protocol: 'https',
    trustProxy: true,
    gracefulShutdownTimeout: 30000 // 30 seconds
  },

  // SSL/TLS Configuration
  ssl: {
    enabled: true,
    certPath: '/etc/ssl/certs/universal-ai-tools.crt',
    keyPath: '/etc/ssl/private/universal-ai-tools.key',
    caPath: '/etc/ssl/certs/ca-bundle.crt',
    dhParamPath: '/etc/ssl/dhparam.pem',
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES128-SHA256',
      'ECDHE-RSA-AES256-SHA384'
    ].join(':'),
    honorCipherOrder: true,
    secureOptions: 'SSLv2_method' // Disable SSLv2
  },

  // WebSocket Configuration
  websocket: {
    path: '/ws/device-auth',
    pingInterval: 30000, // 30 seconds
    pingTimeout: 10000, // 10 seconds
    maxConnections: 10000,
    perMessageDeflate: {
      threshold: 1024 // Compress messages larger than 1KB
    }
  },

  // Database Configuration
  database: {
    connectionPool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    },
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_CA_CERT
    }
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    connectTimeout: 10000,
    tls: process.env.REDIS_TLS === 'true' ? {
      rejectUnauthorized: true
    } : undefined
  },

  // Rate Limiting
  rateLimiting: {
    // Global limits
    global: {
      windowMs: 60 * 1000, // 1 minute
      max: 100 // requests per window
    },
    // Endpoint-specific limits
    endpoints: {
      register: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5
      },
      challenge: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 20
      },
      verify: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 10
      }
    }
  },

  // Security Headers
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'https:'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://universal-ai-tools.com'],
      credentials: true,
      maxAge: 86400 // 24 hours
    }
  },

  // Monitoring and Logging
  monitoring: {
    // Prometheus metrics
    metrics: {
      enabled: true,
      port: 9090,
      path: '/metrics',
      includeDefault: true,
      includeNodeMetrics: true
    },
    // Health checks
    health: {
      enabled: true,
      path: '/health',
      checks: {
        database: true,
        redis: true,
        websocket: true
      }
    },
    // Logging
    logging: {
      level: 'info',
      format: 'json',
      outputs: ['stdout', 'file'],
      file: {
        path: '/var/log/universal-ai-tools/device-auth.log',
        maxSize: '100m',
        maxFiles: 10,
        compress: true
      }
    }
  },

  // Auto-scaling Configuration
  scaling: {
    // Process clustering
    cluster: {
      enabled: true,
      workers: process.env.CLUSTER_WORKERS || 'auto', // 'auto' uses CPU count
      restartDelay: 5000
    },
    // Memory limits
    memory: {
      maxHeapSize: '2048m',
      maxOldSpaceSize: '1536m'
    }
  },

  // Backup and Recovery
  backup: {
    // Database backups
    database: {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: 30 // days
    },
    // Audit log archival
    auditLogs: {
      enabled: true,
      schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
      retention: 90, // days
      compression: 'gzip'
    }
  },

  // Feature Flags
  features: {
    deviceAuthentication: true,
    proximityUnlock: true,
    biometricAuth: true,
    multiDeviceSync: true,
    auditLogging: true,
    rateLimiting: true
  },

  // Environment-specific settings
  environments: {
    production: {
      debug: false,
      logLevel: 'info',
      errorReporting: true,
      performanceMonitoring: true
    },
    staging: {
      debug: true,
      logLevel: 'debug',
      errorReporting: true,
      performanceMonitoring: true
    }
  }
};

// Deployment checklist
export const deploymentChecklist = [
  'SSL certificates installed and valid',
  'Database migrations completed',
  'Redis connection established',
  'Environment variables configured',
  'Firewall rules configured',
  'Load balancer health checks passing',
  'Monitoring alerts configured',
  'Backup procedures tested',
  'Security scan completed',
  'Performance benchmarks met'
];

// Required environment variables
export const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET',
  'SSL_CERT_PATH',
  'SSL_KEY_PATH',
  'ALLOWED_ORIGINS'
];

// Health check endpoints
export const healthCheckEndpoints = {
  liveness: '/health/live',
  readiness: '/health/ready',
  startup: '/health/startup'
};