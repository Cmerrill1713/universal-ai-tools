import { z } from 'zod';

// Common schemas
const UUIDSchema = z.string().uuid();
const DateSchema = z.string().datetime();
const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Memory schemas
export const MemoryStoreSchema = z.object({
  content: z.string().min(1).max(10000),
  metadata: z.record(z.any()).default({}),
  userId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
});

export const MemorySearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(50).default(10),
  filters: z
    .object({
      userId: z.string().uuid().optional(),
      tags: z.array(z.string()).optional(),
      dateFrom: DateSchema.optional(),
      dateTo: DateSchema.optional(),
    })
    .optional(),
});

export const MemoryUpdateSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

// Tool schemas
export const ToolExecuteSchema = z.object({
  toolName: z.string().min(1).max(100),
  input: z.any(),
  context: z
    .object({
      userId: z.string().uuid().optional(),
      sessionId: z.string().uuid().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional(),
  timeout: z.number().int().min(1000).max(300000).default(30000),
});

export const ToolRegisterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().min(1).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  inputSchema: z.record(z.any()),
  outputSchema: z.record(z.any()),
  metadata: z
    .object({
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      documentation: z.string().url().optional(),
    })
    .optional(),
});

// Agent schemas
export const AgentRequestSchema = z.object({
  type: z.enum(['analytical', 'creative', 'critical', 'systems', 'research']),
  task: z.string().min(1).max(5000),
  context: z.record(z.any()).optional(),
  options: z
    .object({
      maxIterations: z.number().int().min(1).max(10).default(3),
      temperature: z.number().min(0).max(2).default(0.7),
      model: z.string().optional(),
    })
    .optional(),
});

export const AgentCollaborateSchema = z.object({
  agents: z
    .array(z.enum(['analytical', 'creative', 'critical', 'systems', 'research']))
    .min(2)
    .max(5),
  task: z.string().min(1).max(5000),
  collaborationType: z.enum(['sequential', 'parallel', 'debate']).default('sequential'),
  maxRounds: z.number().int().min(1).max(10).default(3),
});

// Anti-hallucination schemas
export const VerifyFactSchema = z.object({
  claim: z.string().min(1).max(1000),
  context: z.string().max(5000).optional(),
  sources: z.array(z.string().url()).optional(),
  confidenceThreshold: z.number().min(0).max(1).default(0.8),
});

export const CheckConsistencySchema = z.object({
  statements: z.array(z.string().min(1).max(1000)).min(2).max(10),
  context: z.string().max(5000).optional(),
  strictMode: z.boolean().default(false),
});

// Model schemas
export const ModelInferenceSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.string().min(1).max(10000),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(10000),
      })
    )
    .optional(),
  options: z
    .object({
      temperature: z.number().min(0).max(2).default(0.7),
      maxTokens: z.number().int().min(1).max(100000).default(1000),
      topP: z.number().min(0).max(1).optional(),
      frequencyPenalty: z.number().min(-2).max(2).optional(),
      presencePenalty: z.number().min(-2).max(2).optional(),
      stream: z.boolean().default(false),
    })
    .optional(),
});

export const ModelListSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'local', 'all']).optional(),
  capabilities: z.array(z.string()).optional(),
  ...PaginationSchema.shape,
});

// Voice schemas
export const VoiceTranscribeSchema = z.object({
  audio: z.string().regex(/^data:audio\/(webm|wav|mp3|ogg);base64,/),
  language: z.string().length(2).optional(),
  context: z.string().max(500).optional(),
});

export const VoiceSynthesizeSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(100),
  voiceSettings: z
    .object({
      stability: z.number().min(0).max(1).default(0.5),
      similarityBoost: z.number().min(0).max(1).default(0.5),
      style: z.number().min(0).max(1).default(0),
      pitch: z.number().min(-2).max(2).default(0),
      speakingRate: z.number().min(0.25).max(4).default(1),
    })
    .optional(),
  format: z.enum(['mp3', 'wav', 'ogg']).default('mp3'),
});

// Authentication schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .max(100)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  name: z.string().min(1).max(100).optional(),
  metadata: z.record(z.any()).optional(),
});

export const APIKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).min(1),
  expiresIn: z.number().int().min(3600).max(31536000).optional(), // 1 hour to 1 year
});

// Health check schemas
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string(),
  uptime: z.number(),
  timestamp: DateSchema,
  services: z.object({
    database: z.boolean(),
    redis: z.boolean(),
    memory: z.boolean(),
    models: z.record(z.boolean()).optional(),
  }),
  metrics: z
    .object({
      cpu: z.number().min(0).max(100),
      memory: z.object({
        used: z.number(),
        total: z.number(),
        percentage: z.number().min(0).max(100),
      }),
      requestsPerMinute: z.number().optional(),
      averageResponseTime: z.number().optional(),
    })
    .optional(),
});

// Error schemas
export const ErrorResponseSchema = z.object({
  _error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    stack: z.string().optional(), // Only in development
  }),
  timestamp: DateSchema,
  requestId: z.string().uuid(),
});

// Request/Response wrapper schemas
export const APIRequestSchema = <T extends: z.ZodType>(dataSchema: T =>;
  z.object({
    data: dataSchema,
    metadata: z
      .object({
        requestId: z.string().uuid().optional(),
        timestamp: DateSchema.optional(),
        version: z.string().optional(),
      })
      .optional(),
  });

export const APIResponseSchema = <T extends: z.ZodType>(dataSchema: T =>;
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    _error ErrorResponseSchema.shape._erroroptional(),
    metadata: z.object({
      requestId: z.string().uuid(),
      timestamp: DateSchema,
      version: z.string(),
      processingTime: z.number(),
    }),
  });

// Batch operation schemas
export const BatchOperationSchema = <T extends: z.ZodType>(itemSchema: T =>;
  z.object({
    operations: z
      .array(
        z.object({
          id: z.string().uuid(),
          operation: z.enum(['create', 'update', 'delete']),
          data: itemSchema,
        })
      )
      .min(1)
      .max(100),
    options: z
      .object({
        stopOnError: z.boolean().default(false),
        parallel: z.boolean().default(false),
      })
      .optional(),
  });

// WebSocket message schemas
export const WebSocketMessageSchema = z.object({
  type: z.enum(['chat', 'agent_update', 'memory_sync', 'voice_stream', '_error]),
  data: z.any(),
  timestamp: DateSchema,
  sessionId: z.string().uuid(),
});

// File upload schemas
export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string(),
  size: z
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024), // Max 100MB
  purpose: z.enum(['avatar', 'document', 'audio', 'model']),
  metadata: z.record(z.any()).optional(),
});

// Export validation middleware
export function validateRequest<T extends: z.ZodType>(schema: T {
  return (req: any, res: any, next: any => {
    try {
      const result = schema.parse(req.body);
      req.validatedData = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          _error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid requestdata',
            details: errorerrors,
          },
        });
      } else {
        next(_error);
      }
    }
  };
}

// Export type inference helpers
export type MemoryStore = z.infer<typeof MemoryStoreSchema>;
export type MemorySearch = z.infer<typeof MemorySearchSchema>;
export type ToolExecute = z.infer<typeof ToolExecuteSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type ModelInference = z.infer<typeof ModelInferenceSchema>;
export type VoiceTranscribe = z.infer<typeof VoiceTranscribeSchema>;
export type VoiceSynthesize = z.infer<typeof VoiceSynthesizeSchema>;
