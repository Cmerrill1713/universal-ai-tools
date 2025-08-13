import { z } from 'zod';
declare const SafeTextSchema: z.ZodEffects<z.ZodString, string, string>;
declare const SafeImageSchema: z.ZodObject<{
    imageBase64: z.ZodEffects<z.ZodString, string, string>;
    imagePath: z.ZodOptional<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        maxSize: z.ZodOptional<z.ZodNumber>;
        allowedFormats: z.ZodOptional<z.ZodArray<z.ZodEnum<["jpg", "jpeg", "png", "webp", "gif"]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        maxSize?: number | undefined;
        allowedFormats?: ("jpg" | "jpeg" | "png" | "webp" | "gif")[] | undefined;
    }, {
        maxSize?: number | undefined;
        allowedFormats?: ("jpg" | "jpeg" | "png" | "webp" | "gif")[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    imageBase64: string;
    options?: {
        maxSize?: number | undefined;
        allowedFormats?: ("jpg" | "jpeg" | "png" | "webp" | "gif")[] | undefined;
    } | undefined;
    imagePath?: string | undefined;
}, {
    imageBase64: string;
    options?: {
        maxSize?: number | undefined;
        allowedFormats?: ("jpg" | "jpeg" | "png" | "webp" | "gif")[] | undefined;
    } | undefined;
    imagePath?: string | undefined;
}>;
interface GuardrailResult {
    allowed: boolean;
    reason?: string;
    confidence: number;
    categories: string[];
    sanitizedContent?: string;
}
declare class InputGuardrailsService {
    private readonly blockedPatterns;
    private readonly rateLimiter;
    private readonly maxRequestsPerHour;
    private readonly maxRequestsPerMinute;
    validateInput(content: string, userId?: string, requestType?: string): Promise<GuardrailResult>;
    validateImage(imageData: {
        imageBase64?: string;
        imagePath?: string;
    }, userId?: string): Promise<GuardrailResult>;
    private analyzeSafety;
    private checkRateLimit;
    private cleanupRateLimiter;
    getStats(): {
        totalBlocked: number;
        totalSanitized: number;
        categoryBreakdown: Record<string, number>;
        rateLimitActive: number;
    };
}
export declare const inputGuardrailsService: InputGuardrailsService;
export { InputGuardrailsService, GuardrailResult, SafeTextSchema, SafeImageSchema };
//# sourceMappingURL=input-guardrails.d.ts.map