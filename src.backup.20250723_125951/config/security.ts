import { config } from '../config';

export interface SecurityPolicy {
  name: string;
  enabled: boolean;
  rules: SecurityRule[];
}

export interface SecurityRule {
  type: 'allow' | 'deny';
  _pattern: string;
  conditions?: RuleCondition[];
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'greater_than' | 'less_than';
  value: any;
}

export interface RateLimitRule {
  endpoint: string;
  method?: string;
  limit: number;
  window: number; // in milliseconds
  skipIf?: (req: any => boolean;
}

export interface ApiKeyRotationConfig {
  keyType: string;
  rotationInterval: number; // in days
  notificationDays: number; // days before expiry to notify
  autoRotate: boolean;
}

export const securityConfig = {
  // General security settings
  general: {
    enableSecurityHeaders: true,
    enableRateLimiting: true,
    enableInputValidation: true,
    enableCSRFProtection: true,
    enableAuditLogging: true,
    enableIPFiltering: config.server.isProduction,
    enableAPIKeyRotation: true,
    enableVulnerabilityScanning: true,
  },

  // Environment-aware CORS configuration
  cors: {
    // Always use explicitly configured origins for security
    // In development, add localhost origins to CORS_ORIGINS environment variable
    origins: config.security.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-CSRF-Token',
      'X-Session-ID',
      'X-Request-ID',
      'X-AI-Service',
      'Accept',
      'Accept-Language',
      'Content-Language',
      'Origin',
      'Referer',
      'User-Agent',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Response-Time',
      'X-Request-ID',
      'X-API-Version',
      'X-Cache-Status',
    ],
    maxAge: config.server.isProduction ? 86400 : 300, // 24 hours in prod, 5 minutes in dev
    preflightContinue: false,
    optionsSuccessStatus: 200,
  },

  // Rate limiting configuration
  rateLimiting: {
    // Global rate limits
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
    },

    // Per-endpoint rate limits
    endpoints: [
      {
        endpoint: '/api/v1/tools/execute',
        method: 'POST',
        limit: 20,
        window: 60000, // 1 minute
      },
      {
        endpoint: '/api/v1/memory/search',
        method: 'POST',
        limit: 30,
        window: 60000,
      },
      {
        endpoint: '/api/v1/orchestration/orchestrate',
        method: 'POST',
        limit: 10,
        window: 60000,
      },
      {
        endpoint: '/api/register',
        method: 'POST',
        limit: 5,
        window: 3600000, // 1 hour
      },
      {
        endpoint: '/api/assistant/chat',
        method: 'POST',
        limit: 50,
        window: 60000,
      },
      {
        endpoint: '/api/v1/speech/synthesize',
        method: 'POST',
        limit: 10,
        window: 60000,
      },
    ] as RateLimitRule[],

