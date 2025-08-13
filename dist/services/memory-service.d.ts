export type MemoryType = 'conversation' | 'knowledge' | 'context' | 'preference' | 'summary';
export interface MemoryRecord {
    id?: string;
    userId: string;
    content: string;
    type: MemoryType;
    source?: string;
    projectPath?: string | null;
    importance?: number;
    tags?: string[];
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}
export declare class MemoryService {
    private supabase;
    constructor();
    save(memory: MemoryRecord): Promise<string | null>;
    list(userId: string, type?: MemoryType, limit?: number, offset?: number): Promise<any[]>;
    get(userId: string, id: string): Promise<any>;
    update(userId: string, id: string, updates: Partial<MemoryRecord>): Promise<boolean>;
    remove(userId: string, id: string): Promise<boolean>;
    search(userId: string, queryText: string, type?: MemoryType, limit?: number): Promise<any[]>;
    cleanup(userId: string, maxAgeDays?: number, minImportance?: number): Promise<number>;
    getStats(userId: string): Promise<{
        total: number;
        byType: Record<string, number>;
        newest?: string | null;
        oldest?: string | null;
    }>;
    summarizeRecent(userId: string, opts?: {
        window?: number;
        destinationType?: MemoryType;
    }): Promise<string | null>;
}
export declare const memoryService: MemoryService;
//# sourceMappingURL=memory-service.d.ts.map