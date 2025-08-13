import { z } from 'zod';
export declare const ExecuteAgentRequest: z.ZodObject<{
    agentName: z.ZodString;
    userRequest: z.ZodString;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    userRequest: string;
    agentName: string;
    context?: Record<string, any> | undefined;
}, {
    userRequest: string;
    agentName: string;
    context?: Record<string, any> | undefined;
}>;
export declare const ExecuteAgentResponse: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodAny;
    metadata: z.ZodObject<{
        timestamp: z.ZodString;
        requestId: z.ZodString;
        agentName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        requestId: string;
        agentName: string;
    }, {
        timestamp: string;
        requestId: string;
        agentName: string;
    }>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        timestamp: string;
        requestId: string;
        agentName: string;
    };
    success: boolean;
    data?: any;
}, {
    metadata: {
        timestamp: string;
        requestId: string;
        agentName: string;
    };
    success: boolean;
    data?: any;
}>;
//# sourceMappingURL=schema.d.ts.map