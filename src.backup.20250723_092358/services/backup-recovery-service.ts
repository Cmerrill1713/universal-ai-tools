import type { SupabaseClient } from '@supabase/supabase-js';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip, createGzip } from 'zlib';
import { LogContext, logger } from '../utils/enhanced-logger';
import { z } from 'zod';
import crypto from 'crypto';
import { circuitBreaker } from './circuit-breaker';

// AWS SDK v3 - dynamically loaded when needed
let S3Client: any, PutObjectCommand: any, GetObjectCommand: any, DeleteObjectCommand: any;
let awsSdkAvailable = false;
let awsSdkError: string | null = null;

// Dynamic AWS SDK loader with helpful error.messages
async function loadAwsSdk(): Promise<boolean> {
  if (awsSdkAvailable) return true;
  if (awsSdkError) return false;

  try {
    const awsS3 = await import('@aws-sdk/client-s3');
    S3Client = awsS3.S3Client;
    PutObjectCommand = awsS3.PutObjectCommand;
    GetObjectCommand = awsS3.GetObjectCommand;
    DeleteObjectCommand = awsS3.DeleteObjectCommand;
    awsSdkAvailable = true;
    logger.info('AWS SDK loaded successfully for backup functionality', LogContext.SYSTEM);
    return true;
  } catch (error) {
    awsSdkError = error instanceof Error ? error.message : 'Unknown errorloading AWS SDK';
    logger.warn('AWS SDK not available - S3 backup functionality disabled', LogContext.SYSTEM, {
      error awsSdkError,
      helpMessage: 'To enable S3 backups, install AWS SDK: npm install @aws-sdk/client-s3',
    });
    return false;
  }
}

// Helper function to provide installation guidance
function getAwsSdkInstallationHelp(): object {
  return {
    missing_dependency: '@aws-sdk/client-s3',
    installation_command: 'npm install @aws-sdk/client-s3',
    description: 'AWS SDK is required for S3 backup functionality',
    documentation: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/',
    alternatives: [
      'Use local file system backups (always available)',
      'Use Supabase storage for backups (configured automatically)',
    ],
    current_error awsSdkError,
  };
}

// Backup configuration schema
const BackupConfigSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string().default('0 2 * * *'), // 2 AM daily
  retention: z.object({
    daily: z.number().default(7),
    weekly: z.number().default(4),
    monthly: z.number().default(12),
  }),
  storage: z.object({
    local: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('./backups'),
    }),
    supabase: z.object({
      enabled: z.boolean().default(true),
      bucket: z.string().default('backups'),
    }),
    s3: z.object({
      enabled: z.boolean().default(false),
      bucket: z.string().optional(),
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
    }),
  }),
  encryption: z.object({
    enabled: z.boolean().default(true),
    algorithm: z.string().default('aes-256-gcm'),
    keyDerivation: z.string().default('scrypt'),
  }),
  tables: z
    .array(z.string())
    .default([
      'ai_memories',
      'ai_agents',
      'ai_knowledge_base',
      'ai_custom_tools',
      'ai_tool_executions',
      'ai_agent_executions',
      'ai_code_snippets',
      'ai_code_examples',
      'supabase_features',
      'supabase_integration_patterns',
    ]),
});

type BackupConfig = z.infer<typeof BackupConfigSchema>;

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  duration: number;
  tables: string[];
  rowCount: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  storage: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error: string;
}

export interface RestoreOptions {
  backupId: string;
  tables?: string[];
  targetSchema?: string;
  skipConstraints?: boolean;
  dryRun?: boolean;
}

export class BackupRecoveryService {
  private config: BackupConfig;
  private encryptionKey?: Buffer;
  private isRunning = false;
  private s3Client?: any; // S3Client when AWS SDK is installed

  constructor(
    private supabase: SupabaseClient,
    config: Partial<BackupConfig> = {}
  ) {
    this.config = BackupConfigSchema.parse(config);
    this.initializeEncryption();
    // S3 initialization is now lazy - happens when first needed
  }

