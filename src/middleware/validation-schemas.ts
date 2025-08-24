/**
 * Comprehensive validation schemas using Zod
 * Centralizes all input validation for the API
 */

import { z } from 'zod';

// ============================================================================
// Base Schemas
// ============================================================================

export const baseIdSchema = z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/);
export const userIdSchema = z.string().uuid();
export const apiKeySchema = z.string().min(32).max(512);

// ============================================================================
// FlashAttention Schemas
// ============================================================================

export const flashAttentionOptimizeSchema = z.object({
  modelId: baseIdSchema.describe('Model identifier'),
  providerId: baseIdSchema.describe('Provider identifier'),
  inputTokens: z.array(z.number().int().min(0).max(100000))
    .min(1)
    .max(10000)
    .describe('Array of input token IDs'),
  attentionMask: z.array(z.number().int().min(0).max(1))
    .optional()
    .describe('Optional attention mask'),
  sequenceLength: z.number().int().min(1).max(32768)
    .describe('Sequence length'),
  batchSize: z.number().int().min(1).max(32)
    .default(1)
    .describe('Batch size'),
  useCache: z.boolean()
    .default(true)
    .describe('Whether to use caching'),
  optimizationLevel: z.enum(['low', 'medium', 'high', 'aggressive'])
    .default('medium')
    .describe('Optimization level')
});

export const flashAttentionConfigSchema = z.object({
  enableGPU: z.coerce.boolean().optional(),
  enableCPU: z.coerce.boolean().optional(),
  batchSize: z.coerce.number().int().min(1).max(32).optional(),
  blockSize: z.coerce.number().int().min(1).max(512).optional(),
  enableMemoryOptimization: z.coerce.boolean().optional(),
  enableKernelFusion: z.coerce.boolean().optional(),
  fallbackToStandard: z.coerce.boolean().optional(),
  maxMemoryMB: z.coerce.number().int().min(1).max(65536).optional()
});

// ============================================================================
// Chat and Message Schemas
// ============================================================================

export const messageSchema = z.object({
  content: z.string().min(1).max(50000).describe('Message content'),
  role: z.enum(['user', 'assistant', 'system']).describe('Message role'),
  metadata: z.record(z.string()).optional().describe('Optional metadata')
});

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(50000).describe('Chat message'),
  chatId: z.string().uuid().optional().describe('Optional chat ID'),
  model: baseIdSchema.optional().describe('Model to use'),
  temperature: z.number().min(0).max(2).optional().describe('Temperature setting'),
  maxTokens: z.number().int().min(1).max(100000).optional().describe('Max tokens'),
  stream: z.boolean().default(false).describe('Whether to stream response')
});

// Enhanced chat request schema with code context support
export const enhancedChatRequestSchema = z.object({
  message: z.string().min(1).max(50000).describe('Chat message'),
  conversationId: z.string().uuid().optional().describe('Optional conversation ID'),
  agentName: z.string().optional().describe('Agent to use'),
  context: z.record(z.any()).optional().describe('Optional context'),
  includeCodeContext: z.boolean().default(false).describe('Include code context from workspace'),
  codeContextOptions: z.object({
    workspacePath: z.string().optional().describe('Path to workspace/project directory'),
    maxFiles: z.number().int().min(1).max(50).default(10).describe('Maximum number of files to include'),
    maxTokensForCode: z.number().int().min(1000).max(20000).default(10000).describe('Maximum tokens to use for code context')
  }).optional().describe('Code context configuration')
});

// ============================================================================
// Agent Schemas
// ============================================================================

