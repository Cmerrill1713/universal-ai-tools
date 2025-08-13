#!/usr/bin/env node
declare class SupabaseMCPServer {
    private server;
    private supabase;
    constructor();
    private setupToolHandlers;
    private setupResourceHandlers;
    private saveContext;
    private searchContext;
    private getRecentContext;
    private saveCodePattern;
    private getCodePatterns;
    private saveTaskProgress;
    private getTaskHistory;
    private analyzeErrors;
    private getContextResource;
    private getPatternsResource;
    private getTasksResource;
    private getErrorsResource;
    private proposeMigration;
    run(): Promise<void>;
}
export { SupabaseMCPServer };
//# sourceMappingURL=supabase-mcp-server.d.ts.map