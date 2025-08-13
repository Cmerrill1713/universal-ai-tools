import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
export declare abstract class BaseAgent {
    protected config: AgentConfig;
    protected isInitialized: boolean;
    constructor(config: AgentConfig);
    getName(): string;
    getDescription(): string;
    getCapabilities(): string[];
    getPriority(): number;
    initialize(): Promise<void>;
    execute(context: AgentContext): Promise<AgentResponse>;
    shutdown(): Promise<void>;
    protected abstract process(context: AgentContext): Promise<AgentResponse>;
    protected onInitialize(): Promise<void>;
    protected onShutdown(): Promise<void>;
    protected validateContext(context: AgentContext): void;
    protected createSuccessResponse(data: unknown, message: string, confidence?: number, reasoning?: string): AgentResponse;
    protected createErrorResponse(message: string, reasoning?: string): AgentResponse;
}
//# sourceMappingURL=base-agent.d.ts.map