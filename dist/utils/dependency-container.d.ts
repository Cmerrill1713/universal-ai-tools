type ServiceFactory<T> = () => T | Promise<T>;
export declare class DependencyContainer {
    private services;
    private factories;
    private singletons;
    register<T>(name: string, instance: T): void;
    registerFactory<T>(name: string, factory: ServiceFactory<T>, singleton?: boolean): void;
    get<T>(name: string): T;
    has(name: string): boolean;
    remove(name: string): void;
    clear(): void;
    getServiceNames(): string[];
}
export declare const container: DependencyContainer;
export declare const SERVICE_NAMES: {
    readonly AGENT_REGISTRY: "agentRegistry";
    readonly SUPABASE_CLIENT: "supabaseClient";
    readonly HEALTH_MONITOR: "healthMonitor";
    readonly FLASH_ATTENTION_SERVICE: "flashAttentionService";
    readonly SECRETS_MANAGER: "secretsManager";
    readonly PARAMETER_OPTIMIZER: "parameterOptimizer";
    readonly FEEDBACK_COLLECTOR: "feedbackCollector";
};
export declare function getAgentRegistry(): unknown;
export declare function getSupabaseClient(): unknown;
export declare function getHealthMonitor(): unknown;
export declare function getFlashAttentionService(): unknown;
export declare function injectServices(req: any, res: any, next: any): void;
export {};
//# sourceMappingURL=dependency-container.d.ts.map