  private initializeEncryption() {
    if (this.config.encryption.enabled) {
      const password = process.env.BACKUP_ENCRYPTION_PASSWORD;
      if (!password) {
        logger.warn(
          'Backup encryption enabled but BACKUP_ENCRYPTION_PASSWORD not set',
          LogContext.DATABASE
        );
        this.config.encryption.enabled = false;
        return;
      }

      // Derive encryption key from password
      const salt = Buffer.from(process.env.BACKUP_ENCRYPTION_SALT || 'default-salt');
      this.encryptionKey = crypto.scryptSync(password, salt, 32);
    }
  }

  /**
   * Initialize S3 client if enabled (lazy initialization)
   */
  private async ensureS3Initialized(): Promise<boolean> {
    if (this.config.storage.s3.enabled) {
      if (!this.config.storage.s3.accessKeyId || !this.config.storage.s3.secretAccessKey) {
        logger.warn('S3 storage enabled but credentials not provided', LogContext.DATABASE);
        this.config.storage.s3.enabled = false;
        return false;
      }

      // Try to load AWS SDK dynamically
      const sdkLoaded = await loadAwsSdk();
      if (!sdkLoaded) {
        logger.warn(
          'AWS SDK not available - S3 backup storage disabled',
          LogContext.DATABASE,
          getAwsSdkInstallationHelp()
        );
        this.config.storage.s3.enabled = false;
        return false;
      }

      // Initialize S3 client
      try {
        this.s3Client = new S3Client({
          region: this.config.storage.s3.region || 'us-east-1',
          credentials: {
            accessKeyId: this.config.storage.s3.accessKeyId!,
            secretAccessKey: this.config.storage.s3.secretAccessKey!,
          },
        });

        logger.info('S3 client initialized for backup storage', LogContext.DATABASE);
        return true;
      } catch (error) {
        logger.error('Failed to initialize S3 client', LogContext.DATABASE, { _error});
        this.config.storage.s3.enabled = false;
        return false;
      }
    }
    return false; // S3 not enabled
  }

