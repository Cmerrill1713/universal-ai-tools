import { z } from 'zod';
export const baseIdSchema = z.string().min(1).max(255).regex(/^[a-zA-Z0-9_-]+$/);
export const userIdSchema = z.string().uuid();
export const apiKeySchema = z.string().min(32).max(512);
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
export const fileUploadSchema = z.object({
    filename: z.string().min(1).max(255).describe('Original filename'),
    mimeType: z.string().min(1).max(100).describe('MIME type'),
    size: z.number().int().min(1).max(100 * 1024 * 1024).describe('File size in bytes'),
    purpose: z.enum(['training', 'inference', 'storage']).describe('File purpose')
});
export const parameterOptimizationSchema = z.object({
    modelId: baseIdSchema.describe('Model to optimize'),
    parameters: z.record(z.number()).describe('Parameters to optimize'),
    objective: z.enum(['accuracy', 'speed', 'memory', 'balanced']).describe('Optimization objective'),
    constraints: z.record(z.any()).optional().describe('Optimization constraints'),
    maxIterations: z.number().int().min(1).max(1000).default(100)
});
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
export function validateRequestBody(schema) {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse(req.body);
            req.validatedData = validatedData;
            next();
        }
        catch (error) {
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
export function validateQueryParams(schema) {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse(req.query);
            req.validatedQuery = validatedData;
            next();
        }
        catch (error) {
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
export function sanitizeString(input, maxLength = 1000) {
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '');
}
export function validateIPAddress(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
}
export const rateLimitConfigSchema = z.object({
    windowMs: z.number().int().min(1000).max(3600000).describe('Time window in milliseconds'),
    maxRequests: z.number().int().min(1).max(10000).describe('Max requests per window'),
    skipSuccessfulRequests: z.boolean().default(false),
    skipFailedRequests: z.boolean().default(false)
});
//# sourceMappingURL=validation-schemas.js.map