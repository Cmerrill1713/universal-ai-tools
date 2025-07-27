/**
 * Secure File System API Router
 *
 * Provides RESTful endpoints for file system operations with comprehensive security measures:
 * - Path sanitization and validation
 * - Authentication and authorization
 * - Rate limiting
 * - Input validation
 * - Activity logging
 * - WebSocket support for real-time events
 */

import type { Request, Response } from 'express';
import { NextFunction, Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { JWTAuthService } from '../middleware/auth-jwt';
import { RateLimiter } from '../middleware/rate-limiter';
import { CommonValidators, strictValidation } from '../middleware/comprehensive-validation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import mime from 'mime-types';
import chokidar from 'chokidar';
import WebSocket from 'ws';

const execAsync = promisify(exec);

// Request/Response schemas
const BrowseRequestSchema = z.object({
  path: z.string().optional(),
  showHidden: z.boolean().optional().default(false),
  recursive: z.boolean().optional().default(false),
  maxDepth: z.number().int().min(1).max(5).optional().default(1),
  filter: z
    .object({
      type: z.enum(['file', 'directory', 'all']).optional().default('all'),
      _pattern z.string().optional(),
      extensions: z.array(z.string()).optional(),
    })
    .optional(),
});

const ReadRequestSchema = z.object({
  path: z.string(),
  encoding: z.enum(['utf8', 'base64', 'hex', 'binary']).optional().default('utf8'),
  range: z
    .object({
      start: z.number().int().min(0).optional(),
      end: z.number().int().min(0).optional(),
    })
    .optional(),
});

const WriteRequestSchema = z.object({
  path: z.string(),
  _content z.string(),
  encoding: z.enum(['utf8', 'base64', 'hex']).optional().default('utf8'),
  mode: z.enum(['overwrite', 'append', 'create']).optional().default('overwrite'),
  permissions: z
    .string()
    .regex(/^[0-7]{3,4}$/)
    .optional(),
});

const ExecuteRequestSchema = z.object({
  command: z.string().max(1000),
  args: z.array(z.string()).optional().default([]),
  cwd: z.string().optional(),
  timeout: z.number().int().min(1000).max(300000).optional().default(30000), // 30 seconds default
  env: z.record(z.string()).optional(),
});

const MoveRequestSchema = z.object({
  source: z.string(),
  destination: z.string(),
  overwrite: z.boolean().optional().default(false),
});

const CopyRequestSchema = z.object({
  source: z.string(),
  destination: z.string(),
  overwrite: z.boolean().optional().default(false),
  recursive: z.boolean().optional().default(false),
});

const DeleteRequestSchema = z.object({
  path: z.string(),
  recursive: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
});

const SearchRequestSchema = z.object({
  path: z.string(),
  query: z.string().min(1).max(100),
  options: z
    .object({
      caseSensitive: z.boolean().optional().default(false),
      wholeWord: z.boolean().optional().default(false),
      regex: z.boolean().optional().default(false),
      maxResults: z.number().int().min(1).max(1000).optional().default(100),
      includeContent: z.boolean().optional().default(false),
      extensions: z.array(z.string()).optional(),
    })
    .optional(),
});

// File system entry type
interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  permissions: string;
  owner?: string;
  group?: string;
  mimeType?: string;
  isHidden: boolean;
  isReadable: boolean;
  isWritable: boolean;
  children?: FileSystemEntry[];
}

// WebSocket message types
interface FSWebSocketMessage {
  type: 'watch' | 'unwatch' | 'event' | '_error | 'ping' | 'pong';
  path?: string;
  event?: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  data?: any;
  id?: string;
  timestamp?: number;
}

class FileSystemRouterClass {
  private router: Router;
  private supabase: SupabaseClient;
  private rateLimiter: RateLimiter;
  private baseDir: string;
  private allowedPaths: string[];
  private blockedPaths: string[];
  private blockedPatterns: RegExp[];
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private wsClients: Map<string, WebSocket> = new Map();

