import { z } from 'zod';

// Sanitize HTML to prevent XSS
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Chat message validation
export const chatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message is too long')
    .transform(sanitizeHtml),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  includeContext: z.boolean().optional(),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

// User preferences validation
export const userPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  animationsEnabled: z.boolean(),
  soundEnabled: z.boolean(),
  defaultModel: z.string().min(1),
  fontSize: z.enum(['small', 'medium', 'large']),
  compactMode: z.boolean(),
  autoSave: z.boolean(),
  language: z.string().length(2), // ISO 639-1
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;

// API response validation
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  _error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
      details: z.any().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type ApiResponse = z.infer<typeof apiResponseSchema>;

// File upload validation
export const fileUploadSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[^<>:"/\\|?*]+$/, 'Invalid filename'),
  size: z
    .number()
    .positive()
    .max(100 * 1024 * 1024, 'File size must be less than 100MB'),
  type: z.string().regex(/^[a-zA-Z0-9]+\/[a-zA-Z0-9\-+.]+$/, 'Invalid MIME type'),
  content: z.instanceof(ArrayBuffer).or(z.instanceof(Blob)).optional(),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

// Search query validation
export const searchQuerySchema = z
  .string()
  .max(200, 'Search query is too long')
  .transform(val => val.trim())
  .transform(sanitizeHtml);

// Agent configuration validation
export const agentConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  capabilities: z.array(z.string()).min(1),
  status: z.enum(['online', 'offline', 'busy']),
  description: z.string().max(500).optional(),
  config: z.record(z.string(), z.any()).optional(),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

// WebSocket message validation
export const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chat'),
    message: z.string().transform(sanitizeHtml),
    model: z.string().optional(),
  }),
  z.object({
    type: z.literal('chunk'),
    content: z.string(),
    index: z.number().optional(),
  }),
  z.object({
    type: z.literal('complete'),
    total: z.number().optional(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal('ping'),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('pong'),
    timestamp: z.number(),
  }),
]);

export type WsMessage = z.infer<typeof wsMessageSchema>;

// Settings form validation
export const settingsFormSchema = z.object({
  apiEndpoint: z.string().url('Invalid URL'),
  apiKey: z.string().min(1, 'API key is required').optional(),
  maxRetries: z.number().int().min(0).max(10),
  timeout: z.number().int().min(1000).max(60000),
  enableTelemetry: z.boolean(),
  debugMode: z.boolean(),
});

export type SettingsFormInput = z.infer<typeof settingsFormSchema>;

// Validation helpers
export const validateInput = <T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } => {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
};

// Rate limiting helper
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();

  constructor(
    private maxAttempts: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const recentAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);

    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);

    // Clean up old entries
    if (this.attempts.size > 100) {
      const oldestAllowed = now - this.windowMs;
      for (const [k, v] of this.attempts.entries()) {
        if (v.every(t => t < oldestAllowed)) {
          this.attempts.delete(k);
        }
      }
    }

    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Create rate limiters for different operations
export const chatRateLimiter = new RateLimiter(30, 60000); // 30 messages per minute
export const apiRateLimiter = new RateLimiter(100, 60000); // 100 API calls per minute
export const fileUploadRateLimiter = new RateLimiter(10, 300000); // 10 uploads per 5 minutes
