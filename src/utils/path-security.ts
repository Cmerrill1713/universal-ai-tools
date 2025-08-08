/**
 * Path Security Utilities
 * Comprehensive path validation and security functions to prevent path traversal attacks
 */

import * as path from 'path';
import * as fs from 'fs';

export interface PathValidationOptions {
  /** Maximum allowed path length */
  maxLength?: number;
  /** Allowed file extensions (with dots, e.g., ['.png', '.jpg']) */
  allowedExtensions?: string[];
  /** Allowed base directories (absolute paths) */
  allowedDirectories?: string[];
  /** Whether to allow subdirectories within allowed directories */
  allowSubdirectories?: boolean;
  /** Additional character whitelist pattern (regex string) */
  additionalAllowedChars?: string;
}

export interface FileValidationOptions extends PathValidationOptions {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Whether the file must exist */
  mustExist?: boolean;
}

/**
 * Validates a file path against path traversal and injection attacks
 */
export function validatePath(filePath: string, options: PathValidationOptions = {}): boolean {
  const {
    maxLength = 500,
    allowedExtensions = [],
    allowedDirectories = [],
    allowSubdirectories = true,
    additionalAllowedChars = '',
  } = options;

  // Basic validation
  if (!filePath || typeof filePath !== 'string') {
    console.warn('🔒 Path validation failed: invalid input type');
    return false;
  }

  // Length validation
  if (filePath.length > maxLength) {
    console.warn(`🔒 Path validation failed: path too long (${filePath.length} > ${maxLength})`);
    return false;
  }

  // Character validation - strict whitelist approach
  const baseAllowedPattern = 'a-zA-Z0-9\\-_./\\\\:';
  const safeAdditional = (additionalAllowedChars || '').replace(/[^a-zA-Z0-9]/g, '');
  const allowedPattern = new RegExp(`^[${baseAllowedPattern}${safeAdditional}]+$`);

  if (!allowedPattern.test(filePath)) {
    console.warn(`🔒 Path validation failed: invalid characters in path: ${filePath}`);
    return false;
  }

  // Path traversal detection - multiple methods
  if (containsPathTraversal(filePath)) {
    console.warn(`🔒 Path validation failed: path traversal detected in: ${filePath}`);
    return false;
  }

  // Normalize and resolve the path to handle any remaining traversal attempts
  const normalizedPath = path.normalize(filePath);
  const resolvedPath = path.resolve(normalizedPath);

  // Check for path traversal in normalized path
  if (containsPathTraversal(normalizedPath)) {
    console.warn(`🔒 Path validation failed: path traversal in normalized path: ${normalizedPath}`);
    return false;
  }

  // Validate file extension if specified
  if (allowedExtensions.length > 0) {
    const ext = path.extname(filePath).toLowerCase();
    const normalizedExtensions = allowedExtensions.map((e) => e.toLowerCase());

    if (!normalizedExtensions.includes(ext)) {
      console.warn(
        `🔒 Path validation failed: extension '${ext}' not in allowed list: ${allowedExtensions.join(', ')}`
      );
      return false;
    }
  }

  // Validate against allowed directories if specified
  if (allowedDirectories.length > 0) {
    const isInAllowedDirectory = allowedDirectories.some((allowedDir) => {
      const absoluteAllowedDir = path.resolve(allowedDir);
      const isWithinDirectory =
        resolvedPath.startsWith(absoluteAllowedDir + path.sep) ||
        resolvedPath === absoluteAllowedDir;

      return allowSubdirectories ? isWithinDirectory : resolvedPath === absoluteAllowedDir;
    });

    if (!isInAllowedDirectory) {
      console.warn(
        `🔒 Path validation failed: path '${resolvedPath}' not in allowed directories: ${allowedDirectories.join(', ')}`
      );
      return false;
    }
  }

  return true;
}

/**
 * Validates a file path and checks file properties
 */
export function validateFile(filePath: string, options: FileValidationOptions = {}): boolean {
  const {
    maxFileSize = 100 * 1024 * 1024, // 100MB default
    mustExist = false,
    ...pathOptions
  } = options;

  // First validate the path
  if (!validatePath(filePath, pathOptions)) {
    return false;
  }

  const resolvedPath = path.resolve(filePath);

  // Check file existence if required
  if (mustExist && !fs.existsSync(resolvedPath)) {
    console.warn(`🔒 File validation failed: file does not exist: ${resolvedPath}`);
    return false;
  }

  // If file exists, validate size and properties
  if (fs.existsSync(resolvedPath)) {
    try {
      const stats = fs.statSync(resolvedPath);

      // Ensure it's a file, not a directory or special file
      if (!stats.isFile()) {
        console.warn(`🔒 File validation failed: not a regular file: ${resolvedPath}`);
        return false;
      }

      // Check file size
      if (stats.size > maxFileSize) {
        console.warn(
          `🔒 File validation failed: file too large (${stats.size} > ${maxFileSize}): ${resolvedPath}`
        );
        return false;
      }
    } catch (error) {
      console.warn(`🔒 File validation failed: unable to stat file: ${resolvedPath} - ${error}`);
      return false;
    }
  }

  return true;
}

/**
 * Sanitizes a filename to prevent path traversal and invalid characters
 */
