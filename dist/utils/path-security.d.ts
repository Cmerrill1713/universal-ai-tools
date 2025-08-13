export interface PathValidationOptions {
    maxLength?: number;
    allowedExtensions?: string[];
    allowedDirectories?: string[];
    allowSubdirectories?: boolean;
    additionalAllowedChars?: string;
}
export interface FileValidationOptions extends PathValidationOptions {
    maxFileSize?: number;
    mustExist?: boolean;
}
export declare function validatePath(filePath: string, options?: PathValidationOptions): boolean;
export declare function validateFile(filePath: string, options?: FileValidationOptions): boolean;
export declare function sanitizeFilename(filename: string, options?: {
    maxLength?: number;
    allowedExtensions?: string[];
}): string;
export declare function createSecurePath(baseDir: string, filename: string, subdirs?: string[]): string;
export declare function validatePathBoundary(targetPath: string, allowedRoots: string[]): boolean;
export declare function generateSecureTempPath(baseDir: string, prefix?: string, extension?: string): string;
export declare function safeUnlink(filePath: string, allowedRoots: string[]): boolean;
export declare function auditPathSecurity(filePaths: string[], options?: PathValidationOptions): {
    valid: string[];
    invalid: {
        path: string;
        reason: string;
    }[];
    warnings: string[];
};
//# sourceMappingURL=path-security.d.ts.map