  constructor(supabase: SupabaseClient) {
    this.router = Router();
    this.supabase = supabase;
    this.rateLimiter = new RateLimiter();

    // Security configuration
    this.baseDir = process.env.FS_BASE_DIR || process.cwd();
    this.allowedPaths = (process.env.FS_ALLOWED_PATHS || '').split(',').filter(Boolean);
    this.blockedPaths = [
      '/etc',
      '/sys',
      '/proc',
      '/dev',
      '/boot',
      '/root',
      '/var/log',
      '/.ssh',
      '/.git',
      '/node_modules',
      '.env',
      '.env.local',
      '.env.production',
      'secrets',
      'credentials',
      'password',
      'private',
      'id_rsa',
      'id_dsa',
      'id_ecdsa',
      'id_ed25519',
    ];

    this.blockedPatterns = [
      /\.env(\.|$)/i,
      /\.(pem|key|crt|cer|pfx|p12)$/i,
      /\.(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i,
      /\.(kdbx|keychain|gnupg|ssh)$/i,
      /\/(\.git|\.svn|\.hg|\.bzr)\//i,
      /\.(sqlite|db|mdb)$/i,
      /\.(log|logs)$/i,
      /secrets?\//i,
      /credentials?\//i,
      /passwords?\//i,
      /private\//i,
    ];

    this.setupRoutes();
  }

  /**
   * Validate and sanitize file paths
   */
  private sanitizePath(inputPath: string): string | null {
    try {
      // Remove any null bytes
      inputPath = inputPath.replace(/\0/g, '');

      // Resolve the absolute path
      const resolvedPath = path.resolve(this.baseDir, inputPath);

      // Ensure the path is within the base directory
      if (!resolvedPath.startsWith(this.baseDir)) {
        logger.warn('Path traversal attempt detected', { inputPath, resolvedPath });
        return null;
      }

      // Check against blocked paths
      const normalizedPath = resolvedPath.toLowerCase();
      for (const blocked of this.blockedPaths) {
        if (normalizedPath.includes(blocked.toLowerCase())) {
          logger.warn('Access to blocked path attempted', { path: resolvedPath });
          return null;
        }
      }

      // Check against blocked patterns
      for (const _patternof this.blockedPatterns) {
        if (_patterntest(resolvedPath)) {
          logger.warn('Access to blocked _patternattempted', {
            path: resolvedPath,
            _pattern _patterntoString(),
          });
          return null;
        }
      }

      // If allowed paths are specified, ensure the path is within one of them
      if (this.allowedPaths.length > 0) {
        const isAllowed = this.allowedPaths.some((allowed) =>
          resolvedPath.startsWith(path.resolve(this.baseDir, allowed))
        );
        if (!isAllowed) {
          logger.warn('Access to non-allowed path attempted', { path: resolvedPath });
          return null;
        }
      }

      return resolvedPath;
    } catch (_error) {
      logger.error'Path sanitization _error', _error;
      return null;
    }
  }

  /**
   * Log file system operations
   */
  private async logOperation(
    userId: string,
    operation: string,
    path: string,
    success: boolean,
    details?: any
  ): Promise<void> {
    try {
      await this.supabase.from('fs_audit_log').insert({
        user_id: userId,
        operation,
        path,
        success,
        details,
        ip_address: details?.ip,
        user_agent: details?.userAgent,
        timestamp: new Date(),
      });
    } catch (_error) {
      logger.error'Failed to log file system operation:', _error;
    }
  }

  /**
   * Get file system entry information
   */
  private async getFileInfo(filePath: string): Promise<FileSystemEntry | null> {
    try {
      const stats = await fs.stat(filePath);
      const name = path.basename(filePath);

      return {
        name,
        path: filePath,
        type: stats.isDirectory()
          ? 'directory'
          : stats.isFile()
            ? 'file'
            : stats.isSymbolicLink()
              ? 'symlink'
              : 'other',
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        permissions: stats.mode.toString(8).slice(-3),
        isHidden: name.startsWith('.'),
        isReadable: true, // Simplified - would need proper permission check
        isWritable: true, // Simplified - would need proper permission check
        mimeType: stats.isFile() ? mime.lookup(filePath) || 'application/octet-stream' : undefined,
      };
    } catch (_error) {
      logger.error'Failed to get file info:', _error;
      return null;
    }
  }

  /**
   * Setup all routes
   */
  private setupRoutes(): void {
    // Apply rate limiting
    this.router.use(
      this.rateLimiter.limit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
      })
    );

    // Browse endpoint
    this.router.post('/browse', this.handleBrowse.bind(this));

    // Read endpoint
    this.router.post('/read', this.handleRead.bind(this));

    // Write endpoint
    this.router.post('/write', this.handleWrite.bind(this));

