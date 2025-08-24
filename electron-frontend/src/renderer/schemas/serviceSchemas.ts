/**
 * Zod validation schemas for service monitoring and configuration
 * Ensures service data integrity and configuration validity
 */

import { z } from 'zod';

/**
 * Service health status enum
 */
export const ServiceStatusEnum = z.enum(['online', 'offline', 'warning', 'unknown']);

/**
 * Service configuration schema
 */
export const serviceConfigSchema = z.object({
  id: z.string().min(1, 'Service ID is required'),
  name: z.string().min(1, 'Service name is required').max(100),
  description: z.string().max(500).optional(),
  port: z.number().int().min(1).max(65535, 'Port must be between 1 and 65535'),
  host: z.string().default('localhost'),
  protocol: z.enum(['http', 'https', 'ws', 'wss']).default('http'),
  timeout: z.number().positive().max(60000, 'Timeout cannot exceed 60 seconds').default(5000),
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().positive().max(10000).default(1000),
  healthCheckEndpoint: z.string().optional(),
  authRequired: z.boolean().default(false),
  authToken: z.string().optional(),
});

/**
 * Service health check result schema
 */
export const serviceHealthSchema = z.object({
  serviceId: z.string(),
  status: ServiceStatusEnum,
  responseTime: z.number().nonnegative(),
  lastChecked: z.date(),
  uptime: z.number().min(0).max(100),
  errorCount: z.number().nonnegative().default(0),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Service metrics schema
 */
export const serviceMetricsSchema = z.object({
  serviceId: z.string(),
  timestamp: z.date(),
  cpu: z.number().min(0).max(100).optional(),
  memory: z.number().min(0).max(100).optional(),
  requestsPerSecond: z.number().nonnegative().optional(),
  averageResponseTime: z.number().nonnegative().optional(),
  errorRate: z.number().min(0).max(100).optional(),
  activeConnections: z.number().nonnegative().optional(),
});

/**
 * Service action schema (start, stop, restart)
 */
export const serviceActionSchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  action: z.enum(['start', 'stop', 'restart', 'reload']),
  force: z.boolean().default(false),
  reason: z.string().max(500).optional(),
  scheduledAt: z.date().optional(),
});

/**
 * Service log entry schema
 */
export const serviceLogSchema = z.object({
  serviceId: z.string(),
  timestamp: z.date(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  message: z.string().max(10000),
  source: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Service dependency schema
 */
export const serviceDependencySchema = z.object({
  serviceId: z.string(),
  dependsOn: z.array(z.string()),
  optional: z.array(z.string()).optional(),
  startOrder: z.number().int().positive().optional(),
});

/**
 * Batch service update schema
 */
export const batchServiceUpdateSchema = z.object({
  services: z.array(serviceConfigSchema).min(1).max(50),
  updateStrategy: z.enum(['parallel', 'sequential', 'rolling']).default('sequential'),
  rollbackOnFailure: z.boolean().default(true),
});

/**
 * Service alert configuration schema
 */
export const serviceAlertSchema = z.object({
  serviceId: z.string(),
  alertType: z.enum(['health', 'performance', 'error', 'custom']),
  threshold: z.number().optional(),
  condition: z.enum(['above', 'below', 'equals', 'contains']).optional(),
  message: z.string().max(1000),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  cooldownPeriod: z.number().positive().max(3600000).default(300000), // 5 minutes default
  enabled: z.boolean().default(true),
});

/**
 * Service endpoint configuration schema
 */
export const serviceEndpointSchema = z.object({
  path: z.string().regex(/^\//, 'Path must start with /'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  description: z.string().max(500).optional(),
  requiresAuth: z.boolean().default(false),
  rateLimit: z.number().positive().optional(),
  timeout: z.number().positive().max(60000).optional(),
  deprecated: z.boolean().default(false),
});

/**
 * Helper function to validate service configuration
 */
export function validateServiceConfig(config: unknown): {
  success: boolean;
  data?: z.infer<typeof serviceConfigSchema>;
  error?: string;
} {
  try {
    const validated = serviceConfigSchema.parse(config);
    return { success: true, data: validated };
  } catch (_error) {
    if (_error instanceof z.ZodError) {
      return {
        success: false,
        _error: _error.errors.map(_e => `${_e.path.join('.')}: ${_e.message}`).join(', '),
      };
    }
    return { success: false, _error: 'Invalid service configuration' };
  }
}

/**
 * Helper function to validate service health data
 */
export function validateHealthCheck(data: unknown): z.infer<typeof serviceHealthSchema> | null {
  try {
    return serviceHealthSchema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Helper function to create safe service URL
 */
export function createServiceUrl(
  config: z.infer<typeof serviceConfigSchema>,
  endpoint?: string
): string {
  const { protocol, host, port } = config;
  const baseUrl = `${protocol}://${host}:${port}`;

  if (endpoint) {
    // Ensure endpoint starts with /
    const safePath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${safePath}`;
  }

  return baseUrl;
}

/**
 * Helper function to validate port number
 */
export function isValidPort(port: unknown): boolean {
  if (typeof port !== 'number') return false;
  return port >= 1 && port <= 65535 && Number.isInteger(port);
}

// Export all schemas and helpers
export default {
  ServiceStatusEnum,
  serviceConfigSchema,
  serviceHealthSchema,
  serviceMetricsSchema,
  serviceActionSchema,
  serviceLogSchema,
  serviceDependencySchema,
  batchServiceUpdateSchema,
  serviceAlertSchema,
  serviceEndpointSchema,
  validateServiceConfig,
  validateHealthCheck,
  createServiceUrl,
  isValidPort,
};
