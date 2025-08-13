interface MigrationResult {
    success: boolean;
    migratedFiles: number;
    spaceSaved: number;
    errors: string[];
}
interface AssetMigrationOptions {
    preserveLocal?: boolean;
    archiveOlder?: boolean;
    ageLimitDays?: number;
}
export declare class TemplateMigrationService {
    private supabase;
    private rootPath;
    constructor();
    migratePRPTemplates(): Promise<MigrationResult>;
    migrateEnterpriseTemplates(): Promise<MigrationResult>;
    archiveLargeAssets(options?: AssetMigrationOptions): Promise<MigrationResult>;
    cleanupBackupDirectories(): Promise<MigrationResult>;
    migrateClaudeCommands(): Promise<MigrationResult>;
    getMigrationStats(): Promise<{
        totalPotentialSavings: number;
        largestDirectories: Array<{
            path: string;
            size: number;
        }>;
        recommendedActions: string[];
    }>;
    private migrateDirectory;
    private migrateFile;
    private archiveFile;
    private archiveScreenshots;
    private archiveOldLogs;
    private archiveBackupDirectories;
    private cleanupPattern;
    private getDirectorySize;
    private getContentType;
    private getAssetType;
}
export declare const templateMigrationService: TemplateMigrationService;
export default templateMigrationService;
//# sourceMappingURL=template-migration-service.d.ts.map