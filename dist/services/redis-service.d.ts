declare class RedisService {
    private client;
    private inMemoryCache;
    private isConnectedToRedis;
    constructor();
    private initializeRedis;
    get(key: string): Promise<any>;
    set(key: string, value: unknown, ttl?: number): Promise<void>;
    private setInMemory;
    del(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    flushall(): Promise<void>;
    isConnected(): boolean;
    ping(): Promise<boolean>;
    get isInMemoryMode(): boolean;
    disconnect(): Promise<void>;
}
export declare const redisService: RedisService;
export default redisService;
//# sourceMappingURL=redis-service.d.ts.map