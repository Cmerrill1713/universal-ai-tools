import { z } from 'zod';
export interface ValidationResult<T = unknown> {
    success: boolean;
    data?: T;
    errors?: ValidationError[];
    schema?: z.ZodSchema<T>;
}
export interface ValidationError {
    field: string;
    message: string;
    value: unknown;
    code: string;
}
export declare const AgentResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodUnknown;
    message: z.ZodString;
    confidence: z.ZodNumber;
    reasoning: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
    executionTime: z.ZodOptional<z.ZodNumber>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    validated: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    confidence: number;
    success: boolean;
    validated: boolean;
    timestamp?: string | undefined;
    data?: unknown;
    metadata?: Record<string, unknown> | undefined;
    reasoning?: string | undefined;
    executionTime?: number | undefined;
}, {
    message: string;
    confidence: number;
    success: boolean;
    timestamp?: string | undefined;
    data?: unknown;
    metadata?: Record<string, unknown> | undefined;
    reasoning?: string | undefined;
    executionTime?: number | undefined;
    validated?: boolean | undefined;
}>;
export type ValidatedAgentResponse<T = unknown> = z.infer<typeof AgentResponseSchema> & {
    data: T;
    validated: true;
    validationErrors?: ValidationError[];
    schema: z.ZodSchema<T>;
};
export declare const TaskClassificationSchema: z.ZodObject<{
    complexity: z.ZodEnum<["simple", "medium", "complex", "expert"]>;
    domain: z.ZodEnum<["general", "code", "reasoning", "creative", "multimodal"]>;
    urgency: z.ZodEnum<["low", "medium", "high", "critical"]>;
    estimatedTokens: z.ZodNumber;
    requiresAccuracy: z.ZodBoolean;
    requiresSpeed: z.ZodBoolean;
    confidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    estimatedTokens: number;
    complexity: "simple" | "medium" | "complex" | "expert";
    domain: "reasoning" | "general" | "code" | "creative" | "multimodal";
    urgency: "high" | "medium" | "low" | "critical";
    requiresAccuracy: boolean;
    requiresSpeed: boolean;
    confidence?: number | undefined;
}, {
    estimatedTokens: number;
    complexity: "simple" | "medium" | "complex" | "expert";
    domain: "reasoning" | "general" | "code" | "creative" | "multimodal";
    urgency: "high" | "medium" | "low" | "critical";
    requiresAccuracy: boolean;
    requiresSpeed: boolean;
    confidence?: number | undefined;
}>;
export declare const AgentCapabilitySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    inputTypes: z.ZodArray<z.ZodString, "many">;
    outputTypes: z.ZodArray<z.ZodString, "many">;
    complexity: z.ZodEnum<["simple", "medium", "complex"]>;
    reliability: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    description: string;
    name: string;
    complexity: "simple" | "medium" | "complex";
    inputTypes: string[];
    outputTypes: string[];
    reliability: number;
}, {
    description: string;
    name: string;
    complexity: "simple" | "medium" | "complex";
    inputTypes: string[];
    outputTypes: string[];
    reliability: number;
}>;
export declare const MemorySchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodString;
    embedding: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    metadata: z.ZodObject<{
        source: z.ZodString;
        timestamp: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        importance: z.ZodOptional<z.ZodNumber>;
        agentId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        source: string;
        tags?: string[] | undefined;
        importance?: number | undefined;
        agentId?: string | undefined;
    }, {
        timestamp: string;
        source: string;
        tags?: string[] | undefined;
        importance?: number | undefined;
        agentId?: string | undefined;
    }>;
    contextId: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        timestamp: string;
        source: string;
        tags?: string[] | undefined;
        importance?: number | undefined;
        agentId?: string | undefined;
    };
    content: string;
    id: string;
    embedding?: number[] | undefined;
    contextId?: string | undefined;
    expiresAt?: string | undefined;
}, {
    metadata: {
        timestamp: string;
        source: string;
        tags?: string[] | undefined;
        importance?: number | undefined;
        agentId?: string | undefined;
    };
    content: string;
    id: string;
    embedding?: number[] | undefined;
    contextId?: string | undefined;
    expiresAt?: string | undefined;
}>;
export declare const A2AMessageSchema: z.ZodObject<{
    id: z.ZodString;
    senderId: z.ZodString;
    receiverId: z.ZodOptional<z.ZodString>;
    messageType: z.ZodEnum<["request", "response", "broadcast", "notification"]>;
    content: z.ZodUnknown;
    timestamp: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    requiresResponse: z.ZodDefault<z.ZodBoolean>;
    correlationId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    priority: "high" | "medium" | "low" | "critical";
    requiresResponse: boolean;
    senderId: string;
    messageType: "request" | "response" | "broadcast" | "notification";
    metadata?: Record<string, unknown> | undefined;
    content?: unknown;
    receiverId?: string | undefined;
    correlationId?: string | undefined;
}, {
    timestamp: string;
    id: string;
    senderId: string;
    messageType: "request" | "response" | "broadcast" | "notification";
    metadata?: Record<string, unknown> | undefined;
    content?: unknown;
    priority?: "high" | "medium" | "low" | "critical" | undefined;
    requiresResponse?: boolean | undefined;
    receiverId?: string | undefined;
    correlationId?: string | undefined;
}>;
export declare class UniversalValidator<T> {
    private schema;
    private options;
    constructor(schema: z.ZodSchema<T>, options?: ValidationOptions);
    validate(data: unknown): ValidationResult<T>;
    validateAndTransform<U>(data: unknown, transformer: (validated: T) => U): ValidationResult<U>;
    isValid(data: unknown): data is T;
    generateJsonSchema(): unknown;
}
export interface ValidationOptions {
    strict?: boolean;
    allowPartial?: boolean;
    logValidation?: boolean;
    customValidators?: Array<(data: unknown) => ValidationResult>;
}
export declare const validators: {
    agentResponse: <T = unknown>(dataSchema?: z.ZodSchema<T>) => UniversalValidator<{
        message: string;
        confidence: number;
        success: boolean;
        timestamp?: string | undefined;
        data?: unknown;
        metadata?: Record<string, unknown> | undefined;
        reasoning?: string | undefined;
        executionTime?: number | undefined;
        validated?: boolean | undefined;
    }>;
    taskClassification: () => UniversalValidator<{
        estimatedTokens: number;
        complexity: "simple" | "medium" | "complex" | "expert";
        domain: "reasoning" | "general" | "code" | "creative" | "multimodal";
        urgency: "high" | "medium" | "low" | "critical";
        requiresAccuracy: boolean;
        requiresSpeed: boolean;
        confidence?: number | undefined;
    }>;
    agentCapability: () => UniversalValidator<{
        description: string;
        name: string;
        complexity: "simple" | "medium" | "complex";
        inputTypes: string[];
        outputTypes: string[];
        reliability: number;
    }>;
    memory: () => UniversalValidator<{
        metadata: {
            timestamp: string;
            source: string;
            tags?: string[] | undefined;
            importance?: number | undefined;
            agentId?: string | undefined;
        };
        content: string;
        id: string;
        embedding?: number[] | undefined;
        contextId?: string | undefined;
        expiresAt?: string | undefined;
    }>;
    a2aMessage: () => UniversalValidator<{
        timestamp: string;
        id: string;
        senderId: string;
        messageType: "request" | "response" | "broadcast" | "notification";
        metadata?: Record<string, unknown> | undefined;
        content?: unknown;
        priority?: "high" | "medium" | "low" | "critical" | undefined;
        requiresResponse?: boolean | undefined;
        receiverId?: string | undefined;
        correlationId?: string | undefined;
    }>;
    custom: <T>(schema: z.ZodSchema<T>, options?: ValidationOptions) => UniversalValidator<T>;
};
export declare function validateRequest<T>(validator: UniversalValidator<T>, property?: 'body' | 'query' | 'params'): (req: unknown, res: unknown, next: unknown) => any;
export declare function validateAsync<T>(data: unknown, validator: UniversalValidator<T>, asyncValidators?: Array<(data: T) => Promise<ValidationResult>>): Promise<ValidationResult<T>>;
export declare function createValidatedResponse<T>(data: T, message: string, confidence?: number, reasoning?: string, dataSchema?: z.ZodSchema<T>): ValidatedAgentResponse<T>;
//# sourceMappingURL=validation.d.ts.map