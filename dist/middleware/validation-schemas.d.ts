import { z } from 'zod';
export declare const baseIdSchema: z.ZodString;
export declare const userIdSchema: z.ZodString;
export declare const apiKeySchema: z.ZodString;
export declare const flashAttentionOptimizeSchema: z.ZodObject<{
    modelId: z.ZodString;
    providerId: z.ZodString;
    inputTokens: z.ZodArray<z.ZodNumber, "many">;
    attentionMask: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    sequenceLength: z.ZodNumber;
    batchSize: z.ZodDefault<z.ZodNumber>;
    useCache: z.ZodDefault<z.ZodBoolean>;
    optimizationLevel: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "aggressive"]>>;
}, "strip", z.ZodTypeAny, {
    inputTokens: number[];
    batchSize: number;
    modelId: string;
    providerId: string;
    sequenceLength: number;
    useCache: boolean;
    optimizationLevel: "high" | "medium" | "low" | "aggressive";
    attentionMask?: number[] | undefined;
}, {
    inputTokens: number[];
    modelId: string;
    providerId: string;
    sequenceLength: number;
    batchSize?: number | undefined;
    attentionMask?: number[] | undefined;
    useCache?: boolean | undefined;
    optimizationLevel?: "high" | "medium" | "low" | "aggressive" | undefined;
}>;
export declare const flashAttentionConfigSchema: z.ZodObject<{
    enableGPU: z.ZodOptional<z.ZodBoolean>;
    enableCPU: z.ZodOptional<z.ZodBoolean>;
    batchSize: z.ZodOptional<z.ZodNumber>;
    blockSize: z.ZodOptional<z.ZodNumber>;
    enableMemoryOptimization: z.ZodOptional<z.ZodBoolean>;
    enableKernelFusion: z.ZodOptional<z.ZodBoolean>;
    fallbackToStandard: z.ZodOptional<z.ZodBoolean>;
    maxMemoryMB: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    batchSize?: number | undefined;
    enableGPU?: boolean | undefined;
    enableCPU?: boolean | undefined;
    blockSize?: number | undefined;
    enableMemoryOptimization?: boolean | undefined;
    enableKernelFusion?: boolean | undefined;
    fallbackToStandard?: boolean | undefined;
    maxMemoryMB?: number | undefined;
}, {
    batchSize?: number | undefined;
    enableGPU?: boolean | undefined;
    enableCPU?: boolean | undefined;
    blockSize?: number | undefined;
    enableMemoryOptimization?: boolean | undefined;
    enableKernelFusion?: boolean | undefined;
    fallbackToStandard?: boolean | undefined;
    maxMemoryMB?: number | undefined;
}>;
export declare const messageSchema: z.ZodObject<{
    content: z.ZodString;
    role: z.ZodEnum<["user", "assistant", "system"]>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    role: "system" | "user" | "assistant";
    metadata?: Record<string, string> | undefined;
}, {
    content: string;
    role: "system" | "user" | "assistant";
    metadata?: Record<string, string> | undefined;
}>;
export declare const chatRequestSchema: z.ZodObject<{
    message: z.ZodString;
    chatId: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    temperature: z.ZodOptional<z.ZodNumber>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    stream: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    message: string;
    stream: boolean;
    model?: string | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    chatId?: string | undefined;
}, {
    message: string;
    model?: string | undefined;
    maxTokens?: number | undefined;
    temperature?: number | undefined;
    chatId?: string | undefined;
    stream?: boolean | undefined;
}>;
export declare const agentRequestSchema: z.ZodObject<{
    agentId: z.ZodString;
    instruction: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    priority: "high" | "low" | "urgent" | "normal";
    agentId: string;
    instruction: string;
    context?: Record<string, any> | undefined;
    timeout?: number | undefined;
}, {
    agentId: string;
    instruction: string;
    context?: Record<string, any> | undefined;
    timeout?: number | undefined;
    priority?: "high" | "low" | "urgent" | "normal" | undefined;
}>;
export declare const agentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    capabilities: z.ZodArray<z.ZodString, "many">;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    capabilities: string[];
    config?: Record<string, any> | undefined;
    description?: string | undefined;
}, {
    type: string;
    name: string;
    capabilities: string[];
    config?: Record<string, any> | undefined;
    description?: string | undefined;
}>;
export declare const loginSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    deviceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    password: string;
    username: string;
    deviceId?: string | undefined;
}, {
    password: string;
    username: string;
    deviceId?: string | undefined;
}>;
export declare const apiKeyRequestSchema: z.ZodObject<{
    name: z.ZodString;
    permissions: z.ZodArray<z.ZodString, "many">;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    permissions: string[];
    expiresAt?: string | undefined;
}, {
    name: string;
    permissions: string[];
    expiresAt?: string | undefined;
}>;
export declare const systemMetricsQuerySchema: z.ZodObject<{
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    metric: z.ZodOptional<z.ZodEnum<["cpu", "memory", "requests", "errors"]>>;
    interval: z.ZodDefault<z.ZodEnum<["1m", "5m", "15m", "1h", "24h"]>>;
}, "strip", z.ZodTypeAny, {
    interval: "24h" | "5m" | "1h" | "1m" | "15m";
    startTime?: string | undefined;
    metric?: "memory" | "requests" | "errors" | "cpu" | undefined;
    endTime?: string | undefined;
}, {
    startTime?: string | undefined;
    interval?: "24h" | "5m" | "1h" | "1m" | "15m" | undefined;
    metric?: "memory" | "requests" | "errors" | "cpu" | undefined;
    endTime?: string | undefined;
}>;
export declare const logQuerySchema: z.ZodObject<{
    level: z.ZodOptional<z.ZodEnum<["error", "warn", "info", "debug"]>>;
    service: z.ZodOptional<z.ZodString>;
    startTime: z.ZodOptional<z.ZodString>;
    endTime: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    service?: string | undefined;
    level?: "info" | "error" | "warn" | "debug" | undefined;
    startTime?: string | undefined;
    endTime?: string | undefined;
}, {
    service?: string | undefined;
    level?: "info" | "error" | "warn" | "debug" | undefined;
    startTime?: string | undefined;
    limit?: number | undefined;
    endTime?: string | undefined;
}>;
export declare const fileUploadSchema: z.ZodObject<{
    filename: z.ZodString;
    mimeType: z.ZodString;
    size: z.ZodNumber;
    purpose: z.ZodEnum<["training", "inference", "storage"]>;
}, "strip", z.ZodTypeAny, {
    filename: string;
    size: number;
    mimeType: string;
    purpose: "training" | "inference" | "storage";
}, {
    filename: string;
    size: number;
    mimeType: string;
    purpose: "training" | "inference" | "storage";
}>;
export declare const parameterOptimizationSchema: z.ZodObject<{
    modelId: z.ZodString;
    parameters: z.ZodRecord<z.ZodString, z.ZodNumber>;
    objective: z.ZodEnum<["accuracy", "speed", "memory", "balanced"]>;
    constraints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    maxIterations: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    parameters: Record<string, number>;
    modelId: string;
    maxIterations: number;
    objective: "memory" | "accuracy" | "balanced" | "speed";
    constraints?: Record<string, any> | undefined;
}, {
    parameters: Record<string, number>;
    modelId: string;
    objective: "memory" | "accuracy" | "balanced" | "speed";
    maxIterations?: number | undefined;
    constraints?: Record<string, any> | undefined;
}>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    page: number;
    sortOrder: "desc" | "asc";
    sortBy?: string | undefined;
}, {
    limit?: number | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "desc" | "asc" | undefined;
}>;
export declare const searchSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    query: z.ZodString;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    limit: number;
    page: number;
    sortOrder: "desc" | "asc";
    filters?: Record<string, any> | undefined;
    sortBy?: string | undefined;
}, {
    query: string;
    limit?: number | undefined;
    filters?: Record<string, any> | undefined;
    page?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "desc" | "asc" | undefined;
}>;
export declare function validateRequestBody<T>(schema: z.ZodSchema<T>): (req: any, res: any, next: any) => any;
export declare function validateQueryParams<T>(schema: z.ZodSchema<T>): (req: any, res: any, next: any) => any;
export declare function sanitizeString(input: string, maxLength?: number): string;
export declare function validateIPAddress(ip: string): boolean;
export declare function validateEmail(email: string): boolean;
export declare const rateLimitConfigSchema: z.ZodObject<{
    windowMs: z.ZodNumber;
    maxRequests: z.ZodNumber;
    skipSuccessfulRequests: z.ZodDefault<z.ZodBoolean>;
    skipFailedRequests: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    maxRequests: number;
    windowMs: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
}, {
    maxRequests: number;
    windowMs: number;
    skipSuccessfulRequests?: boolean | undefined;
    skipFailedRequests?: boolean | undefined;
}>;
export type FlashAttentionOptimizeRequest = z.infer<typeof flashAttentionOptimizeSchema>;
export type FlashAttentionConfigRequest = z.infer<typeof flashAttentionConfigSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export type SystemMetricsQuery = z.infer<typeof systemMetricsQuerySchema>;
export type SearchQuery = z.infer<typeof searchSchema>;
//# sourceMappingURL=validation-schemas.d.ts.map