import type { MemoryRecord } from './memory-service';
export declare class RobustMemoryService {
    private breaker;
    private buffer;
    private lru;
    private flushTimer;
    private dedupeThreshold;
    constructor();
    private startAutoFlush;
    private stopAutoFlush;
    private getLruKey;
    private updateLru;
    private isDuplicate;
    save(memory: MemoryRecord): Promise<string | null>;
    flushBuffer(): Promise<number>;
    list(userId: string, type?: MemoryRecord['type'], limit?: number, offset?: number): Promise<any[]>;
    get(userId: string, id: string): Promise<any>;
    update(userId: string, id: string, updates: Partial<MemoryRecord>): Promise<boolean>;
    remove(userId: string, id: string): Promise<boolean>;
    search(userId: string, queryText: string, type?: MemoryRecord['type'], limit?: number): Promise<any[]>;
    getBufferedCount(): number;
    setDedupeThreshold(threshold: number): void;
}
export declare const robustMemoryService: RobustMemoryService;
export default robustMemoryService;
//# sourceMappingURL=robust-memory-service.d.ts.map