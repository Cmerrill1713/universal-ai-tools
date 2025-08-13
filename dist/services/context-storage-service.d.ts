interface ContextEntry {
    id?: string;
    content: string;
    category: 'conversation' | 'project_info' | 'error_analysis' | 'code_patterns' | 'test_results' | 'architecture_patterns' | 'research_notes' | 'agent_profiles' | 'system_events' | 'training_data' | 'verified_answer';
    source: string;
    userId: string;
    projectPath?: string;
    metadata?: Record<string, any>;
    created_at?: string;
    updated_at?: string;
}
interface StoredContext {
    id: string;
    content: string;
    category: string;
    source: string;
    userId: string;
    projectPath: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    updated_at: string;
}
export declare class ContextStorageService {
    private supabase;
    constructor();
    storeContext(context: ContextEntry): Promise<string | null>;
    backfillEmbeddingsForUser(userId: string, maxRows?: number): Promise<{
        updated: number;
    }>;
    private generateEmbedding;
    private generateFallbackEmbedding;
    getContext(userId: string, category?: string, projectPath?: string, limit?: number): Promise<StoredContext[]>;
    updateContext(contextId: string, updates: Partial<ContextEntry>): Promise<boolean>;
    searchContext(userId: string, searchQuery: string, category?: string, limit?: number): Promise<StoredContext[]>;
    storeTestResults(userId: string, testResults: any, source: string, projectPath?: string): Promise<string | null>;
    storeConversation(userId: string, conversation: string, source: string, projectPath?: string): Promise<string | null>;
    cleanupOldContext(userId: string, daysOld?: number): Promise<number>;
    getContextStats(userId: string): Promise<{
        totalEntries: number;
        entriesByCategory: Record<string, number>;
        oldestEntry: string | null;
        newestEntry: string | null;
    }>;
}
export declare const contextStorageService: ContextStorageService;
export default contextStorageService;
//# sourceMappingURL=context-storage-service.d.ts.map