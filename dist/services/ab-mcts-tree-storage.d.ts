import type { ABMCTSNode, ABMCTSSearchResult } from '../types/ab-mcts';
export interface TreeStorageOptions {
    ttl?: number;
    compress?: boolean;
}
export declare class ABMCTSTreeStorage {
    private redis;
    private readonly prefix;
    private readonly resultPrefix;
    private readonly defaultTTL;
    constructor();
    private initializeRedis;
    saveNode(node: ABMCTSNode, options?: TreeStorageOptions): Promise<void>;
    loadNode(nodeId: string, options?: TreeStorageOptions): Promise<ABMCTSNode | null>;
    saveSearchResult(searchId: string, result: ABMCTSSearchResult, options?: TreeStorageOptions): Promise<void>;
    loadSearchResult(searchId: string): Promise<Partial<ABMCTSSearchResult> | null>;
    deleteTree(nodeId: string): Promise<void>;
    getTreeStats(nodeId: string): Promise<{
        totalNodes: number;
        maxDepth: number;
        avgBranchingFactor: number;
    } | null>;
    private compress;
    private decompress;
    cleanup(olderThanHours?: number): Promise<number>;
    isAvailable(): boolean;
}
export declare const treeStorage: ABMCTSTreeStorage;
export default treeStorage;
//# sourceMappingURL=ab-mcts-tree-storage.d.ts.map