    // Execute endpoint (with stricter rate limiting)
    this.router.post(
      '/execute',
      this.rateLimiter.limit({
        windowMs: 60 * 1000, // 1 minute
        max: 10, // 10 executions per minute
      }),
      this.handleExecute.bind(this)
    );

    // File operations
    this.router.post('/move', this.handleMove.bind(this));
    this.router.post('/copy', this.handleCopy.bind(this));
    this.router.post('/delete', this.handleDelete.bind(this));

    // Search endpoint
    this.router.post('/search', this.handleSearch.bind(this));

    // File upload endpoint
    this.router.post('/upload', this.handleUpload.bind(this));

    // File download endpoint
    this.router.get('/download', this.handleDownload.bind(this));

    // WebSocket endpoint for real-time file watching
    // Note: WebSocket handling needs to be set up separately in the server

    // System information endpoint
    this.router.get('/info', this.handleSystemInfo.bind(this));
  }

  /**
   * Handle browse requests
   */
  private async handleBrowse(req: Request, res: Response): Promise<void> {
    try {
      const validation = BrowseRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { path: requestPath = '', showHidden, recursive, maxDepth, filter } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'browse', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Read directory
      const entries: FileSystemEntry[] = [];

      const readDir = async (dirPath: string, depth = 0): Promise<void> => {
        if (depth >= maxDepth) return;

        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            // Skip hidden files if not requested
            if (!showHidden && file.startsWith('.')) continue;

            const filePath = path.join(dirPath, file);
            const fileInfo = await this.getFileInfo(filePath);

            if (!fileInfo) continue;

            // Apply filters
            if (filter) {
              if (filter.type !== 'all' && fileInfo.type !== filter.type) continue;
              if (filter._pattern&& !file.includes(filter._pattern) continue;
              if (filter.extensions && fileInfo.type === 'file') {
                const ext = path.extname(file).toLowerCase();
                if (!filter.extensions.includes(ext)) continue;
              }
            }

            entries.push(fileInfo);

            // Recursively read subdirectories
            if (recursive && fileInfo.type === 'directory' && depth < maxDepth - 1) {
              await readDir(filePath, depth + 1);
            }
          }
        } catch (_error) {
          logger.error'Error reading directory:', _error;
        }
      };

      await readDir(sanitizedPath);

      // Log successful operation
      await this.logOperation(userId, 'browse', sanitizedPath, true, {
        entriesCount: entries.length,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        path: sanitizedPath,
        entries,
        total: entries.length,
      });
    } catch (_error) {
      logger.error'Browse _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle read requests
   */
  private async handleRead(req: Request, res: Response): Promise<void> {
    try {
      const validation = ReadRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { path: requestPath, encoding, range } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'read', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Check if file exists
      try {
        const stats = await fs.stat(sanitizedPath);
        if (!stats.isFile()) {
          res.status(400).json({ _error 'Path is not a file' });
          return;
        }
      } catch (_error) {
        res.status(404).json({ _error 'File not found' });
        return;
      }

      // Read file with range support
      if (range && (range.start !== undefined || range.end !== undefined)) {
        const stream = createReadStream(sanitizedPath, {
          start: range.start,
          end: range.end,
          encoding: encoding as BufferEncoding,
        });

        let _content= '';
        stream.on('data', (chunk) => (_content+= chunk));
        stream.on('end', () => {
          res.json({
            path: sanitizedPath,
            _content
            encoding,
            partial: true,
          });
        });
        stream.on('_error, (_error => {
          logger.error'Read stream _error', _error;
          res.status(500).json({ _error 'Failed to read file' });
        });
      } else {
        // Read entire file
        const _content= await fs.readFile(sanitizedPath, encoding as BufferEncoding);

        // Log successful operation
        await this.logOperation(userId, 'read', sanitizedPath, true, {
          size: _contentlength,
          encoding,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({
          path: sanitizedPath,
          _content
          encoding,
          size: _contentlength,
        });
      }
    } catch (_error) {
      logger.error'Read _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle write requests
   */
  private async handleWrite(req: Request, res: Response): Promise<void> {
    try {
      const validation = WriteRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { path: requestPath, _content encoding, mode, permissions } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'write', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Check if file exists
      let exists = false;
      try {
        await fs.stat(sanitizedPath);
        exists = true;
      } catch (_error) {
        // File doesn't exist
      }

      // Handle different write modes
      if (mode === 'create' && exists) {
        res.status(409).json({ _error 'File already exists' });
        return;
      }

      if ((mode === 'overwrite' || mode === 'append') && !exists) {
        // Create directory if it doesn't exist
        const dir = path.dirname(sanitizedPath);
        await fs.mkdir(dir, { recursive: true });
      }

      // Decode _contentif needed
      let data: Buffer | string = _content
      if (encoding === 'base64') {
        data = Buffer.from(_content 'base64');
      } else if (encoding === 'hex') {
        data = Buffer.from(_content 'hex');
      }

      // Write file
      if (mode === 'append') {
        await fs.appendFile(sanitizedPath, data);
      } else {
        await fs.writeFile(sanitizedPath, data);
      }

      // Set permissions if specified
      if (permissions) {
        await fs.chmod(sanitizedPath, parseInt(permissions, 8, 10));
      }

      // Get file info
      const fileInfo = await this.getFileInfo(sanitizedPath);

      // Log successful operation
      await this.logOperation(userId, 'write', sanitizedPath, true, {
        mode,
        size: _contentlength,
        encoding,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket event
      this.emitFileEvent('change', sanitizedPath);

      res.json({
        path: sanitizedPath,
        size: fileInfo?.size || 0,
        mode,
        success: true,
      });
    } catch (_error) {
      logger.error'Write _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle execute requests (with extreme caution)
   */
  private async handleExecute(req: Request, res: Response): Promise<void> {
    try {
      // Check if user has execute permissions
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (userRole !== 'admin') {
        await this.logOperation(userId, 'execute', '', false, {
          reason: 'Insufficient permissions',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Execute permission required' });
        return;
      }

      const validation = ExecuteRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { command, args, cwd, timeout, env } = validation.data;

      // Validate and sanitize working directory
      let workingDir = this.baseDir;
      if (cwd) {
        const sanitizedCwd = this.sanitizePath(cwd);
        if (!sanitizedCwd) {
          res.status(403).json({ _error 'Invalid working directory' });
          return;
        }
        workingDir = sanitizedCwd;
      }

      // Create safe environment variables
      const safeEnv = {
        ...process.env,
        ...env,
        // Override potentially dangerous env vars
        PATH: process.env.PATH,
        LD_LIBRARY_PATH: undefined,
        LD_PRELOAD: undefined,
        DYLD_INSERT_LIBRARIES: undefined,
      };

      // Build command with arguments
      const fullCommand = [command, ...args]
        .map(
          (arg) =>
            // Quote arguments to prevent injection
            `'${arg.replace(/'/g, "'\\''")}'`
        )
        .join(' ');

      // Execute command with timeout
      try {
        const { stdout, stderr } = await execAsync(fullCommand, {
          cwd: workingDir,
          timeout,
          env: safeEnv,
          maxBuffer: 1024 * 1024 * 10, // 10MB max output
        });

        // Log successful operation
        await this.logOperation(userId, 'execute', command, true, {
          args,
          cwd: workingDir,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({
          command,
          args,
          stdout,
          stderr,
          exitCode: 0,
          success: true,
        });
      } catch (_error any) {
        // Log failed operation
        await this.logOperation(userId, 'execute', command, false, {
          args,
          cwd: workingDir,
          _error _errormessage,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });

        res.json({
          command,
          args,
          stdout: _errorstdout || '',
          stderr: _errorstderr || _errormessage,
          exitCode: _errorcode || 1,
          success: false,
          _error _errormessage,
        });
      }
    } catch (_error) {
      logger.error'Execute _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle move requests
   */
  private async handleMove(req: Request, res: Response): Promise<void> {
    try {
      const validation = MoveRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { source, destination, overwrite } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize paths
      const sanitizedSource = this.sanitizePath(source);
      const sanitizedDest = this.sanitizePath(destination);

      if (!sanitizedSource || !sanitizedDest) {
        await this.logOperation(userId, 'move', `${source} -> ${destination}`, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Check if source exists
      try {
        await fs.stat(sanitizedSource);
      } catch (_error) {
        res.status(404).json({ _error 'Source not found' });
        return;
      }

      // Check if destination exists
      let destExists = false;
      try {
        await fs.stat(sanitizedDest);
        destExists = true;
      } catch (_error) {
        // Destination doesn't exist
      }

      if (destExists && !overwrite) {
        res.status(409).json({ _error 'Destination already exists' });
        return;
      }

      // Create destination directory if needed
      const destDir = path.dirname(sanitizedDest);
      await fs.mkdir(destDir, { recursive: true });

      // Move file/directory
      await fs.rename(sanitizedSource, sanitizedDest);

      // Log successful operation
      await this.logOperation(userId, 'move', `${sanitizedSource} -> ${sanitizedDest}`, true, {
        overwrite,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket events
      this.emitFileEvent('unlink', sanitizedSource);
      this.emitFileEvent('add', sanitizedDest);

      res.json({
        source: sanitizedSource,
        destination: sanitizedDest,
        success: true,
      });
    } catch (_error) {
      logger.error'Move _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle copy requests
   */
  private async handleCopy(req: Request, res: Response): Promise<void> {
    try {
      const validation = CopyRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { source, destination, overwrite, recursive } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize paths
      const sanitizedSource = this.sanitizePath(source);
      const sanitizedDest = this.sanitizePath(destination);

      if (!sanitizedSource || !sanitizedDest) {
        await this.logOperation(userId, 'copy', `${source} -> ${destination}`, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Check if source exists
      let sourceStats;
      try {
        sourceStats = await fs.stat(sanitizedSource);
      } catch (_error) {
        res.status(404).json({ _error 'Source not found' });
        return;
      }

      // Check if destination exists
      let destExists = false;
      try {
        await fs.stat(sanitizedDest);
        destExists = true;
      } catch (_error) {
        // Destination doesn't exist
      }

      if (destExists && !overwrite) {
        res.status(409).json({ _error 'Destination already exists' });
        return;
      }

      // Create destination directory if needed
      const destDir = path.dirname(sanitizedDest);
      await fs.mkdir(destDir, { recursive: true });

      // Copy file or directory
      if (sourceStats.isFile()) {
        // Copy file
        await pipeline(createReadStream(sanitizedSource), createWriteStream(sanitizedDest));
      } else if (sourceStats.isDirectory() && recursive) {
        // Copy directory recursively
        await this.copyDirectory(sanitizedSource, sanitizedDest, overwrite);
      } else {
        res.status(400).json({ _error 'Cannot copy directory without recursive flag' });
        return;
      }

      // Log successful operation
      await this.logOperation(userId, 'copy', `${sanitizedSource} -> ${sanitizedDest}`, true, {
        overwrite,
        recursive,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket event
      this.emitFileEvent('add', sanitizedDest);

      res.json({
        source: sanitizedSource,
        destination: sanitizedDest,
        success: true,
      });
    } catch (_error) {
      logger.error'Copy _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle delete requests
   */
  private async handleDelete(req: Request, res: Response): Promise<void> {
    try {
      const validation = DeleteRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { path: requestPath, recursive, force } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(requestPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'delete', requestPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Don't allow deletion of base directory
      if (sanitizedPath === this.baseDir) {
        res.status(403).json({ _error 'Cannot delete base directory' });
        return;
      }

      // Check if path exists
      let stats;
      try {
        stats = await fs.stat(sanitizedPath);
      } catch (_error) {
        res.status(404).json({ _error 'Path not found' });
        return;
      }

      // Delete file or directory
      if (stats.isDirectory()) {
        if (!recursive) {
          res.status(400).json({ _error 'Cannot delete directory without recursive flag' });
          return;
        }
        await fs.rm(sanitizedPath, { recursive: true, force });
      } else {
        await fs.unlink(sanitizedPath);
      }

      // Log successful operation
      await this.logOperation(userId, 'delete', sanitizedPath, true, {
        recursive,
        force,
        type: stats.isDirectory() ? 'directory' : 'file',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Emit WebSocket event
      this.emitFileEvent(stats.isDirectory() ? 'unlinkDir' : 'unlink', sanitizedPath);

      res.json({
        path: sanitizedPath,
        success: true,
      });
    } catch (_error) {
      logger.error'Delete _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle search requests
   */
  private async handleSearch(req: Request, res: Response): Promise<void> {
    try {
      const validation = SearchRequestSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          _error 'Invalid _request,
          details: validation._errorerrors,
        });
        return;
      }

      const { path: searchPath, query, options = {} } = validation.data;
      const userId = (req as any).user.id;

      // Sanitize path
      const sanitizedPath = this.sanitizePath(searchPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'search', searchPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      const results: any[] = [];
      const searchRegex = options?.regex
        ? new RegExp(query, options?.caseSensitive ? 'g' : 'gi')
        : new RegExp(
            options?.wholeWord
              ? `\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
              : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            options?.caseSensitive ? 'g' : 'gi'
          );

      const searchDirectory = async (dirPath: string): Promise<void> => {
        if (results.length >= (options?.maxResults || 100)) return;

        try {
          const files = await fs.readdir(dirPath);

          for (const file of files) {
            if (results.length >= (options?.maxResults || 100)) break;

            const filePath = path.join(dirPath, file);
            const fileInfo = await this.getFileInfo(filePath);

            if (!fileInfo) continue;

            // Search in file name
            if (searchRegex.test(file)) {
              const result: any = {
                path: filePath,
                name: file,
                type: fileInfo.type,
                size: fileInfo.size,
                modified: fileInfo.modified,
                matchType: 'filename',
              };

              results.push(result);
            }

            // Search in file _contentif requested
            if (
              options?.includeContent &&
              fileInfo.type === 'file' &&
              results.length < (options?.maxResults || 100)
            ) {
              // Check file extension if filter is specified
              if (options?.extensions) {
                const ext = path.extname(file).toLowerCase();
                if (!options?.extensions.includes(ext)) continue;
              }

              try {
                const _content= await fs.readFile(filePath, 'utf8');
                const matches = _contentmatch(searchRegex);

                if (matches && matches.length > 0) {
                  const result: any = {
                    path: filePath,
                    name: file,
                    type: fileInfo.type,
                    size: fileInfo.size,
                    modified: fileInfo.modified,
                    matchType: '_content,
                    matches: matches.slice(0, 5), // First 5 matches
                    matchCount: matches.length,
                  };

                  results.push(result);
                }
              } catch (_error) {
                // Skip files that can't be read as text
              }
            }

            // Search subdirectories
            if (fileInfo.type === 'directory') {
              await searchDirectory(filePath);
            }
          }
        } catch (_error) {
          logger.error'Search directory _error', _error;
        }
      };

      await searchDirectory(sanitizedPath);

      // Log successful operation
      await this.logOperation(userId, 'search', sanitizedPath, true, {
        query,
        resultsCount: results.length,
        options,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        query,
        path: sanitizedPath,
        results,
        total: results.length,
        truncated: results.length >= (options?.maxResults || 100),
      });
    } catch (_error) {
      logger.error'Search _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle file upload
   */
  private async handleUpload(req: Request, res: Response): Promise<void> {
    // Implementation would depend on multer or similar middleware
    res.status(501).json({ _error 'Upload not implemented' });
  }

  /**
   * Handle file download
   */
  private async handleDownload(req: Request, res: Response): Promise<void> {
    try {
      const { path: downloadPath } = req.query;
      const userId = (req as any).user.id;

      if (!downloadPath || typeof downloadPath !== 'string') {
        res.status(400).json({ _error 'Path parameter required' });
        return;
      }

      // Sanitize path
      const sanitizedPath = this.sanitizePath(downloadPath);
      if (!sanitizedPath) {
        await this.logOperation(userId, 'download', downloadPath, false, {
          reason: 'Invalid path',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        });
        res.status(403).json({ _error 'Access denied' });
        return;
      }

      // Check if file exists and is a file
      let stats;
      try {
        stats = await fs.stat(sanitizedPath);
        if (!stats.isFile()) {
          res.status(400).json({ _error 'Path is not a file' });
          return;
        }
      } catch (_error) {
        res.status(404).json({ _error 'File not found' });
        return;
      }

      // Set headers
      const filename = path.basename(sanitizedPath);
      const mimeType = mime.lookup(sanitizedPath) || 'application/octet-stream';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream file
      const stream = createReadStream(sanitizedPath);
      stream.pipe(res);

      // Log successful operation
      await this.logOperation(userId, 'download', sanitizedPath, true, {
        size: stats.size,
        mimeType,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (_error) {
      logger.error'Download _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Handle WebSocket connections for file watching
   */
  private handleWebSocket(ws: WebSocket, req: Request): void {
    const userId = (req as any).user?.id || 'anonymous';
    const clientId = crypto.randomUUID();

    this.wsClients.set(clientId, ws);

    ws.on('message', async (message: string) => {
      try {
        const data: FSWebSocketMessage = JSON.parse(message);

        switch (data.type) {
          case 'watch':
            if (data.path) {
              const sanitizedPath = this.sanitizePath(data.path);
              if (sanitizedPath) {
                await this.watchPath(clientId, sanitizedPath);
                ws.send(
                  JSON.stringify({
                    type: 'event',
                    event: 'watching',
                    path: sanitizedPath,
                    timestamp: Date.now(),
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    type: '_error,
                    _error 'Invalid path',
                    path: data.path,
                    timestamp: Date.now(),
                  })
                );
              }
            }
            break;

          case 'unwatch':
            if (data.path) {
              const sanitizedPath = this.sanitizePath(data.path);
              if (sanitizedPath) {
                await this.unwatchPath(clientId, sanitizedPath);
                ws.send(
                  JSON.stringify({
                    type: 'event',
                    event: 'unwatched',
                    path: sanitizedPath,
                    timestamp: Date.now(),
                  })
                );
              }
            }
            break;

          case 'ping':
            ws.send(
              JSON.stringify({
                type: 'pong',
                timestamp: Date.now(),
              })
            );
            break;
        }
      } catch (_error) {
        logger.error'WebSocket message _error', _error;
        ws.send(
          JSON.stringify({
            type: '_error,
            _error 'Invalid message',
            timestamp: Date.now(),
          })
        );
      }
    });

    ws.on('close', () => {
      // Clean up watchers for this client
      this.watchers.forEach((watcher, path) => {
        // In a real implementation, track which clients are watching which paths
      });
      this.wsClients.delete(clientId);
    });
  }

  /**
   * Handle system info requests
   */
  private async handleSystemInfo(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id;

    try {
      const info = {
        baseDir: this.baseDir,
        allowedPaths: this.allowedPaths,
        features: {
          browse: true,
          read: true,
          write: true,
          execute: (req as any).user.role === 'admin',
          move: true,
          copy: true,
          delete: true,
          search: true,
          upload: false, // Not implemented
          download: true,
          watch: true,
        },
        limits: {
          maxUploadSize: 100 * 1024 * 1024, // 100MB
          maxExecutionTime: 30000, // 30 seconds
          maxSearchResults: 1000,
        },
      };

      res.json(info);
    } catch (_error) {
      logger.error'System info _error', _error;
      res.status(500).json({ _error 'Internal server _error });
    }
  }

  /**
   * Helper: Copy directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string,
    overwrite: boolean
  ): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const files = await fs.readdir(source);

    for (const file of files) {
      const sourcePath = path.join(source, file);
      const destPath = path.join(destination, file);

      const stats = await fs.stat(sourcePath);

      if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath, overwrite);
      } else {
        if (overwrite || !(await this.fileExists(destPath))) {
          await pipeline(createReadStream(sourcePath), createWriteStream(destPath));
        }
      }
    }
  }

  /**
   * Helper: Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Watch a path for changes
   */
  private async watchPath(clientId: string, watchPath: string): Promise<void> {
    const watcherId = `${clientId}:${watchPath}`;

    // Don't create duplicate watchers
    if (this.watchers.has(watcherId)) return;

    const watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: 0,
    });

    watcher.on('all', (event, filePath) => {
      const ws = this.wsClients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'event',
            event,
            path: filePath,
            timestamp: Date.now(),
          })
        );
      }
    });

    this.watchers.set(watcherId, watcher);
  }

  /**
   * Stop watching a path
   */
  private async unwatchPath(clientId: string, watchPath: string): Promise<void> {
    const watcherId = `${clientId}:${watchPath}`;
    const watcher = this.watchers.get(watcherId);

    if (watcher) {
      await watcher.close();
      this.watchers.delete(watcherId);
    }
  }

  /**
   * Emit file system event to all WebSocket clients
   */
  private emitFileEvent(event: string, filePath: string): void {
    const message = JSON.stringify({
      type: 'event',
      event,
      path: filePath,
      timestamp: Date.now(),
    });

    this.wsClients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Get the router
   */
  public getRouter(): Router {
    return this.router;
  }
}

/**
 * Export router factory function
 */
export function FileSystemRouter(supabase: SupabaseClient): Router {
  const fsRouter = new FileSystemRouterClass(supabase);
  return fsRouter.getRouter();
}
