import { z } from 'zod';
import { log, LogContext } from './logger';
export const AgentResponseSchema = z.object({
    success: z.boolean(),
    data: z.unknown(),
    message: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().optional(),
    timestamp: z.string().datetime().optional(),
    executionTime: z.number().positive().optional(),
    metadata: z.record(z.unknown()).optional(),
    validated: z.boolean().default(true),
});
export const TaskClassificationSchema = z.object({
    complexity: z.enum(['simple', 'medium', 'complex', 'expert']),
    domain: z.enum(['general', 'code', 'reasoning', 'creative', 'multimodal']),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    estimatedTokens: z.number().positive(),
    requiresAccuracy: z.boolean(),
    requiresSpeed: z.boolean(),
    confidence: z.number().min(0).max(1).optional(),
});
export const AgentCapabilitySchema = z.object({
    name: z.string(),
    description: z.string(),
    inputTypes: z.array(z.string()),
    outputTypes: z.array(z.string()),
    complexity: z.enum(['simple', 'medium', 'complex']),
    reliability: z.number().min(0).max(1),
});
export const MemorySchema = z.object({
    id: z.string().uuid(),
    content: z.string(),
    embedding: z.array(z.number()).optional(),
    metadata: z.object({
        source: z.string(),
        timestamp: z.string().datetime(),
        tags: z.array(z.string()).optional(),
        importance: z.number().min(0).max(1).optional(),
        agentId: z.string().optional(),
    }),
    contextId: z.string().optional(),
    expiresAt: z.string().datetime().optional(),
});
export const A2AMessageSchema = z.object({
    id: z.string().uuid(),
    senderId: z.string(),
    receiverId: z.string().optional(),
    messageType: z.enum(['request', 'response', 'broadcast', 'notification']),
    content: z.unknown(),
    timestamp: z.string().datetime(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    metadata: z.record(z.unknown()).optional(),
    requiresResponse: z.boolean().default(false),
    correlationId: z.string().optional(),
});
export class UniversalValidator {
    schema;
    options;
    constructor(schema, options = {}) {
        this.schema = schema;
        this.options = options;
    }
    validate(data) {
        try {
            const startTime = Date.now();
            if (this.options.strict) {
                const result = this.schema.parse(data);
                const validationTime = Date.now() - startTime;
                if (this.options.logValidation) {
                    log.info(`✅ Strict validation passed`, LogContext.SYSTEM, {
                        validationTime: `${validationTime}ms`,
                        dataType: typeof data,
                    });
                }
                return {
                    success: true,
                    data: result,
                    schema: this.schema,
                };
            }
            else {
                const result = this.schema.safeParse(data);
                const validationTime = Date.now() - startTime;
                if (result.success) {
                    if (this.options.logValidation) {
                        log.info(`✅ Validation passed`, LogContext.SYSTEM, {
                            validationTime: `${validationTime}ms`,
                            dataType: typeof data,
                        });
                    }
                    return {
                        success: true,
                        data: result.data,
                        schema: this.schema,
                    };
                }
                else {
                    const validationErrors = result.error.errors.map((err) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        value: err.path.reduce((obj, key) => obj?.[key], data),
                        code: err.code,
                    }));
                    if (this.options.logValidation) {
                        log.warn(`⚠️ Validation failed`, LogContext.SYSTEM, {
                            validationTime: `${validationTime}ms`,
                            errorCount: validationErrors.length,
                            errors: validationErrors,
                        });
                    }
                    return {
                        success: false,
                        errors: validationErrors,
                        schema: this.schema,
                    };
                }
            }
        }
        catch (error) {
            log.error(`❌ Validation error`, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                errors: [
                    {
                        field: 'root',
                        message: 'Validation failed with unexpected error',
                        value: data,
                        code: 'VALIDATION_ERROR',
                    },
                ],
                schema: this.schema,
            };
        }
    }
    validateAndTransform(data, transformer) {
        const result = this.validate(data);
        if (!result.success || !result.data) {
            return {
                success: false,
                errors: result.errors,
                schema: this.schema,
            };
        }
        try {
            const transformed = transformer(result.data);
            return {
                success: true,
                data: transformed,
                schema: this.schema,
            };
        }
        catch (error) {
            log.error(`❌ Transformation error`, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                errors: [
                    {
                        field: 'transformation',
                        message: 'Data transformation failed',
                        value: result.data,
                        code: 'TRANSFORMATION_ERROR',
                    },
                ],
                schema: this.schema,
            };
        }
    }
    isValid(data) {
        return this.validate(data).success;
    }
    generateJsonSchema() {
        return {
            type: 'object',
            properties: {},
            description: `Schema for ${this.schema.constructor.name}`,
        };
    }
}
export const validators = {
    agentResponse: (dataSchema) => {
        const schema = dataSchema
            ? AgentResponseSchema.extend({ data: dataSchema })
            : AgentResponseSchema;
        return new UniversalValidator(schema);
    },
    taskClassification: () => new UniversalValidator(TaskClassificationSchema),
    agentCapability: () => new UniversalValidator(AgentCapabilitySchema),
    memory: () => new UniversalValidator(MemorySchema),
    a2aMessage: () => new UniversalValidator(A2AMessageSchema),
    custom: (schema, options) => new UniversalValidator(schema, options),
};
export function validateRequest(validator, property = 'body') {
    return (req, res, next) => {
        const expressReq = req;
        const expressRes = res;
        const result = validator.validate(expressReq[property]);
        if (!result.success) {
            return expressRes.status(400).json({
                success: false,
                error: 'Validation failed',
                details: result.errors,
                validationTime: new Date().toISOString(),
            });
        }
        expressReq.validated = result.data;
        next();
    };
}
export async function validateAsync(data, validator, asyncValidators = []) {
    const syncResult = validator.validate(data);
    if (!syncResult.success || !syncResult.data) {
        return syncResult;
    }
    for (const asyncValidator of asyncValidators) {
        try {
            const asyncResult = await asyncValidator(syncResult.data);
            if (!asyncResult.success) {
                return {
                    success: false,
                    errors: [...(syncResult.errors || []), ...(asyncResult.errors || [])],
                    schema: validator['schema'],
                };
            }
        }
        catch (error) {
            log.error(`❌ Async validation error`, LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                errors: [
                    {
                        field: 'async_validation',
                        message: 'Async validation failed',
                        value: data,
                        code: 'ASYNC_VALIDATION_ERROR',
                    },
                ],
                schema: validator['schema'],
            };
        }
    }
    return syncResult;
}
export function createValidatedResponse(data, message, confidence = 0.8, reasoning, dataSchema) {
    const response = {
        success: true,
        data,
        message,
        confidence,
        reasoning,
        timestamp: new Date().toISOString(),
        validated: true,
        schema: dataSchema || z.unknown(),
    };
    const validator = validators.agentResponse(dataSchema);
    const result = validator.validate(response);
    if (!result.success) {
        log.warn(`⚠️ Response validation failed`, LogContext.SYSTEM, {
            errors: result.errors,
        });
        return {
            ...response,
            validationErrors: result.errors,
        };
    }
    return result.data;
}
//# sourceMappingURL=validation.js.map