    // Skip rate limiting for these IPs
    whitelist: [
      '127.0.0.1',
      '::1', // IPv6 localhost
    ],
  },

  // IP filtering configuration
  ipFiltering: {
    enabled: config.server.isProduction,
    mode: 'blacklist' as 'whitelist' | 'blacklist',
    whitelist: [] as string[],
    blacklist: [] as string[],
    // Geo-blocking (requires external: service
    geoBlocking: {
      enabled: false,
      allowedCountries: [],
      blockedCountries: [],
    },
  },

  // API key rotation configuration
  apiKeyRotation: {
    configs: [
      {
        keyType: 'jwt_secret',
        rotationInterval: 90,
        notificationDays: 7,
        autoRotate: false,
      },
      {
        keyType: 'encryption_key',
        rotationInterval: 180,
        notificationDays: 14,
        autoRotate: false,
      },
      {
        keyType: 'api_keys',
        rotationInterval: 30,
        notificationDays: 5,
        autoRotate: true,
      },
      {
        keyType: 'service_keys',
        rotationInterval: 60,
        notificationDays: 7,
        autoRotate: true,
      },
    ] as ApiKeyRotationConfig[],
  },

  // Security policies
  policies: [
    {
      name: 'sql_injection_prevention',
      enabled: true,
      rules: [
        {
          type: 'deny',
          _pattern
            '(union|select|insert|update|delete|drop|create|alter|exec|script|javascript|vbscript|onload|onerror: onclick',
          conditions: [
            {
              field: 'content.type',
              operator: 'contains',
              value: 'application/x-www-form-urlencoded',
            },
          ],
        },
      ],
    },
    {
      name: 'xss_prevention',
      enabled: true,
      rules: [
        {
          type: 'deny',
          _pattern '<(script|iframe|object|embed|form|_inputlink|meta|base)',
          conditions: [],
        },
      ],
    },
    {
      name: 'path_traversal_prevention',
      enabled: true,
      rules: [
        {
          type: 'deny',
          _pattern '\\.\\./|\\.\\\\',
          conditions: [],
        },
      ],
    },
  ] as SecurityPolicy[],

  // Request size limits
  requestLimits: {
    json: '10mb',
    urlencoded: '10mb',
    raw: '10mb',
    text: '1mb',
    fileUpload: '50mb',
  },

  // Session configuration
  session: {
    secret: config.security.jwtSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: config.server.isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict' as const,
    },
  },

  // Logging configuration
  logging: {
    // Log all authentication attempts
    logAuthAttempts: true,
    // Log all authorization failures
    logAuthFailures: true,
    // Log all rate limit violations
    logRateLimitViolations: true,
    // Log all_inputvalidation failures
    logValidationFailures: true,
    // Log all security header violations
    logSecurityViolations: true,
    // Retention period in days
    retentionDays: 90,
  },

  // Vulnerability scanning configuration
  vulnerabilityScanning: {
    // Run on startup
    scanOnStartup: true,
    // Scheduled scanning (cron: format
    scheduledScan: '0 0 * * 0', // Weekly on Sunday at midnight
    // Auto-fix vulnerabilities
    autoFix: false,
    // Severity levels to alert on
    alertSeverity: ['critical', 'high'],
    // Email notifications
    emailNotifications: config.server.isProduction,
    notificationEmails: [],
  },

  // Environment-aware Content Security Policy
  csp: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        // Production: Use strict CSP with nonces/hashes only
        // Development: Allow unsafe for easier development
        ...(config.server.isProduction
          ? [
              // Add specific script hashes here as needed
              // "'sha256-SPECIFIC_HASH_OF_TRUSTED_SCRIPT'"
            ]
          : [
              "'unsafe-inline'", // Development only
              "'unsafe-eval'", // Development only - for hot reloading
            ]),
      ],
      styleSrc: [
        "'self'",
        // Production: Use strict CSP with nonces/hashes only
        // Development: Allow unsafe for easier development
        ...(config.server.isProduction
          ? [
              // Add specific style hashes here as needed
              // "'sha256-SPECIFIC_HASH_OF_TRUSTED_STYLE'"
            ]
          : [
              "'unsafe-inline'", // Development only
            ]),
        // Always allow trusted font CDNs
        'https://fonts.googleapis.com',
      ],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com'],
      connectSrc: [
        "'self'",
        // Always allowed API endpoints
        'https://api.openai.com',
        'https://api.anthropic.com',
        'https://api.groq.com',
        'https://generativelanguage.googleapis.com',
        'https://*.supabase.co',
        'wss://*.supabase.co',
        // Development only endpoints
        ...(config.server.isProduction
          ? []
          : ['ws://localhost:*', 'http://localhost:*', 'ws://127.0.0.1:*', 'http://127.0.0.1:*']),
      ],
      mediaSrc: ["'self'", 'blob:', 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      workerSrc: ["'self'", 'blob:'],
      childSrc: ["'self'", 'blob:'],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: config.server.isProduction ? [] : undefined,
    },
    reportOnly: false, // Always enforce CSP
    reportUri: config.server.isProduction ? '/api/csp-report' : undefined,
  },

  // HSTS configuration
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },

  // Production-ready security headers
  headers: {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',
    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Restrict browser features
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'browsing-topics=()',
      'sync-xhr=()',
      'payment=()',
      'usb=()',
      'serial=()',
      'bluetooth=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
    ].join(', '),
    // Disable DNS prefetching
    'X-DNS-Prefetch-Control': 'off',
    // Prevent IE from opening files directly
    'X-Download-Options': 'noopen',
    // Disable Adobe Flash cross-domain policies
    'X-Permitted-Cross-Domain-Policies': 'none',
    // Disable server identification
    Server: 'Universal-AI-Tools',
    // Control caching in production
    ...(config.server.isProduction && {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    }),
  },
};

// Helper function to get rate limit for endpoint
export function getRateLimitForEndpoint(
  endpoint: string,
  method: string
): RateLimitRule | undefined {
  return securityConfig.rateLimiting.endpoints.find(
    (rule) => rule.endpoint === endpoint && (!rule.method || rule.method === method)
  );
}

// Helper function to check if IP is whitelisted
export function isIPWhitelisted(ip: string): boolean {
  return (;
    securityConfig.rateLimiting.whitelist.includes(ip) ||
    securityConfig.ipFiltering.whitelist.includes(ip)
  );
}

// Helper function to check if IP is blacklisted
export function isIPBlacklisted(ip: string): boolean {
  return securityConfig.ipFiltering.blacklist.includes(ip);
}

// Helper function to get API key rotation config
export function getAPIKeyRotationConfig(keyType: string: ApiKeyRotationConfig | undefined {
  return securityConfig.apiKeyRotation.configs.find((config) => config.keyType === keyType);
}
