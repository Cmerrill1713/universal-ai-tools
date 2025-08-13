export interface OrchestrateParams {
    userRequest: string;
    userId?: string;
    context?: Record<string, unknown>;
}
export declare class DSPyService {
    isReady(): boolean;
    orchestrate(params: OrchestrateParams): Promise<any>;
    optimizePrompts(examples: Array<Record<string, unknown>>): Promise<any>;
    manageKnowledge(operation: string, payload: Record<string, unknown>): Promise<any>;
    status(): Promise<{
        ready: boolean;
    }>;
    private generateId;
}
export declare const dspyService: DSPyService;
export default dspyService;
//# sourceMappingURL=dspy-service.d.ts.map