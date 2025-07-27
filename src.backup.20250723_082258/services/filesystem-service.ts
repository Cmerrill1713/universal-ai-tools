import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import type { FSWatcher } from 'chokidar';
import { watch } from 'chokidar';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import { FileManagerAgent } from '../agents/personal/file_manager_agent';
import { z } from 'zod';

// Pydantic-style models using Zod
const FileMetadataSchema = z.object({
  path: z.string(),
  name: z.string(),
  size: z.number(),
  type: z.enum(['file', 'directory', 'symlink']),
  mimeType: z.string().optional(),
  extension: z.string().optional(),
  createdAt: z.date(),
  modifiedAt: z.date(),
  accessedAt: z.date(),
  permissions: z.object({
    readable: z.boolean(),
    writable: z.boolean(),
    executable: z.boolean(),
  }),
  hash: z.string().optional(),
  isHidden: z.boolean(),
});

const FileOperationSchema = z.object({
  id: z.string(),
  type: z.enum(['read', 'write', 'delete', 'move', 'copy', 'mkdir', 'chmod']),
  sourcePath: z.string(),
  targetPath: z.string().optional(),
  _content z.string().optional(),
  metadata: FileMetadataSchema.optional(),
  agentId: z.string(),
  userId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  _error z.string().optional(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
});

const DirectoryTreeSchema = z.object({
  path: z.string(),
  name: z.string(),
  type: z.literal('directory'),
  children: z.array(z.lazy(() => FileTreeNodeSchema)),
  expanded: z.boolean().default(false),
});

const FileTreeNodeSchema = z.union([FileMetadataSchema, DirectoryTreeSchema]);

type FileMetadata = z.infer<typeof FileMetadataSchema>;
type FileOperation = z.infer<typeof FileOperationSchema>;
type DirectoryTree = z.infer<typeof DirectoryTreeSchema>;
type FileTreeNode = z.infer<typeof FileTreeNodeSchema>;

// a2a (Agent-to-Agent) Protocol
interface A2AMessage {
  from: string;
  to: string;
  type: '_request | 'response' | 'event';
  action: string;
  payload: any;
  correlationId: string;
  timestamp: Date;
}

interface A2AProtocol {
  sendMessage(message: A2AMessage): Promise<void>;
  onMessage(handler: (message: A2AMessage) => Promise<void>): void;
  subscribe(agentId: string, eventType: string): void;
  unsubscribe(agentId: string, eventType: string): void;
}

export class FileSystemService extends EventEmitter implements A2AProtocol {
  private supabase: SupabaseClient;
  private fileManagerAgent: FileManagerAgent;
  private watchers: Map<string, FSWatcher> = new Map();
  private operationQueue: FileOperation[] = [];
  private a2aHandlers: Map<string, (message: A2AMessage) => Promise<void>> = new Map();
  private a2aSubscriptions: Map<string, Set<string>> = new Map();
  private allowedPaths: string[] = [];
  private blockedPaths: string[] = [
    '/etc',
    '/System',
    '/private',
    '/dev',
    '/proc',
    '/.git',
    'node_modules',
  ];

  constructor(supabase: SupabaseClient, allowedPaths?: string[]) {
    super();
    this.supabase = supabase;
    this.fileManagerAgent = new FileManagerAgent();

    // Set allowed paths (default to user's home directory and project directory)
    this.allowedPaths = allowedPaths || [process.env.HOME || '~', process.cwd()];

    logger.info('FileSystemService initialized', LogContext.SYSTEM, {
      allowedPaths: this.allowedPaths,
      blockedPaths: this.blockedPaths,
    });
  }

  // A2A Protocol Implementation
  async sendMessage(message: A2AMessage): Promise<void> {
    // Emit to local subscribers
    const subscribers = this.a2aSubscriptions.get(message.action) || new Set();
    for (const agentId of subscribers) {
      const handler = this.a2aHandlers.get(agentId);
      if (handler) {
        await handler(message);
      }
    }

    // Log to Supabase for persistence and remote agents
    await this.supabase.from('a2a_messages').insert({
      from_agent: message.from,
      to_agent: message.to,
      message_type: message.type,
      action: message.action,
      payload: message.payload,
      correlation_id: message.correlationId,
      created_at: message.timestamp,
    });

    // Emit for real-time subscribers
    this.emit('a2a:message', message);
  }

  onMessage(handler: (message: A2AMessage) => Promise<void>): void {
    const handlerId = crypto.randomUUID();
    this.a2aHandlers.set(handlerId, handler);
  }

  subscribe(agentId: string, eventType: string): void {
    if (!this.a2aSubscriptions.has(eventType)) {
      this.a2aSubscriptions.set(eventType, new Set());
    }
    this.a2aSubscriptions.get(eventType)!.add(agentId);
  }

  unsubscribe(agentId: string, eventType: string): void {
    const subscribers = this.a2aSubscriptions.get(eventType);
    if (subscribers) {
      subscribers.delete(agentId);
    }
  }

  // Path Security
  private isPathAllowed(filePath: string): boolean {
    const normalizedPath = path.resolve(filePath);

    // Check if path is in blocked list
    for (const blocked of this.blockedPaths) {
      if (normalizedPath.startsWith(blocked)) {
        return false;
      }
    }

    // Check if path is within allowed paths
    for (const allowed of this.allowedPaths) {
      const resolvedAllowed = path.resolve(allowed);
      if (normalizedPath.startsWith(resolvedAllowed)) {
        return true;
      }
    }

    return false;
  }

  private sanitizePath(filePath: string): string {
    // Remove any directory traversal attempts
    const sanitized = filePath.replace(/\.\./g, '').replace(/\/\//g, '/');
    return path.resolve(sanitized);
  }

  // File Operations
  async readFile(filePath: string, options?: { encoding?: BufferEncoding }): Promise<string> {
    const sanitizedPath = this.sanitizePath(filePath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const operation = await this.trackOperation({
      type: 'read',
      sourcePath: sanitizedPath,
      agentId: 'filesystem-service',
      userId: 'system',
    });

    try {
      const _content= await fs.readFile(sanitizedPath, options?.encoding || 'utf-8');
      await this.completeOperation(operation.id, { success: true });

      // Send a2a notification
      await this.sendMessage({
        from: 'filesystem-service',
        to: 'all',
        type: 'event',
        action: 'file:read',
        payload: { path: sanitizedPath, size: _contentlength },
        correlationId: operation.id,
        timestamp: new Date(),
      });

      return _content
    } catch (_error) {
      await this.completeOperation(operation.id, {
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      });
      throw _error;
    }
  }

  async writeFile(
    filePath: string,
    _content string,
    options?: { encoding?: BufferEncoding }
  ): Promise<void> {
    const sanitizedPath = this.sanitizePath(filePath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const operation = await this.trackOperation({
      type: 'write',
      sourcePath: sanitizedPath,
      _content
      agentId: 'filesystem-service',
      userId: 'system',
    });

    try {
      await fs.writeFile(sanitizedPath, _content options?.encoding || 'utf-8');
      await this.completeOperation(operation.id, { success: true });

      // Send a2a notification
      await this.sendMessage({
        from: 'filesystem-service',
        to: 'all',
        type: 'event',
        action: 'file:write',
        payload: { path: sanitizedPath, size: _contentlength },
        correlationId: operation.id,
        timestamp: new Date(),
      });
    } catch (_error) {
      await this.completeOperation(operation.id, {
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      });
      throw _error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const sanitizedPath = this.sanitizePath(filePath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const operation = await this.trackOperation({
      type: 'delete',
      sourcePath: sanitizedPath,
      agentId: 'filesystem-service',
      userId: 'system',
    });

    try {
      const stats = await fs.stat(sanitizedPath);

      if (stats.isDirectory()) {
        await fs.rmdir(sanitizedPath, { recursive: true });
      } else {
        await fs.unlink(sanitizedPath);
      }

      await this.completeOperation(operation.id, { success: true });

      // Send a2a notification
      await this.sendMessage({
        from: 'filesystem-service',
        to: 'all',
        type: 'event',
        action: 'file:delete',
        payload: { path: sanitizedPath, type: stats.isDirectory() ? 'directory' : 'file' },
        correlationId: operation.id,
        timestamp: new Date(),
      });
    } catch (_error) {
      await this.completeOperation(operation.id, {
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      });
      throw _error;
    }
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    const sanitizedSource = this.sanitizePath(sourcePath);
    const sanitizedTarget = this.sanitizePath(targetPath);

    if (!this.isPathAllowed(sanitizedSource) || !this.isPathAllowed(sanitizedTarget)) {
      throw new Error(`Access denied`);
    }

    const operation = await this.trackOperation({
      type: 'move',
      sourcePath: sanitizedSource,
      targetPath: sanitizedTarget,
      agentId: 'filesystem-service',
      userId: 'system',
    });

    try {
      await fs.rename(sanitizedSource, sanitizedTarget);
      await this.completeOperation(operation.id, { success: true });

      // Send a2a notification
      await this.sendMessage({
        from: 'filesystem-service',
        to: 'all',
        type: 'event',
        action: 'file:move',
        payload: { from: sanitizedSource, to: sanitizedTarget },
        correlationId: operation.id,
        timestamp: new Date(),
      });
    } catch (_error) {
      await this.completeOperation(operation.id, {
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      });
      throw _error;
    }
  }

  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const sanitizedSource = this.sanitizePath(sourcePath);
    const sanitizedTarget = this.sanitizePath(targetPath);

    if (!this.isPathAllowed(sanitizedSource) || !this.isPathAllowed(sanitizedTarget)) {
      throw new Error(`Access denied`);
    }

    const operation = await this.trackOperation({
      type: 'copy',
      sourcePath: sanitizedSource,
      targetPath: sanitizedTarget,
      agentId: 'filesystem-service',
      userId: 'system',
    });

    try {
      await fs.copyFile(sanitizedSource, sanitizedTarget);
      await this.completeOperation(operation.id, { success: true });

      // Send a2a notification
      await this.sendMessage({
        from: 'filesystem-service',
        to: 'all',
        type: 'event',
        action: 'file:copy',
        payload: { from: sanitizedSource, to: sanitizedTarget },
        correlationId: operation.id,
        timestamp: new Date(),
      });
    } catch (_error) {
      await this.completeOperation(operation.id, {
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      });
      throw _error;
    }
  }

  async createDirectory(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    const sanitizedPath = this.sanitizePath(dirPath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    const operation = await this.trackOperation({
      type: 'mkdir',
      sourcePath: sanitizedPath,
      agentId: 'filesystem-service',
      userId: 'system',
    });

    try {
      await fs.mkdir(sanitizedPath, { recursive: options?.recursive || false });
      await this.completeOperation(operation.id, { success: true });

      // Send a2a notification
      await this.sendMessage({
        from: 'filesystem-service',
        to: 'all',
        type: 'event',
        action: 'directory:create',
        payload: { path: sanitizedPath },
        correlationId: operation.id,
        timestamp: new Date(),
      });
    } catch (_error) {
      await this.completeOperation(operation.id, {
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
      });
      throw _error;
    }
  }

  async listDirectory(
    dirPath: string,
    options?: {
      recursive?: boolean;
      includeHidden?: boolean;
      maxDepth?: number;
    }
  ): Promise<FileTreeNode[]> {
    const sanitizedPath = this.sanitizePath(dirPath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    const entries = await fs.readdir(sanitizedPath, { withFileTypes: true });
    const result: FileTreeNode[] = [];

    for (const entry of entries) {
      if (!options?.includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(sanitizedPath, entry.name);
      const stats = await fs.stat(fullPath);

      if (entry.isDirectory()) {
        const node: DirectoryTree = {
          path: fullPath,
          name: entry.name,
          type: 'directory',
          children: [],
          expanded: false,
        };

        if (options?.recursive && (!options.maxDepth || options.maxDepth > 0)) {
          node.children = await this.listDirectory(fullPath, {
            ...options,
            maxDepth: options.maxDepth ? options.maxDepth - 1 : undefined,
          });
        }

        result.push(node);
      } else {
        const metadata = await this.getFileMetadata(fullPath);
        result.push(metadata);
      }
    }

    return result;
  }

  async getFileMetadata(filePath: string): Promise<FileMetadata> {
    const sanitizedPath = this.sanitizePath(filePath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const stats = await fs.stat(sanitizedPath);
    const name = path.basename(sanitizedPath);
    const extension = path.extname(sanitizedPath).toLowerCase();

    const metadata: FileMetadata = {
      path: sanitizedPath,
      name,
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
      extension: extension || undefined,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      accessedAt: stats.atime,
      permissions: {
        readable: !!(stats.mode & 0o400),
        writable: !!(stats.mode & 0o200),
        executable: !!(stats.mode & 0o100),
      },
      isHidden: name.startsWith('.'),
    };

    // Calculate hash for files
    if (metadata.type === 'file' && stats.size < 100 * 1024 * 1024) {
      // Only hash files < 100MB
      try {
        const _content= await fs.readFile(sanitizedPath);
        metadata.hash = crypto.createHash('sha256').update(_content.digest('hex');
      } catch (_error) {
        logger.warn('Failed to calculate file hash', LogContext.SYSTEM, {
          path: sanitizedPath,
          _error
        });
      }
    }

    return FileMetadataSchema.parse(metadata);
  }

  // File Watching
  async watchPath(
    watchPath: string,
    options?: {
      recursive?: boolean;
      ignorePatterns?: string[];
    }
  ): Promise<string> {
    const sanitizedPath = this.sanitizePath(watchPath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${watchPath}`);
    }

    const watcherId = crypto.randomUUID();

    const watcher = watch(sanitizedPath, {
      persistent: true,
      recursive: options?.recursive,
      ignored: options?.ignorePatterns,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on('add', (filePath) => this.handleFileEvent('add', filePath, watcherId));
    watcher.on('change', (filePath) => this.handleFileEvent('change', filePath, watcherId));
    watcher.on('unlink', (filePath) => this.handleFileEvent('unlink', filePath, watcherId));
    watcher.on('addDir', (dirPath) => this.handleFileEvent('addDir', dirPath, watcherId));
    watcher.on('unlinkDir', (dirPath) => this.handleFileEvent('unlinkDir', dirPath, watcherId));

    this.watchers.set(watcherId, watcher);

    logger.info('Started watching path', LogContext.SYSTEM, {
      watcherId,
      path: sanitizedPath,
      recursive: options?.recursive,
    });

    return watcherId;
  }

  async unwatchPath(watcherId: string): Promise<void> {
    const watcher = this.watchers.get(watcherId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(watcherId);

      logger.info('Stopped watching path', LogContext.SYSTEM, { watcherId });
    }
  }

  private async handleFileEvent(event: string, filePath: string, watcherId: string): Promise<void> {
    // Send a2a notification
    await this.sendMessage({
      from: 'filesystem-service',
      to: 'all',
      type: 'event',
      action: `file:${event}`,
      payload: {
        path: filePath,
        watcherId,
        event,
      },
      correlationId: crypto.randomUUID(),
      timestamp: new Date(),
    });

    // Emit local event
    this.emit('file:change', {
      event,
      path: filePath,
      watcherId,
    });
  }

  // Operation Tracking
  private async trackOperation(operation: Partial<FileOperation>): Promise<FileOperation> {
    const op: FileOperation = {
      id: crypto.randomUUID(),
      status: 'pending',
      startedAt: new Date(),
      ...operation,
    } as FileOperation;

    this.operationQueue.push(op);

    // Store in Supabase
    await this.supabase.from('file_operations').insert({
      id: op.id,
      type: op.type,
      source_path: op.sourcePath,
      target_path: op.targetPath,
      agent_id: op.agentId,
      user_id: op.userId,
      status: op.status,
      started_at: op.startedAt,
    });

    return op;
  }

  private async completeOperation(
    operationId: string,
    result: { success: boolean; _error: string }
  ): Promise<void> {
    const op = this.operationQueue.find((o) => o.id === operationId);
    if (!op) return;

    op.status = result.success ? 'completed' : 'failed';
    op._error= result._error
    op.completedAt = new Date();

    // Update in Supabase
    await this.supabase
      .from('file_operations')
      .update({
        status: op.status,
        _error op._error
        completed_at: op.completedAt,
      })
      .eq('id', operationId);

    // Remove from queue
    this.operationQueue = this.operationQueue.filter((o) => o.id !== operationId);
  }

  // Integration with FileManagerAgent
  async organizeFiles(dirPath: string, rules?: any): Promise<void> {
    const sanitizedPath = this.sanitizePath(dirPath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    // Delegate to FileManagerAgent
    await this.fileManagerAgent.organizeFiles({
      directory: sanitizedPath,
      rules: rules || 'smart',
      preview: false,
    });
  }

  async findDuplicates(dirPath: string): Promise<any[]> {
    const sanitizedPath = this.sanitizePath(dirPath);

    if (!this.isPathAllowed(sanitizedPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    // Delegate to FileManagerAgent
    return this.fileManagerAgent.findDuplicates({
      directory: sanitizedPath,
      includeSubdirs: true,
    });
  }

  async searchFiles(query: string, dirPath?: string): Promise<any[]> {
    const searchPath = dirPath ? this.sanitizePath(dirPath) : this.allowedPaths[0];

    if (!this.isPathAllowed(searchPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    // Delegate to FileManagerAgent
    return this.fileManagerAgent.smartSearch({
      query,
      directory: searchPath,
      searchContent: true,
    });
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Close all file watchers
    for (const [watcherId, watcher] of this.watchers) {
      await watcher.close();
    }
    this.watchers.clear();

    // Clear handlers
    this.a2aHandlers.clear();
    this.a2aSubscriptions.clear();

    logger.info('FileSystemService shut down', LogContext.SYSTEM);
  }
}

// Factory function
export function createFileSystemService(
  supabase: SupabaseClient,
  options?: { allowedPaths?: string[] }
): FileSystemService {
  return new FileSystemService(supabase, options?.allowedPaths);
}