export const agentRequestSchema = z.object({
  agentId: baseIdSchema.describe('Agent identifier'),
  instruction: z.string().min(1).max(10000).describe('Instruction for agent'),
  context: z.record(z.any()).optional().describe('Optional context'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  timeout: z.number().int().min(1000).max(300000).optional().describe('Timeout in ms')
});

export const agentConfigSchema = z.object({
  name: z.string().min(1).max(255).describe('Agent name'),
  type: z.string().min(1).max(100).describe('Agent type'),
  description: z.string().max(1000).optional().describe('Agent description'),
  capabilities: z.array(z.string()).describe('Agent capabilities'),
  config: z.record(z.any()).optional().describe('Agent configuration')
});

// ============================================================================
// Authentication Schemas
// ============================================================================

export const loginSchema = z.object({
  username: z.string().min(3).max(255).describe('Username'),
  password: z.string().min(8).max(255).describe('Password'),
  deviceId: z.string().optional().describe('Device identifier')
});

export const apiKeyRequestSchema = z.object({
  name: z.string().min(1).max(255).describe('API key name'),
  permissions: z.array(z.string()).describe('Permissions for the key'),
  expiresAt: z.string().datetime().optional().describe('Expiration date')
});

// ============================================================================
// System and Monitoring Schemas
// ============================================================================

export const systemMetricsQuerySchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  metric: z.enum(['cpu', 'memory', 'requests', 'errors']).optional(),
  interval: z.enum(['1m', '5m', '15m', '1h', '24h']).default('5m')
});

export const logQuerySchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  service: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).default(100)
});

// ============================================================================
// File Upload Schemas
// ============================================================================

export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255).describe('Original filename'),
  mimeType: z.string().min(1).max(100).describe('MIME type'),
  size: z.number().int().min(1).max(100 * 1024 * 1024).describe('File size in bytes'),
  purpose: z.enum(['training', 'inference', 'storage']).describe('File purpose')
});

// ============================================================================
// Parameter Optimization Schemas
// ============================================================================

export const parameterOptimizationSchema = z.object({
  modelId: baseIdSchema.describe('Model to optimize'),
  parameters: z.record(z.number()).describe('Parameters to optimize'),
  objective: z.enum(['accuracy', 'speed', 'memory', 'balanced']).describe('Optimization objective'),
  constraints: z.record(z.any()).optional().describe('Optimization constraints'),
  maxIterations: z.number().int().min(1).max(1000).default(100)
});

// ============================================================================
// Pagination and Common Schemas
// ============================================================================

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const searchSchema = z.object({
  query: z.string().min(1).max(500).describe('Search query'),
  filters: z.record(z.any()).optional().describe('Search filters'),
  ...paginationSchema.shape
});

// ============================================================================
// Workflow Management Schemas
// ============================================================================

export const workflowStepConfigSchema = z.object({
  instruction: z.string().optional(),
  url: z.string().url().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  condition: z.string().optional(),
  delayMs: z.number().int().min(0).max(3600000).optional(), // Max 1 hour
  retryAttempts: z.number().int().min(0).max(10).optional(),
  timeout: z.number().int().min(1000).max(300000).optional(), // 1s to 5min
  onSuccess: z.array(z.string()).optional(),
  onFailure: z.array(z.string()).optional()
}).passthrough();

export const workflowStepSchema = z.object({
  id: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  type: z.enum(['agent_task', 'http_request', 'condition', 'delay', 'parallel', 'sequential', 'loop', 'webhook']),
  agentId: z.string().optional(),
  config: workflowStepConfigSchema,
  dependencies: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional()
});

export const workflowParameterSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().default(false),
  defaultValue: z.any().optional(),
  description: z.string().max(1000).optional()
});

export const workflowTriggerSchema = z.object({
  type: z.enum(['manual', 'scheduled', 'webhook', 'event']),
  config: z.record(z.any()).default({})
});

export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().min(0).max(10).default(3),
  backoffStrategy: z.enum(['fixed', 'exponential', 'linear']).default('exponential'),
  delayMs: z.number().int().min(100).max(60000).default(1000)
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(''),
  version: z.string().min(1).max(50).default('1.0.0'),
  steps: z.array(workflowStepSchema).min(1).max(100),
  parameters: z.array(workflowParameterSchema).default([]),
  triggers: z.array(workflowTriggerSchema).default([{ type: 'manual', config: {} }]),
  timeout: z.number().int().min(1000).max(86400000).default(3600000), // Default 1 hour
  retryPolicy: retryPolicySchema.default({
    maxAttempts: 3,
    backoffStrategy: 'exponential',
    delayMs: 1000
  }),
  concurrencyLimit: z.number().int().min(1).max(100).default(10),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.any()).optional()
});

export const updateWorkflowSchema = createWorkflowSchema.partial();

export const executeWorkflowSchema = z.object({
  parameters: z.record(z.any()).default({}),
  context: z.record(z.any()).default({}),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  metadata: z.record(z.any()).optional()
});

