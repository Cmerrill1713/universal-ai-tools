interface ExternalAPIConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    headers?: Record<string, string>;
    enabled: boolean;
    serviceType: 'llm' | 'vision' | 'speech' | 'custom';
    capabilities: string[];
    rateLimit?: {
        requestsPerMinute: number;
        requestsPerHour: number;
    };
}
interface APIRequest {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    data?: any;
    headers?: Record<string, string>;
    timeoutMs?: number;
}
interface APIResponse {
    success: boolean;
    data?: any;
    error?: string;
    statusCode: number;
    headers?: Record<string, string>;
}
interface RateLimitInfo {
    requestsThisMinute: number;
    requestsThisHour: number;
    lastReset: Date;
}
declare class ExternalAPIManager {
    private apis;
    private rateLimits;
    private requestHistory;
    private breakers;
    constructor();
    registerAPI(config: ExternalAPIConfig): Promise<boolean>;
    makeRequest(apiId: string, request: APIRequest): Promise<APIResponse>;
    getAPIs(): ExternalAPIConfig[];
    getAPI(apiId: string): ExternalAPIConfig | undefined;
    updateAPI(apiId: string, updates: Partial<ExternalAPIConfig>): Promise<boolean>;
    removeAPI(apiId: string): boolean;
    toggleAPI(apiId: string, enabled: boolean): Promise<boolean>;
    getAPIsByType(serviceType: string): ExternalAPIConfig[];
    getAPIsWithCapability(capability: string): ExternalAPIConfig[];
    private testConnection;
    private initializeRateLimit;
    private checkRateLimit;
    private recordRequest;
    getRateLimitStatus(apiId: string): RateLimitInfo | null;
    getRequestHistory(apiId: string): Date[];
}
export declare const externalAPIManager: ExternalAPIManager;
export default externalAPIManager;
//# sourceMappingURL=external-api-manager.d.ts.map