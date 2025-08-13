export declare class PersistentCache<T> {
    private keyPrefix;
    private defaultTTL;
    private redis;
    private memoryFallback;
    private connected;
    constructor(keyPrefix: string, defaultTTL?: number);
    private initializeRedis;
    set(key: string, value: T, ttl?: number): Promise<void>;
    get(key: string): Promise<T | null>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    has(key: string): Promise<boolean>;
    keys(pattern: string): Promise<string[]>;
    private cleanupExpired;
    disconnect(): Promise<void>;
}
export declare function createPersistentCache<T>(keyPrefix: string, ttl?: number): PersistentCache<T>;
export default PersistentCache;
//# sourceMappingURL=persistent-cache.d.ts.map