export const createWorkflowTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).default(''),
  category: z.string().min(1).max(100),
  workflowId: z.string().uuid(),
  isPublic: z.boolean().default(false),
  metadata: z.record(z.any()).optional()
});

export const workflowQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'failed', 'cancelled']).optional(),
  tags: z.string().optional(), // Comma-separated tags
  search: z.string().max(255).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'status']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const workflowExecutionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'failed', 'cancelled']).optional(),
  workflowId: z.string().uuid().optional(),
  sortBy: z.enum(['startTime', 'endTime', 'progress', 'status']).default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateRequestBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse(req.body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: formattedErrors
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Validation system error'
      });
    }
  };
}

export function validateQueryParams<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validatedData = schema.parse(req.query);
      req.validatedQuery = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: formattedErrors
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Validation system error'
      });
    }
  };
}

// ============================================================================
// Security Validation Functions
// ============================================================================

export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML/XML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/data:/gi, ''); // Remove data: protocols
}

export function validateIPAddress(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

// ============================================================================
// Rate Limiting Schemas
// ============================================================================

export const rateLimitConfigSchema = z.object({
  windowMs: z.number().int().min(1000).max(3600000).describe('Time window in milliseconds'),
  maxRequests: z.number().int().min(1).max(10000).describe('Max requests per window'),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false)
});

export type FlashAttentionOptimizeRequest = z.infer<typeof flashAttentionOptimizeSchema>;
export type FlashAttentionConfigRequest = z.infer<typeof flashAttentionConfigSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type EnhancedChatRequest = z.infer<typeof enhancedChatRequestSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type SystemMetricsQuery = z.infer<typeof systemMetricsQuerySchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
// ============================================================================
// Additional Common Schemas for API Standardization
// ============================================================================

// Common path parameter schemas
export const idParamSchema = z.object({
  id: baseIdSchema.describe('Resource identifier')
});

export const uuidParamSchema = z.object({
  id: z.string().uuid().describe('UUID identifier')
});

// Model and provider schemas
export const modelRequestSchema = z.object({
  model: baseIdSchema.describe('Model identifier'),
  provider: baseIdSchema.optional().describe('Provider identifier'),
  temperature: z.number().min(0).max(2).optional().describe('Model temperature'),
  maxTokens: z.number().int().min(1).max(100000).optional().describe('Maximum tokens'),
  stream: z.boolean().default(false).describe('Stream response')
});

// Memory and context schemas
export const memoryStoreSchema = z.object({
  key: z.string().min(1).max(255).describe('Memory key'),
  value: z.any().describe('Memory value'),
  namespace: z.string().min(1).max(100).optional().describe('Memory namespace'),
  ttl: z.number().int().min(1).max(86400).optional().describe('TTL in seconds'),
  metadata: z.record(z.any()).optional().describe('Additional metadata')
});

export const memoryRetrieveSchema = z.object({
  key: z.string().min(1).max(255).describe('Memory key'),
  namespace: z.string().min(1).max(100).optional().describe('Memory namespace')
});

// Monitoring and analytics schemas
export const healthCheckQuerySchema = z.object({
  include: z.array(z.enum(['system', 'models', 'circuits', 'memory', 'services']))
    .optional()
    .describe('Health check components to include'),
  detailed: z.boolean().default(false).describe('Include detailed metrics')
});

export const metricsQuerySchema = z.object({
  metric: z.enum(['requests', 'errors', 'latency', 'memory', 'cpu']).describe('Metric type'),
  timeRange: z.enum(['1h', '6h', '24h', '7d']).default('1h').describe('Time range'),
  aggregation: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg').describe('Aggregation method'),
  groupBy: z.string().optional().describe('Group by field')
});

// Vision and image processing schemas
export const imageUploadSchema = z.object({
  image: z.string().describe('Base64 encoded image or image URL'),
  format: z.enum(['jpeg', 'png', 'webp', 'gif']).optional().describe('Image format'),
  maxWidth: z.number().int().min(1).max(4096).optional().describe('Maximum width'),
  maxHeight: z.number().int().min(1).max(4096).optional().describe('Maximum height'),
  quality: z.number().min(0.1).max(1).default(0.9).describe('Image quality')
});

