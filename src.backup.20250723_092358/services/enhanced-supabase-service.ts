/**
 * Enhanced Supabase Service
 * Comprehensive integration utilizing all Supabase features:
 * - Storage for file uploads
 * - Realtime for live updates
 * - Edge Functions for file processing
 * - Vector DB for semantic search
 * - Auth for secure access
 * - Database for metadata
 * - Queues for background operations
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import FormData from 'form-data';
import { createHash } from 'crypto';

// Types for enhanced features
interface FileUploadOptions {
  bucket: string;
  path: string;
  file: Buffer | Blob | File;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

interface RealtimeSubscription {
  channel: string;
  event: string;
  callback: (payload: any) => void;
}

interface EdgeFunctionCall {
  functionName: string;
  payload: any;
  headers?: Record<string, string>;
}

interface VectorSearchOptions {
  collection: string;
  embedding: number[];
  limit?: number;
  threshold?: number;
  filter?: Record<string, unknown>;
}

interface QueueJob {
  queue: string;
  jobType: string;
  payload: any;
  delay?: number;
  priority?: number;
}

export class EnhancedSupabaseService {
  private static instance: EnhancedSupabaseService;
  public client: SupabaseClient;
  private realtimeChannels: Map<string, RealtimeChannel> = new Map();
  private fileProcessingQueue = 'file_processing';
  private aiProcessingQueue = 'ai_processing';

  private constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.warn('Supabase credentials not found in environment variables');
    }

    // Use service key for server-side operations if available
    const key = supabaseServiceKey || supabaseAnonKey;

    this.client = createClient(supabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });

    logger.info('🚀 Enhanced Supabase service initialized with full feature set');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EnhancedSupabaseService {
    if (!EnhancedSupabaseService.instance) {
      EnhancedSupabaseService.instance = new EnhancedSupabaseService();
    }
    return EnhancedSupabaseService.instance;
  }

  // =====================================================
  // STORAGE FEATURES
  // =====================================================

  /**
   * Upload file to Supabase Storage with metadata
   */
  public async uploadFile(options: FileUploadOptions): Promise<{
    url: string;
    path: string;
    id: string;
    metadata?: any;
  }> {
    try {
      const { bucket, path, file, contentType, metadata } = options;

      // Generate file hash for deduplication
      const fileHash = await this.generateFileHash(file);

      // Check if file already exists
      const existingFile = await this.findFileByHash(bucket, fileHash);
      if (existingFile) {
        logger.info(`File already exists: ${existingFile.path}`);
        return existingFile;
      }

      // Upload file
      const { data, error} = await this.client.storage.from(bucket).upload(path, file, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      });

      if (_error throw error;

      // Get public URL
      const {
        data: { publicUrl },
      } = this.client.storage.from(bucket).getPublicUrl(data.path);

      // Store metadata in database
      const fileRecord = await this.saveFileMetadata({
        bucket,
        path: data.path,
        hash: fileHash,
        size: file instanceof Buffer ? file.length : (file as File).size,
        content_type: contentType,
        metadata,
        public_url: publicUrl,
      });

      // Trigger processing via Edge Function
      await this.triggerFileProcessing(fileRecord.id);

      return {
        url: publicUrl,
        path: data.path,
        id: fileRecord.id,
        metadata: fileRecord.metadata,
      };
    } catch (error) {
      logger.error('Failed to upload file:', LogContext.STORAGE, { _error});
      throw error;
    }
  }

  /**
   * Download file from Storage
   */
  public async downloadFile(bucket: string, path: string): Promise<Buffer> {
    try {
      const { data, error} = await this.client.storage.from(bucket).download(path);

      if (_error throw error;

      const buffer = Buffer.from(await data.arrayBuffer());
      return buffer;
    } catch (error) {
      logger.error('Failed to download file:', LogContext.STORAGE, { _error});
      throw error;
    }
  }

  /**
   * List files in a bucket with pagination
   */
  public async listFiles(
    bucket: string,
    options?: {
      path?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'name' | 'created_at' | 'updated_at';
    }
  ) {
    try {
      const { data, error} = await this.client.storage.from(bucket).list(options?.path, {
        limit: options?.limit || 100,
        offset: options?.offset || 0,
        sortBy: {
          column: options?.sortBy || 'created_at',
          order: 'desc',
        },
      });

      if (_error throw error;
      return data;
    } catch (error) {
      logger.error('Failed to list files:', LogContext.STORAGE, { _error});
      throw error;
    }
  }

  // =====================================================
  // REALTIME FEATURES
  // =====================================================

  /**
   * Subscribe to realtime updates
   */
  public subscribeToRealtime(subscription: RealtimeSubscription): () => void {
    const { channel, event, callback } = subscription;

    // Get or create channel
    let realtimeChannel = this.realtimeChannels.get(channel);
    if (!realtimeChannel) {
      realtimeChannel = this.client.channel(channel);
      this.realtimeChannels.set(channel, realtimeChannel);
    }

    // Subscribe to event
    realtimeChannel.on(event as any, {} as any, callback);

    // Start listening
    realtimeChannel.subscribe((status) => {
      logger.info(`Realtime subscription ${channel} status: ${status}`);
    });

    // Return unsubscribe function
    return () => {
      realtimeChannel?.unsubscribe();
      this.realtimeChannels.delete(channel);
    };
  }

  /**
   * Subscribe to database changes
   */
  public subscribeToDatabaseChanges(
    table: string,
    callback: (payload: any) => void,
    filter?: Record<string, unknown>
  ): () => void {
    const channel = this.client
      .channel(`db-changes-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        callback
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }

  /**
   * Broadcast message to realtime channel
   */
  public async broadcastMessage(channel: string, event: string, payload: any): Promise<void> {
    try {
      const realtimeChannel = this.client.channel(channel);

      await realtimeChannel.send({
        type: 'broadcast',
        event,
        payload,
      });

      logger.info(`Broadcasted message to ${channel}:${event}`);
    } catch (error) {
      logger.error('Failed to broadcast message:', LogContext.REALTIME, { _error});
      throw error;
    }
  }

  // =====================================================
  // EDGE FUNCTIONS FEATURES
  // =====================================================

  /**
   * Call Edge Function for processing
   */
  public async callEdgeFunction(options: EdgeFunctionCall): Promise<unknown> {
    try {
      const { functionName, payload, headers = {} } = options;

      const { data, error} = await this.client.functions.invoke(functionName, {
        body: payload,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      if (_error throw error;
      return data;
    } catch (error) {
      logger.error('Failed to call edge function:', LogContext.FUNCTIONS, { _error});
      throw error;
    }
  }

  /**
   * Process file using Edge Function
   */
  public async processFileWithAI(fileId: string, processingType: string): Promise<unknown> {
    return this.callEdgeFunction({
      functionName: 'process-file',
      payload: {
        fileId,
        processingType,
        options: {
          extractText: true,
          generateEmbeddings: true,
          detectObjects: true,
          extractMetadata: true,
        },
      },
    });
  }

  // =====================================================
  // VECTOR DATABASE FEATURES
  // =====================================================

  /**
   * Store embeddings in vector database
   */
  public async storeEmbedding(
    collection: string,
    content string,
    embedding: number[],
    metadata?: any
  ): Promise<unknown> {
    try {
      const { data, error} = await this.client
        .from(`${collection}_embeddings`)
        .insert({
          content
          embedding,
          metadata,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (_error throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store embedding:', LogContext.DATABASE, { _error});
      throw error;
    }
  }

  /**
   * Semantic search using vector similarity
   */
  public async semanticSearch(options: VectorSearchOptions): Promise<any[]> {
    try {
      const { collection, embedding, limit = 10, threshold = 0.7, filter } = options;

      // Use RPC function for vector search
      const { data, error} = await this.client.rpc(`search_${collection}_semantic`, {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit,
        filter_params: filter,
      });

      if (_error throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to perform semantic search:', LogContext.DATABASE, { _error});
      throw error;
    }
  }

  /**
   * Hybrid search combining vector and text search
   */
  public async hybridSearch(
    collection: string,
    query: string,
    embedding: number[],
    options?: {
      limit?: number;
      textWeight?: number;
      vectorWeight?: number;
    }
  ): Promise<any[]> {
    try {
      const { limit = 10, textWeight = 0.5, vectorWeight = 0.5 } = options || {};

      const { data, error} = await this.client.rpc(`hybrid_search_${collection}`, {
        text_query: query,
        query_embedding: embedding,
        match_count: limit,
        text_weight: textWeight,
        vector_weight: vectorWeight,
      });

      if (_error throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to perform hybrid search:', LogContext.DATABASE, { _error});
      throw error;
    }
  }

  // =====================================================
  // AUTH FEATURES
  // =====================================================

  /**
   * Create authenticated upload URL
   */
  public async createSignedUploadUrl(
    bucket: string,
    path: string,
    expiresIn = 3600
  ): Promise<{ signedUrl: string; token: string }> {
    try {
      const { data, error} = await this.client.storage
        .from(bucket)
        .createSignedUploadUrl(path, expiresIn);

      if (_error throw error;
      return data;
    } catch (error) {
      logger.error('Failed to create signed upload URL:', LogContext.AUTH, { _error});
      throw error;
    }
  }

  /**
   * Verify user permissions for resource
   */
  public async verifyResourceAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const { data, error} = await this.client.rpc('check_resource_permission', {
        user_id: userId,
        resource_type: resourceType,
        resource_id: resourceId,
        permission,
      });

      if (_error throw error;
      return data || false;
    } catch (error) {
      logger.error('Failed to verify resource access:', LogContext.AUTH, { _error});
      return false;
    }
  }

  // =====================================================
  // QUEUE FEATURES
  // =====================================================

  /**
   * Add job to processing queue
   */
  public async addToQueue(job: QueueJob): Promise<string> {
    try {
      const { data, error} = await this.client
        .from('job_queue')
        .insert({
          queue_name: job.queue,
          job_type: job.jobType,
          payload: job.payload,
          priority: job.priority || 5,
          scheduled_for: job.delay
            ? new Date(Date.now() + job.delay).toISOString()
            : new Date().toISOString(),
          status: 'pending',
        })
        .select('id')
        .single();

      if (_error throw error;

      // Notify queue processor via realtime
      await this.broadcastMessage(`queue:${job.queue}`, 'new_job', {
        jobId: data.id,
        jobType: job.jobType,
      });

      return data.id;
    } catch (error) {
      logger.error('Failed to add job to queue:', LogContext.QUEUE, { _error});
      throw error;
    }
  }

  /**
   * Process queue jobs
   */
  public async processQueue(
    queueName: string,
    processor: (job: any) => Promise<unknown>
  ): Promise<void> {
    // Subscribe to queue updates
    this.subscribeToDatabaseChanges(
      'job_queue',
      async (payload) => {
        if (payload.new?.queue_name === queueName && payload.new?.status === 'pending') {
          try {
            // Update job status to processing
            await this.client
              .from('job_queue')
              .update({ status: 'processing', started_at: new Date().toISOString() })
              .eq('id', payload.new.id);

            // Process job
            const result = await processor(payload.new);

            // Update job status to completed
            await this.client
              .from('job_queue')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                result,
              })
              .eq('id', payload.new.id);
          } catch (error) {
            // Update job status to failed
            await this.client
              .from('job_queue')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : String(_error,
                failed_at: new Date().toISOString(),
              })
              .eq('id', payload.new.id);
          }
        }
      },
      { queue_name: queueName, status: 'eq.pending' }
    );
  }

  // =====================================================
  // INTEGRATED AI PROCESSING
  // =====================================================

  /**
   * Process uploaded file through complete AI pipeline
   */
  public async processFileWithFullPipeline(
    fileId: string,
    options?: {
      extractText?: boolean;
      generateSummary?: boolean;
      extractEntities?: boolean;
      generateEmbeddings?: boolean;
      classifyContent?: boolean;
    }
  ): Promise<unknown> {
    try {
      // Add to processing queue
      const jobId = await this.addToQueue({
        queue: this.aiProcessingQueue,
        jobType: 'full_file_processing',
        payload: {
          fileId,
          options: {
            extractText: true,
            generateSummary: true,
            extractEntities: true,
            generateEmbeddings: true,
            classifyContent: true,
            ...options,
          },
        },
        priority: 3,
      });

      // Subscribe to job updates
      return new Promise((resolve, reject) => {
        const unsubscribe = this.subscribeToDatabaseChanges(
          'job_queue',
          (payload) => {
            if (payload.new?.id === jobId) {
              if (payload.new.status === 'completed') {
                unsubscribe();
                resolve(payload.new.result);
              } else if (payload.new.status === 'failed') {
                unsubscribe();
                reject(new Error(payload.new.error_message));
              }
            }
          },
          { id: `eq.${jobId}` }
        );
      });
    } catch (error) {
      logger.error('Failed to process file with AI pipeline:', LogContext.AI, { _error});
      throw error;
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private async generateFileHash(file: Buffer | Blob | File): Promise<string> {
    const buffer = file instanceof Buffer ? file : Buffer.from(await (file as Blob).arrayBuffer());

    return createHash('sha256').update(buffer).digest('hex');
  }

  private async findFileByHash(bucket: string, hash: string): Promise<unknown> {
    const { data } = await this.client
      .from('file_metadata')
      .select('*')
      .eq('bucket', bucket)
      .eq('hash', hash)
      .single();

    return data;
  }

  private async saveFileMetadata(metadata: any): Promise<unknown> {
    const { data, error} = await this.client
      .from('file_metadata')
      .insert(metadata)
      .select()
      .single();

    if (_error throw error;
    return data;
  }

  private async triggerFileProcessing(fileId: string): Promise<void> {
    await this.callEdgeFunction({
      functionName: 'trigger-file-processing',
      payload: { fileId },
    });
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    // Unsubscribe from all realtime channels
    this.realtimeChannels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.realtimeChannels.clear();
  }
}

// Export singleton instance
export const enhancedSupabase = EnhancedSupabaseService.getInstance();
