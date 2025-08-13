import * as fs from 'fs';
import * as path from 'path';
export function validatePath(filePath, options = {}) {
    const { maxLength = 500, allowedExtensions = [], allowedDirectories = [], allowSubdirectories = true, additionalAllowedChars = '', } = options;
    if (!filePath || typeof filePath !== 'string') {
        console.warn('🔒 Path validation failed: invalid input type');
        return false;
    }
    if (filePath.length > maxLength) {
        console.warn(`🔒 Path validation failed: path too long (${filePath.length} > ${maxLength})`);
        return false;
    }
    const baseAllowedPattern = 'a-zA-Z0-9\\-_./\\\\:';
    const safeAdditional = (additionalAllowedChars || '').replace(/[^a-zA-Z0-9]/g, '');
    const allowedPattern = new RegExp(`^[${baseAllowedPattern}${safeAdditional}]+$`);
    if (!allowedPattern.test(filePath)) {
        console.warn(`🔒 Path validation failed: invalid characters in path: ${filePath}`);
        return false;
    }
    if (containsPathTraversal(filePath)) {
        console.warn(`🔒 Path validation failed: path traversal detected in: ${filePath}`);
        return false;
    }
    const normalizedPath = path.normalize(filePath);
    const resolvedPath = path.resolve(normalizedPath);
    if (containsPathTraversal(normalizedPath)) {
        console.warn(`🔒 Path validation failed: path traversal in normalized path: ${normalizedPath}`);
        return false;
    }
    if (allowedExtensions.length > 0) {
        const ext = path.extname(filePath).toLowerCase();
        const normalizedExtensions = allowedExtensions.map((e) => e.toLowerCase());
        if (!normalizedExtensions.includes(ext)) {
            console.warn(`🔒 Path validation failed: extension '${ext}' not in allowed list: ${allowedExtensions.join(', ')}`);
            return false;
        }
    }
    if (allowedDirectories.length > 0) {
        const isInAllowedDirectory = allowedDirectories.some((allowedDir) => {
            const absoluteAllowedDir = path.resolve(allowedDir);
            const isWithinDirectory = resolvedPath.startsWith(absoluteAllowedDir + path.sep) ||
                resolvedPath === absoluteAllowedDir;
            return allowSubdirectories ? isWithinDirectory : resolvedPath === absoluteAllowedDir;
        });
        if (!isInAllowedDirectory) {
            console.warn(`🔒 Path validation failed: path '${resolvedPath}' not in allowed directories: ${allowedDirectories.join(', ')}`);
            return false;
        }
    }
    return true;
}
export function validateFile(filePath, options = {}) {
    const { maxFileSize = 100 * 1024 * 1024, mustExist = false, ...pathOptions } = options;
    if (!validatePath(filePath, pathOptions)) {
        return false;
    }
    const resolvedPath = path.resolve(filePath);
    if (mustExist && !fs.existsSync(resolvedPath)) {
        console.warn(`🔒 File validation failed: file does not exist: ${resolvedPath}`);
        return false;
    }
    if (fs.existsSync(resolvedPath)) {
        try {
            const stats = fs.statSync(resolvedPath);
            if (!stats.isFile()) {
                console.warn(`🔒 File validation failed: not a regular file: ${resolvedPath}`);
                return false;
            }
            if (stats.size > maxFileSize) {
                console.warn(`🔒 File validation failed: file too large (${stats.size} > ${maxFileSize}): ${resolvedPath}`);
                return false;
            }
        }
        catch (error) {
            console.warn(`🔒 File validation failed: unable to stat file: ${resolvedPath} - ${error}`);
            return false;
        }
    }
    return true;
}
export function sanitizeFilename(filename, options = {}) {
    const { maxLength = 255, allowedExtensions = [] } = options;
    if (!filename || typeof filename !== 'string') {
        throw new Error('Invalid filename input');
    }
    let sanitized = filename.replace(/\.{2,}|[\/\\]+/g, '');
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '');
    sanitized = sanitized.replace(/^[^a-zA-Z0-9]+/, '');
    if (sanitized.length > maxLength) {
        const ext = path.extname(sanitized);
        const base = path.basename(sanitized, ext);
        const maxBaseLength = maxLength - ext.length;
        sanitized = base.substring(0, Math.max(1, maxBaseLength)) + ext;
    }
    if (allowedExtensions.length > 0) {
        const ext = path.extname(sanitized).toLowerCase();
        const normalizedExtensions = allowedExtensions.map((e) => e.toLowerCase());
        if (!normalizedExtensions.includes(ext)) {
            sanitized = path.basename(sanitized, path.extname(sanitized));
        }
    }
    if (!sanitized || sanitized.length === 0) {
        sanitized = `file-${Date.now()}`;
    }
    return sanitized;
}
export function createSecurePath(baseDir, filename, subdirs = []) {
    if (!validatePath(baseDir, { allowedDirectories: [path.resolve(baseDir)] })) {
        throw new Error(`Invalid base directory: ${baseDir}`);
    }
    const sanitizedFilename = sanitizeFilename(filename);
    const sanitizedSubdirs = subdirs.map((dir) => sanitizeFilename(dir, { allowedExtensions: [] }));
    const fullPath = path.resolve(baseDir, ...sanitizedSubdirs, sanitizedFilename);
    if (!validatePath(fullPath, {
        allowedDirectories: [path.resolve(baseDir)],
        allowSubdirectories: true,
    })) {
        throw new Error(`Generated path failed validation: ${fullPath}`);
    }
    return fullPath;
}
function containsPathTraversal(filePath) {
    const dangerousPatterns = [
        /\.\./,
        /\.\/\.\./,
        /\.\.\\/,
        /\.\.\//,
        /%2e%2e/i,
        /%252e%252e/i,
        /\.%2e/i,
        /\/%2e%2e/i,
        /\\\.\./,
        /\/\.\.\//,
        /\\+\.\./,
        /\x00/,
        /\/{2,}/,
        /\\{2,}/,
    ];
    return dangerousPatterns.some((pattern) => pattern.test(filePath));
}
export function validatePathBoundary(targetPath, allowedRoots) {
    const resolvedTarget = path.resolve(targetPath);
    return allowedRoots.some((root) => {
        const resolvedRoot = path.resolve(root);
        const relativePath = path.relative(resolvedRoot, resolvedTarget);
        return (!relativePath.startsWith('..') &&
            !relativePath.includes('\0') &&
            path.resolve(resolvedRoot, relativePath) === resolvedTarget);
    });
}
export function generateSecureTempPath(baseDir, prefix = 'temp', extension = '.tmp') {
    const sanitizedPrefix = sanitizeFilename(prefix, { allowedExtensions: [] });
    const sanitizedExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const filename = `${sanitizedPrefix}-${timestamp}-${random}${sanitizedExtension}`;
    return createSecurePath(baseDir, filename);
}
export function safeUnlink(filePath, allowedRoots) {
    try {
        const resolved = path.resolve(filePath);
        const withinBoundary = validatePathBoundary(resolved, allowedRoots);
        const valid = validatePath(resolved, {
            allowedDirectories: allowedRoots,
            allowSubdirectories: true,
        });
        if (withinBoundary && valid && fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
            return true;
        }
    }
    catch {
    }
    return false;
}
export function auditPathSecurity(filePaths, options = {}) {
    const result = {
        valid: [],
        invalid: [],
        warnings: [],
    };
    for (const filePath of filePaths) {
        try {
            if (validatePath(filePath, options)) {
                result.valid.push(filePath);
            }
            else {
                result.invalid.push({
                    path: filePath,
                    reason: 'Failed path validation',
                });
            }
        }
        catch (error) {
            result.invalid.push({
                path: filePath,
                reason: error instanceof Error ? error.message : 'Unknown error',
            });
        }
        if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
            result.warnings.push(`Potentially unsafe path pattern: ${filePath}`);
        }
    }
    return result;
}
//# sourceMappingURL=path-security.js.map