  /**
   * Create a full backup of specified tables
   */
  async createBackup(
    options: {
      type?: 'full' | 'incremental' | 'differential';
      tables?: string[];
      compress?: boolean;
    } = {}
  ): Promise<BackupMetadata> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const backupId = this.generateBackupId();

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      type: options.type || 'full',
      size: 0,
      duration: 0,
      tables: options.tables || this.config.tables,
      rowCount: 0,
      compressed: options.compress !== false,
      encrypted: this.config.encryption.enabled,
      checksum: '',
      storage: [],
      status: 'in_progress',
    };

    try {
      logger.info(`Starting ${metadata.type} backup ${backupId}`, LogContext.DATABASE);

      // Create backup data
      const backupData = await this.exportTables(metadata.tables);
      metadata.rowCount = backupData.totalRows;

      // Serialize backup data
      const jsonData = JSON.stringify({
        metadata,
        data: backupData.tables,
        timestamp: new Date().toISOString(),
      });

      // Create backup buffer
      let backupBuffer = Buffer.from(jsonData);

      // Encrypt if enabled
      if (this.config.encryption.enabled && this.encryptionKey) {
        backupBuffer = await this.encryptData(backupBuffer);
      }

      // Calculate checksum
      metadata.checksum = crypto.createHash('sha256').update(backupBuffer).digest('hex');

      // Store backup in configured locations
      const storageResults = await this.storeBackup(backupId, backupBuffer, metadata.compressed);

      metadata.storage = storageResults.successful;
      metadata.size = backupBuffer.length;
      metadata.duration = Date.now() - startTime;
      metadata.status = 'completed';

      // Store metadata
      await this.storeBackupMetadata(metadata);

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.info(`Backup ${backupId} completed successfully`, LogContext.DATABASE, {
        duration: metadata.duration,
        size: metadata.size,
        rowCount: metadata.rowCount,
        storage: metadata.storage,
      });

      return metadata;
    } catch (error any) {
      logger.error(Backup ${backupId} failed: ${error.message}`, LogContext.DATABASE, { _error});
      metadata.status = 'failed';
      metadata.error= error.message;
      metadata.duration = Date.now() - startTime;

      await this.storeBackupMetadata(metadata);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Export tables data
   */
  private async exportTables(tables: string[]): Promise<{
    tables: Record<string, any[]>;
    totalRows: number;
  }> {
    const result: Record<string, any[]> = {};
    let totalRows = 0;

    for (const table of tables) {
      try {
        logger.debug(`Exporting table: ${table}`, LogContext.DATABASE);

        // Direct database query for backup operations
        const { data: tableData, error} = await this.supabase.from(table).select('*');

        if (error) throw error;
        const data = tableData || [];

        result[table] = data;
        totalRows += data.length;

        logger.debug(`Exported ${data.length} rows from ${table}`, LogContext.DATABASE);
      } catch (error any) {
        logger.error(Failed to export table ${table}: ${error.message}`, LogContext.DATABASE, {
          error
        });
        throw new Error(`Export failed for table ${table}: ${error.message}`);
      }
    }

    return { tables: result, totalRows };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encryptData(data: Buffer): Promise<Buffer> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.config.encryption.algorithm, this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    const authTag = (cipher as any).getAuthTag();

    // Combine IV + authTag + encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt data
   */
  private async decryptData(encryptedData: Buffer): Promise<Buffer> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Extract components
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv(
      this.config.encryption.algorithm,
      this.encryptionKey,
      iv
    );

    (decipher as any).setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Store backup in configured locations
   */
  private async storeBackup(
    backupId: string,
    data: Buffer,
    compress: boolean
  ): Promise<{ successful: string[]; failed: string[] }> {
    const results = {
      successful: [] as string[],
      failed: [] as string[],
    };

    // Local storage
    if (this.config.storage.local.enabled) {
      try {
        await this.storeLocalBackup(backupId, data, compress);
        results.successful.push('local');
      } catch (error any) {
        logger.error('Failed to store local backup', LogContext.DATABASE, { _error});
        results.failed.push('local');
      }
    }

    // Supabase storage
    if (this.config.storage.supabase.enabled) {
      try {
        await this.storeSupabaseBackup(backupId, data, compress);
        results.successful.push('supabase');
      } catch (error any) {
        logger.error('Failed to store Supabase backup', LogContext.DATABASE, { _error});
        results.failed.push('supabase');
      }
    }

    // S3 storage (if configured)
    if (this.config.storage.s3.enabled) {
      try {
        await this.storeS3Backup(backupId, data, compress);
        results.successful.push('s3');
      } catch (error any) {
        logger.error('Failed to store S3 backup', LogContext.DATABASE, { _error});
        results.failed.push('s3');
      }
    }

    if (results.successful.length === 0) {
      throw new Error('Failed to store backup in any location');
    }

    return results;
  }

  /**
   * Store backup locally
   */
  private async storeLocalBackup(backupId: string, data: Buffer, compress: boolean): Promise<void> {
    const backupDir = path.join(
      this.config.storage.local.path,
      new Date().toISOString().split('T')[0]
    );

    await mkdir(backupDir, { recursive: true });

    const filename = `${backupId}${compress ? '.gz' : ''}.backup`;
    const filepath = path.join(backupDir, filename);

    if (compress) {
      await pipeline(
        async function* () {
          yield data;
        },
        createGzip(),
        createWriteStream(filepath)
      );
    } else {
      await pipeline(async function* () {
        yield data;
      }, createWriteStream(filepath));
    }

    logger.debug(`Stored local backup: ${filepath}`, LogContext.DATABASE);
  }

  /**
   * Store backup in Supabase storage
   */
  private async storeSupabaseBackup(
    backupId: string,
    data: Buffer,
    compress: boolean
  ): Promise<void> {
    const filename = `${new Date().toISOString().split('T')[0]}/${backupId}${compress ? '.gz' : ''}.backup`;

    const { _error} = await this.supabase.storage
      .from(this.config.storage.supabase.bucket)
      .upload(filename, data, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) throw error;

    logger.debug(`Stored Supabase backup: ${filename}`, LogContext.DATABASE);
  }

  /**
   * Store backup in S3
   */
  private async storeS3Backup(backupId: string, data: Buffer, compress: boolean): Promise<void> {
    if (!this.s3Client || !this.config.storage.s3.bucket) {
      throw new Error('S3 client not initialized or bucket not configured');
    }

    const key = `backups/${new Date().toISOString().split('T')[0]}/${backupId}${compress ? '.gz' : ''}.backup`;

    try {
      let uploadData = data;

      // Compress if enabled
      if (compress) {
        uploadData = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const gzip = createGzip();

          gzip.on('data', (chunk) => chunks.push(chunk));
          gzip.on('end', () => resolve(Buffer.concat(chunks)));
          gzip.on('error, reject);

          gzip.write(data);
          gzip.end();
        });
      }

      const uploadParams: any = {
        Bucket: this.config.storage.s3.bucket,
        Key: key,
        Body: uploadData,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-id': backupId,
          'created-at': new Date().toISOString(),
          compressed: compress.toString(),
          encrypted: this.config.encryption.enabled.toString(),
        },
      };

      // Add server-side encryption if available
      if (process.env.S3_KMS_KEY_ID) {
        uploadParams.ServerSideEncryption = 'aws:kms';
        uploadParams.SSEKMSKeyId = process.env.S3_KMS_KEY_ID;
      } else {
        uploadParams.ServerSideEncryption = 'AES256';
      }

      // Ensure S3 is initialized
      const s3Ready = await this.ensureS3Initialized();
      if (!s3Ready) {
        throw new Error(
          `S3 upload failed: ${JSON.stringify(getAwsSdkInstallationHelp(), null, 2)}`
        );
      }

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      logger.debug(
        `Stored S3 backup: s3://${this.config.storage.s3.bucket}/${key}`,
        LogContext.DATABASE
      );
    } catch (error any) {
      logger.error('S3 backup upload failed', LogContext.DATABASE, { _error});
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<{
    success: boolean;
    tablesRestored: string[];
    rowsRestored: number;
    duration: number;
  }> {
    const startTime = Date.now();

    logger.info(`Starting restore from backup ${options.backupId}`, LogContext.DATABASE);

    try {
      // Load backup metadata
      const metadata = await this.loadBackupMetadata(options.backupId);
      if (!metadata) {
        throw new Error(`Backup ${options.backupId} not found`);
      }

      // Load backup data
      const backupData = await this.loadBackupData(options.backupId, metadata);

      // Validate backup
      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(backupData))
        .digest('hex');

      if (calculatedChecksum !== metadata.checksum) {
        throw new Error('Backup checksum validation failed');
      }

      // Dry run check
      if (options.dryRun) {
        logger.info('Dry run completed successfully', LogContext.DATABASE);
        return {
          success: true,
          tablesRestored: options.tables || metadata.tables,
          rowsRestored: metadata.rowCount,
          duration: Date.now() - startTime,
        };
      }

      // Restore tables
      const tablesToRestore = options.tables || metadata.tables;
      let rowsRestored = 0;

      for (const table of tablesToRestore) {
        if (!backupData.data[table]) {
          logger.warn(`Table ${table} not found in backup`, LogContext.DATABASE);
          continue;
        }

        const rows = backupData.data[table];
        logger.info(`Restoring ${rows.length} rows to ${table}`, LogContext.DATABASE);

        // Clear existing data if full restore
        if (!options.skipConstraints) {
          await this.supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        }

        // Insert data in batches
        const batchSize = 1000;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);

          const { _error} = await this.supabase.from(table).insert(batch);

          if (error {
            logger.error(Failed to restore batch for ${table}`, LogContext.DATABASE, { _error});
            throw error;
          }

          rowsRestored += batch.length;
        }

        logger.info(`Restored ${rows.length} rows to ${table}`, LogContext.DATABASE);
      }

      const duration = Date.now() - startTime;
      logger.info(`Restore completed successfully`, LogContext.DATABASE, {
        tablesRestored: tablesToRestore,
        rowsRestored,
        duration,
      });

      return {
        success: true,
        tablesRestored: tablesToRestore,
        rowsRestored,
        duration,
      };
    } catch (error any) {
      logger.error('Restore failed', LogContext.DATABASE, { _error});
      throw error;
    }
  }

  /**
   * Load backup metadata
   */
  private async loadBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const { data, error} = await this.supabase
      .from('backup_metadata')
      .select('*')
      .eq('id', backupId)
      .single();

    if (_error|| !data) return null;
    return data as BackupMetadata;
  }

  /**
   * Load backup data
   */
  private async loadBackupData(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    // Try to load from available storage locations
    for (const storage of metadata.storage) {
      try {
        switch (storage) {
          case 'local':
            return await this.loadLocalBackup(backupId, metadata);
          case 'supabase':
            return await this.loadSupabaseBackup(backupId, metadata);
          case 's3':
            return await this.loadS3Backup(backupId, metadata);
          default:
            logger.warn(`Unknown storage type: ${storage}`, LogContext.DATABASE);
        }
      } catch (error any) {
        logger.error(Failed to load backup from ${storage}`, LogContext.DATABASE, { _error});
      }
    }

    throw new Error('Failed to load backup from any storage location');
  }

  /**
   * Load local backup
   */
  private async loadLocalBackup(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${backupId}${metadata.compressed ? '.gz' : ''}.backup`;
    const filepath = path.join(this.config.storage.local.path, date, filename);

    let data: Buffer;

    if (metadata.compressed) {
      await pipeline(createReadStream(filepath), createGunzip(), async function* (source) {
        const chunks: Buffer[] = [];
        for await (const chunk of source) {
          chunks.push(chunk);
        }
        data = Buffer.concat(chunks);
      });
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of createReadStream(filepath)) {
        chunks.push(chunk as Buffer);
      }
      data = Buffer.concat(chunks);
    }

    if (metadata.encrypted && this.encryptionKey) {
      data = await this.decryptData(data!);
    }

    return JSON.parse(data!.toString());
  }

  /**
   * Load Supabase backup
   */
  private async loadSupabaseBackup(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    const { data: fileData, error} = await this.supabase.storage
      .from(this.config.storage.supabase.bucket)
      .download(filename);

    if (error) throw error;

    let data = Buffer.from(await fileData.arrayBuffer());

    if (metadata.compressed) {
      // Decompress
      data = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const gunzip = createGunzip();

        gunzip.on('data', (chunk) => chunks.push(chunk));
        gunzip.on('end', () => resolve(Buffer.concat(chunks)));
        gunzip.on('error, reject);

        gunzip.write(data);
        gunzip.end();
      });
    }

    if (metadata.encrypted && this.encryptionKey) {
      data = await this.decryptData(data);
    }

    return JSON.parse(data.toString());
  }

  /**
   * Load S3 backup
   */
  private async loadS3Backup(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    if (!this.s3Client || !this.config.storage.s3.bucket) {
      throw new Error('S3 client not initialized or bucket not configured');
    }

    const date = metadata.timestamp.toISOString().split('T')[0];
    const key = `backups/${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    try {
      const downloadParams = {
        Bucket: this.config.storage.s3.bucket,
        Key: key,
      };

      // Ensure S3 is initialized
      const s3Ready = await this.ensureS3Initialized();
      if (!s3Ready) {
        throw new Error(
          `S3 download failed: ${JSON.stringify(getAwsSdkInstallationHelp(), null, 2)}`
        );
      }

      const result = await this.s3Client.send(new GetObjectCommand(downloadParams));

      if (!result.Body) {
        throw new Error('Empty backup file received from S3');
      }

      // Convert stream to buffer for S3 response
      let data: Buffer;
      if (result.Body instanceof Buffer) {
        data = result.Body;
      } else {
        // Handle stream response from S3
        const chunks: Uint8Array[] = [];
        const reader = (result.Body as any).getReader();
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            chunks.push(value);
          }
        }

        data = Buffer.concat(chunks);
      }

      // Decompress if needed
      if (metadata.compressed) {
        data = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const gunzip = createGunzip();

          gunzip.on('data', (chunk) => chunks.push(chunk));
          gunzip.on('end', () => resolve(Buffer.concat(chunks)));
          gunzip.on('error, reject);

          gunzip.write(data);
          gunzip.end();
        });
      }

      // Decrypt if needed
      if (metadata.encrypted && this.encryptionKey) {
        data = await this.decryptData(data);
      }

      return JSON.parse(data.toString());
    } catch (error any) {
      logger.error('S3 backup download failed', LogContext.DATABASE, { _error});
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Store backup metadata
   */
  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const { _error} = await this.supabase.from('backup_metadata').upsert(metadata);

    if (error {
      logger.error('Failed to store backup metadata', LogContext.DATABASE, { _error});
      throw error;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    logger.info('Starting backup cleanup', LogContext.DATABASE);
    let deletedCount = 0;

    try {
      // Get all backups
      const { data: backups, error} = await this.supabase
        .from('backup_metadata')
        .select('*')
        .eq('status', 'completed')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      if (!backups || backups.length === 0) return 0;

      const now = new Date();
      const toDelete: string[] = [];

      // Group backups by date
      const backupsByDate = new Map<string, BackupMetadata[]>();
      for (const backup of backups) {
        const date = new Date(backup.timestamp).toISOString().split('T')[0];
        if (!backupsByDate.has(date)) {
          backupsByDate.set(date, []);
        }
        backupsByDate.get(date)!.push(backup);
      }

      // Apply retention policy
      const dates = Array.from(backupsByDate.keys()).sort().reverse();

      // Keep daily backups for configured days
      const dailyCutoff = new Date(now);
      dailyCutoff.setDate(dailyCutoff.getDate() - this.config.retention.daily);

      // Keep weekly backups for configured weeks
      const weeklyCutoff = new Date(now);
      weeklyCutoff.setDate(weeklyCutoff.getDate() - this.config.retention.weekly * 7);

      // Keep monthly backups for configured months
      const monthlyCutoff = new Date(now);
      monthlyCutoff.setMonth(monthlyCutoff.getMonth() - this.config.retention.monthly);

      for (const date of dates) {
        const backupDate = new Date(date);
        const backupsForDate = backupsByDate.get(date)!;

        // Keep the most recent backup for each date
        const [keep, ...rest] = backupsForDate.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Mark extra backups for deletion
        toDelete.push(...rest.map((b) => b.id));

        // Check retention policy
        if (backupDate < monthlyCutoff) {
          // Only keep if it's the first backup of the month
          if (backupDate.getDate() !== 1) {
            toDelete.push(keep.id);
          }
        } else if (backupDate < weeklyCutoff) {
          // Only keep if it's a Sunday
          if (backupDate.getDay() !== 0) {
            toDelete.push(keep.id);
          }
        } else if (backupDate < dailyCutoff) {
          // Delete daily backups older than retention period
          toDelete.push(keep.id);
        }
      }

      // Delete old backups
      for (const backupId of toDelete) {
        await this.deleteBackup(backupId);
        deletedCount++;
      }

      logger.info(`Cleaned up ${deletedCount} old backups`, LogContext.DATABASE);
      return deletedCount;
    } catch (error any) {
      logger.error('Backup cleanup failed', LogContext.DATABASE, { _error});
      throw error;
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    logger.debug(`Deleting backup ${backupId}`, LogContext.DATABASE);

    // Load metadata
    const metadata = await this.loadBackupMetadata(backupId);
    if (!metadata) return;

    // Delete from storage locations
    for (const storage of metadata.storage) {
      try {
        switch (storage) {
          case 'local':
            await this.deleteLocalBackup(backupId, metadata);
            break;
          case 'supabase':
            await this.deleteSupabaseBackup(backupId, metadata);
            break;
          case 's3':
            await this.deleteS3Backup(backupId, metadata);
            break;
        }
      } catch (error any) {
        logger.error(Failed to delete backup from ${storage}`, LogContext.DATABASE, { _error});
      }
    }

    // Delete metadata
    await this.supabase.from('backup_metadata').delete().eq('id', backupId);
  }

  /**
   * Delete local backup
   */
  private async deleteLocalBackup(backupId: string, metadata: BackupMetadata): Promise<void> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${backupId}${metadata.compressed ? '.gz' : ''}.backup`;
    const filepath = path.join(this.config.storage.local.path, date, filename);

    try {
      await unlink(filepath);
    } catch (error any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  /**
   * Delete Supabase backup
   */
  private async deleteSupabaseBackup(backupId: string, metadata: BackupMetadata): Promise<void> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    await this.supabase.storage.from(this.config.storage.supabase.bucket).remove([filename]);
  }

  /**
   * Delete S3 backup
   */
  private async deleteS3Backup(backupId: string, metadata: BackupMetadata): Promise<void> {
    if (!this.s3Client || !this.config.storage.s3.bucket) {
      logger.warn('S3 client not initialized or bucket not configured', LogContext.DATABASE);
      return;
    }

    const date = metadata.timestamp.toISOString().split('T')[0];
    const key = `backups/${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    try {
      const deleteParams = {
        Bucket: this.config.storage.s3.bucket,
        Key: key,
      };

      // Ensure S3 is initialized
      const s3Ready = await this.ensureS3Initialized();
      if (!s3Ready) {
        throw new Error(
          `S3 delete failed: ${JSON.stringify(getAwsSdkInstallationHelp(), null, 2)}`
        );
      }

      await this.s3Client.send(new DeleteObjectCommand(deleteParams));

      logger.debug(
        `Deleted S3 backup: s3://${this.config.storage.s3.bucket}/${key}`,
        LogContext.DATABASE
      );
    } catch (error any) {
      logger.error('S3 backup deletion failed', LogContext.DATABASE, { _error});
      throw new Error(`S3 deletion failed: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups(
    options: {
      limit?: number;
      offset?: number;
      status?: 'pending' | 'in_progress' | 'completed' | 'failed';
    } = {}
  ): Promise<{
    backups: BackupMetadata[];
    total: number;
  }> {
    let query = this.supabase
      .from('backup_metadata')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, count, error} = await query;

    if (error) throw error;

    return {
      backups: data || [],
      total: count || 0,
    };
  }

  /**
   * Get backup status
   */
  async getBackupStatus(): Promise<{
    lastBackup: Date | null;
    nextBackup: Date | null;
    isRunning: boolean;
    totalBackups: number;
    totalSize: number;
    storageUsage: Record<string, number>;
  }> {
    const { data: lastBackup } = await this.supabase
      .from('backup_metadata')
      .select('timestamp')
      .eq('status', 'completed')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const { data: stats } = await this.supabase.from('backup_metadata').select('size, storage');

    let totalSize = 0;
    const storageUsage: Record<string, number> = {};

    if (stats) {
      for (const backup of stats) {
        totalSize += backup.size || 0;
        for (const storage of backup.storage || []) {
          storageUsage[storage] = (storageUsage[storage] || 0) + (backup.size || 0);
        }
      }
    }

    // Calculate next backup time based on schedule
    const nextBackup = this.calculateNextBackupTime();

    return {
      lastBackup: lastBackup ? new Date(lastBackup.timestamp) : null,
      nextBackup,
      isRunning: this.isRunning,
      totalBackups: stats?.length || 0,
      totalSize,
      storageUsage,
    };
  }

  /**
   * Calculate next backup time based on cron schedule
   */
  private calculateNextBackupTime(): Date | null {
    const { schedule } = this.config.backup;
    if (!schedule) {
      return null;
    }

    try {
      // Parse cron expression: minute hour day month dayOfWeek
      const cronParts = schedule.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        throw new Error(`Invalid cron format: ${schedule}`);
      }

      const [minute, hour, day, month, dayOfWeek] = cronParts;
      const now = new Date();
      const next = new Date(now);

      // Handle special expressions
      if (schedule === '@daily' || schedule === '@midnight') {
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        return next;
      }

      if (schedule === '@hourly') {
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return next;
      }

      if (schedule === '@weekly') {
        next.setDate(next.getDate() + (7 - next.getDay()));
        next.setHours(0, 0, 0, 0);
        return next;
      }

      // Parse cron fields
      const nextMinute = this.parseField(minute, 0, 59, now.getMinutes());
      const nextHour = this.parseField(hour, 0, 23, now.getHours());
      const nextDay = this.parseField(day, 1, 31, now.getDate());
      const nextMonth = this.parseField(month, 1, 12, now.getMonth() + 1);
      const nextDayOfWeek = this.parseField(dayOfWeek, 0, 6, now.getDay());

      // Set the next execution time
      if (nextMinute !== null) next.setMinutes(nextMinute, 0, 0);
      if (nextHour !== null) next.setHours(nextHour);
      if (nextDay !== null) next.setDate(nextDay);
      if (nextMonth !== null) next.setMonth(nextMonth - 1);

      // Handle day of week constraint
      if (nextDayOfWeek !== null && dayOfWeek !== '*') {
        const currentDayOfWeek = next.getDay();
        const daysUntilTarget = (nextDayOfWeek - currentDayOfWeek + 7) % 7;
        if (daysUntilTarget > 0) {
          next.setDate(next.getDate() + daysUntilTarget);
        }
      }

      // If the calculated time is in the past, move to next occurrence
      if (next <= now) {
        // Move to next occurrence based on the most specific field
        if (minute !== '*') {
          next.setHours(next.getHours() + 1);
        } else if (hour !== '*') {
          next.setDate(next.getDate() + 1);
        } else {
          next.setDate(next.getDate() + 1);
        }
      }

      return next;
    } catch (error) {
      logger.error('Failed to parse cron schedule:', error);
      // Fallback to daily at 2 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      return tomorrow;
    }
  }

  /**
   * Parse a cron field (minute, hour, day, etc.)
   */
  private parseField(field: string, min: number, max: number, current: number): number | null {
    // Wildcard - no constraint
    if (field === '*') {
      return null;
    }

    // Specific value
    if (/^\d+$/.test(field)) {
      const value = parseInt(field, 10);
      if (value >= min && value <= max) {
        return value;
      }
      throw new Error(`Value ${value} out of range [${min}-${max}]`);
    }

    // Range (e.g., "1-5")
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      if (start >= min && end <= max && start <= end) {
        // Return the next value in range
        if (current >= start && current <= end) {
          return current;
        }
        return current < start ? start : start; // Wrap around
      }
      throw new Error(`Invalid range: ${field}`);
    }

    // Step values (e.g., "*/5" for every 5 units)
    if (field.includes('/')) {
      const [range, step] = field.split('/');
      const stepValue = parseInt(step, 10);

      if (range === '*') {
        // Find next step from current
        const next = Math.ceil((current + 1) / stepValue) * stepValue;
        return next <= max ? next : min;
      }

      // Range with step (e.g., "1-10/2")
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        let next = Math.ceil((current - start + 1) / stepValue) * stepValue + start;
        if (next > end) {
          next = start; // Wrap to beginning of range
        }
        return next;
      }
    }

    // List of values (e.g., "1,3,5")
    if (field.includes(',')) {
      const values = field
        .split(',')
        .map(Number)
        .sort((a, b) => a - b);
      for (const value of values) {
        if (value < min || value > max) {
          throw new Error(`Value ${value} out of range [${min}-${max}]`);
        }
        if (value > current) {
          return value;
        }
      }
      // If no value is greater than current, return the first value
      return values[0];
    }

    throw new Error(`Invalid cron field: ${field}`);
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Load metadata
      const metadata = await this.loadBackupMetadata(backupId);
      if (!metadata) {
        errors.push('Backup metadata not found');
        return { valid: false, errors };
      }

      // Try to load backup data
      const backupData = await this.loadBackupData(backupId, metadata);

      // Verify structure
      if (!backupData.data || typeof backupData.data !== 'object') {
        errors.push('Invalid backup data structure');
      }

      // Verify tables
      for (const table of metadata.tables) {
        if (!backupData.data[table]) {
          errors.push(`Missing table: ${table}`);
        }
      }

      // Verify row count
      let actualRowCount = 0;
      for (const table of Object.values(backupData.data)) {
        if (Array.isArray(table)) {
          actualRowCount += table.length;
        }
      }

      if (actualRowCount !== metadata.rowCount) {
        errors.push(`Row count mismatch: expected ${metadata.rowCount}, got ${actualRowCount}`);
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error any) {
      errors.push(`Verification failed: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }
}

// Export factory function
export function createBackupRecoveryService(
  supabase: SupabaseClient,
  config?: Partial<BackupConfig>
): BackupRecoveryService {
  return new BackupRecoveryService(supabase, config);
}
