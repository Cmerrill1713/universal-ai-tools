#!/usr/bin/env npx tsx
interface ValidationError {
    type: 'MISSING_IMPORT' | 'INVALID_PATH' | 'UNDEFINED_REFERENCE' | 'SYNTAX_ERROR' | 'INCONSISTENT_NAMING';
    file: string;
    line?: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    suggestion?: string;
}
interface ValidationReport {
    totalFiles: number;
    errorsFound: number;
    warningsFound: number;
    errors: ValidationError[];
    summary: {
        missingImports: number;
        invalidPaths: number;
        undefinedReferences: number;
        syntaxErrors: number;
        inconsistentNaming: number;
    };
}
declare class CodebaseIntegrityValidator {
    private errors;
    private projectRoot;
    private sourceFiles;
    constructor(projectRoot: string);
    validate(): Promise<ValidationReport>;
    private findSourceFiles;
    private validateImports;
    private validateImportStatement;
    private validateDynamicImport;
    private validateRequireStatement;
    private resolveImportPath;
    private validateServiceReferences;
    private validateServiceExists;
    private validateRouterConsistency;
    private validateTypeDefinitions;
    private validateConfigReferences;
    private addError;
    private generateReport;
    private saveReport;
    private generateHumanReport;
}
export { CodebaseIntegrityValidator };
//# sourceMappingURL=validate-codebase-integrity.d.ts.map