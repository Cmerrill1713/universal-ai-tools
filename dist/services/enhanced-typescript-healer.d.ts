interface HealingStats {
    filesProcessed: number;
    errorsFixed: number;
    patterns: Record<string, number>;
    errors: string[];
}
declare class EnhancedTypeScriptHealer {
    private fixPatterns;
    private stats;
    constructor();
    healProject(): Promise<HealingStats>;
    private findTypeScriptFiles;
    private healFile;
    private runLintFix;
    runTargetedFixes(): Promise<void>;
    private fixConsoleUndefinedErrors;
    private fixUnusedVariables;
    private fixDuplicateImports;
    private addGlobalTypes;
    getStats(): HealingStats;
}
export default EnhancedTypeScriptHealer;
export { EnhancedTypeScriptHealer };
//# sourceMappingURL=enhanced-typescript-healer.d.ts.map