export function sanitizeFilename(
  filename: string,
  options: { maxLength?: number; allowedExtensions?: string[] } = {}
): string {
  const { maxLength = 255, allowedExtensions = [] } = options;

  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename input');
  }

  // Remove path separators and traversal sequences
  let sanitized = filename.replace(/\.{2,}|[\/\\]+/g, '');

  // Remove dangerous characters, keep only safe ones
  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '');

  // Ensure it starts with alphanumeric character
  sanitized = sanitized.replace(/^[^a-zA-Z0-9]+/, '');

  // Limit length
  if (sanitized.length > maxLength) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    const maxBaseLength = maxLength - ext.length;
    sanitized = base.substring(0, Math.max(1, maxBaseLength)) + ext;
  }

  // Validate extension if specified
  if (allowedExtensions.length > 0) {
    const ext = path.extname(sanitized).toLowerCase();
    const normalizedExtensions = allowedExtensions.map((e) => e.toLowerCase());

    if (!normalizedExtensions.includes(ext)) {
      // Remove extension if not allowed
      sanitized = path.basename(sanitized, path.extname(sanitized));
    }
  }

  // Ensure we have a valid filename
  if (!sanitized || sanitized.length === 0) {
    sanitized = `file-${Date.now()}`;
  }

  return sanitized;
}

/**
 * Creates a secure path within a base directory
 */
export function createSecurePath(
  baseDir: string,
  filename: string,
  subdirs: string[] = []
): string {
  // Validate and sanitize all components
  if (!validatePath(baseDir, { allowedDirectories: [path.resolve(baseDir)] })) {
    throw new Error(`Invalid base directory: ${baseDir}`);
  }

  const sanitizedFilename = sanitizeFilename(filename);
  const sanitizedSubdirs = subdirs.map((dir) => sanitizeFilename(dir, { allowedExtensions: [] }));

  // Build the path
  const fullPath = path.resolve(baseDir, ...sanitizedSubdirs, sanitizedFilename);

  // Final validation
  if (
    !validatePath(fullPath, {
      allowedDirectories: [path.resolve(baseDir)],
      allowSubdirectories: true,
    })
  ) {
    throw new Error(`Generated path failed validation: ${fullPath}`);
  }

  return fullPath;
}

/**
 * Enhanced path traversal detection
 */
function containsPathTraversal(filePath: string): boolean {
  const dangerousPatterns = [
    /\.\./, // Basic path traversal
    /\.\/\.\./, // Relative path traversal
    /\.\.\\/, // Windows path traversal
    /\.\.\//, // Unix path traversal
    /%2e%2e/i, // URL encoded path traversal
    /%252e%252e/i, // Double URL encoded
    /\.%2e/i, // Mixed encoding
    /\/%2e%2e/i, // URL encoded with slash
    /\\\.\./, // Escaped path traversal
    /\/\.\.\//, // Multiple slashes
    /\\+\.\./, // Multiple backslashes
    /\x00/, // Null byte injection
    /\/{2,}/, // Multiple consecutive slashes
    /\\{2,}/, // Multiple consecutive backslashes
  ];

  return dangerousPatterns.some((pattern) => pattern.test(filePath));
}

/**
 * Validates that a resolved path stays within allowed boundaries
 */
export function validatePathBoundary(targetPath: string, allowedRoots: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);

  return allowedRoots.some((root) => {
    const resolvedRoot = path.resolve(root);
    const relativePath = path.relative(resolvedRoot, resolvedTarget);

    // Path is within boundary if it doesn't start with '..' and doesn't contain null bytes
    return (
      !relativePath.startsWith('..') &&
      !relativePath.includes('\0') &&
      path.resolve(resolvedRoot, relativePath) === resolvedTarget
    );
  });
}

/**
 * Generate a secure temporary file path
 */
export function generateSecureTempPath(
  baseDir: string,
  prefix = 'temp',
  extension = '.tmp'
): string {
  const sanitizedPrefix = sanitizeFilename(prefix, { allowedExtensions: [] });
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9.]/g, '');
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);

  const filename = `${sanitizedPrefix}-${timestamp}-${random}${sanitizedExtension}`;

  return createSecurePath(baseDir, filename);
}

/**
 * Safely remove a file after validating boundaries and existence
 */
export function safeUnlink(filePath: string, allowedRoots: string[]): boolean {
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
  } catch {
    // no-op; treat as not removed
  }
  return false;
}

/**
 * Security audit function to check for potential vulnerabilities
 */
export function auditPathSecurity(
  filePaths: string[],
  options: PathValidationOptions = {}
): {
  valid: string[];
  invalid: { path: string; reason: string }[];
  warnings: string[];
} {
  const result = {
    valid: [] as string[],
    invalid: [] as { path: string; reason: string }[],
    warnings: [] as string[],
  };

  for (const filePath of filePaths) {
    try {
      if (validatePath(filePath, options)) {
        result.valid.push(filePath);
      } else {
        result.invalid.push({
          path: filePath,
          reason: 'Failed path validation',
        });
      }
    } catch (error) {
      result.invalid.push({
        path: filePath,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Additional warnings for suspicious patterns
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      result.warnings.push(`Potentially unsafe path pattern: ${filePath}`);
    }
  }

  return result;
}