export const imageAnalysisSchema = z.object({
  ...imageUploadSchema.shape,
  analysisType: z.enum(['description', 'objects', 'text', 'faces', 'general'])
    .describe('Type of analysis to perform'),
  language: z.string().min(2).max(5).default('en').describe('Language for results')
});

// Training and fine-tuning schemas
export const trainingJobSchema = z.object({
  modelId: baseIdSchema.describe('Base model to fine-tune'),
  datasetId: baseIdSchema.describe('Training dataset identifier'),
  trainingConfig: z.object({
    learningRate: z.number().min(0.00001).max(1).default(0.0001),
    batchSize: z.number().int().min(1).max(128).default(8),
    epochs: z.number().int().min(1).max(100).default(3),
    warmupSteps: z.number().int().min(0).max(10000).default(500)
  }).describe('Training configuration'),
  outputModelName: z.string().min(1).max(255).describe('Name for the trained model')
});

// Device and authentication schemas
export const deviceRegistrationSchema = z.object({
  deviceId: z.string().min(1).max(255).describe('Unique device identifier'),
  deviceName: z.string().min(1).max(255).describe('Human-readable device name'),
  deviceType: z.enum(['mobile', 'desktop', 'tablet', 'server', 'other']).describe('Device type'),
  platform: z.string().min(1).max(100).optional().describe('Platform/OS'),
  appVersion: z.string().min(1).max(50).optional().describe('Application version')
});

export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1).describe('Refresh token'),
  deviceId: z.string().min(1).max(255).optional().describe('Device identifier')
});

// Advanced feature schemas
export const proactiveTaskSchema = z.object({
  taskType: z.enum(['reminder', 'analysis', 'optimization', 'backup', 'cleanup'])
    .describe('Type of proactive task'),
  schedule: z.string().regex(/^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|[0]?\d|1[0-2]) (\*|[0-6])$/)
    .optional()
    .describe('Cron expression for scheduling'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  parameters: z.record(z.any()).optional().describe('Task-specific parameters'),
  enabled: z.boolean().default(true).describe('Whether task is enabled')
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).describe('Rating from 1-5'),
  category: z.enum(['accuracy', 'helpfulness', 'speed', 'clarity', 'other']).describe('Feedback category'),
  comment: z.string().max(1000).optional().describe('Additional feedback text'),
  sessionId: z.string().uuid().optional().describe('Session identifier'),
  feature: z.string().min(1).max(100).optional().describe('Feature being rated')
});

// Voice and speech schemas
export const voiceConfigSchema = z.object({
  voice: z.string().min(1).max(100).describe('Voice identifier'),
  speed: z.number().min(0.25).max(4).default(1).describe('Speech speed'),
  pitch: z.number().min(-20).max(20).default(0).describe('Voice pitch'),
  volume: z.number().min(0).max(1).default(0.8).describe('Volume level'),
  language: z.string().min(2).max(5).default('en').describe('Language code')
});

export const speechToTextSchema = z.object({
  audio: z.string().describe('Base64 encoded audio data'),
  format: z.enum(['wav', 'mp3', 'webm', 'ogg']).describe('Audio format'),
  language: z.string().min(2).max(5).default('en').describe('Language code'),
  enablePunctuation: z.boolean().default(true).describe('Enable automatic punctuation'),
  enableTimestamps: z.boolean().default(false).describe('Include word timestamps')
});

// Export additional type definitions
export type IdParam = z.infer<typeof idParamSchema>;
export type UuidParam = z.infer<typeof uuidParamSchema>;
export type ModelRequest = z.infer<typeof modelRequestSchema>;
export type MemoryStore = z.infer<typeof memoryStoreSchema>;
export type MemoryRetrieve = z.infer<typeof memoryRetrieveSchema>;
export type HealthCheckQuery = z.infer<typeof healthCheckQuerySchema>;
export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
export type ImageUpload = z.infer<typeof imageUploadSchema>;
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;
export type TrainingJob = z.infer<typeof trainingJobSchema>;
export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;
export type TokenRefresh = z.infer<typeof tokenRefreshSchema>;
export type ProactiveTask = z.infer<typeof proactiveTaskSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type VoiceConfig = z.infer<typeof voiceConfigSchema>;
export type SpeechToText = z.infer<typeof speechToTextSchema>;
