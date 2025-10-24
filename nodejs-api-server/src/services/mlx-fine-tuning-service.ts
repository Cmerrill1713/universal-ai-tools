/**
 * MLX Fine-Tuning Service
 * Custom model training and optimization using MLX framework
 */

import { createClient } from '@supabase/supabase-js';
import { MLXIntegrationService, MLXTrainingRequest, MLXTrainingResponse } from './mlx-integration';
import fs from 'fs';
import path from 'path';

interface FineTuningJob {
  id: string;
  name: string;
  description: string;
  baseModel: string;
  modelProvider?: 'mlx' | 'ollama' | 'huggingface'; // Model provider
  trainingData: any[];
  config: FineTuningConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  results?: FineTuningResults;
  error?: string;
  userId: string;
}

interface FineTuningConfig {
  epochs: number;
  learningRate: number;
  batchSize: number;
  validationSplit: number;
  optimization: 'lora' | 'qlora' | 'full';
  targetModules?: string[];
  rank?: number;
  alpha?: number;
  dropout?: number;
  maxLength: number;
  warmupSteps: number;
  weightDecay: number;
  gradientAccumulationSteps: number;
  saveSteps: number;
  evalSteps: number;
  loggingSteps: number;
}

interface FineTuningResults {
  modelPath: string;
  trainingMetrics: {
    finalLoss: number;
    bestLoss: number;
    epochs: number;
    trainingTime: number;
    tokensProcessed: number;
  };
  validationMetrics: {
    accuracy: number;
    perplexity: number;
    bleuScore?: number;
    rougeScore?: number;
  };
  modelSize: number;
  quantizationInfo?: any;
  performanceMetrics: {
    inferenceSpeed: number;
    memoryUsage: number;
    gpuUtilization: number;
  };
}

interface DatasetConfig {
  name: string;
  format: 'jsonl' | 'csv' | 'txt' | 'conversation';
  path: string;
  columns: {
    input: string;
    output: string;
    instruction?: string;
  };
  preprocessing?: {
    tokenization: 'auto' | 'custom';
    maxLength: number;
    truncation: boolean;
    padding: boolean;
  };
}

class MLXFineTuningService {
  private mlxService: MLXIntegrationService;
  private supabase: any;
  private jobs: Map<string, FineTuningJob> = new Map();
  private datasets: Map<string, DatasetConfig> = new Map();
  private modelsPath: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.mlxService = new MLXIntegrationService();
    this.modelsPath = process.env.MLX_MODELS_PATH || './models/mlx';
    this.initializeDatasets();
  }

  /**
   * Initialize MLX Fine-Tuning Service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎯 Initializing MLX Fine-Tuning Service...');
      
      // Initialize MLX service
      await this.mlxService.initialize();
      
      // Ensure models directory exists
      if (!fs.existsSync(this.modelsPath)) {
        fs.mkdirSync(this.modelsPath, { recursive: true });
      }
      
      // Load existing jobs from database
      await this.loadExistingJobs();
      
      console.log('✅ MLX Fine-Tuning Service initialized successfully');
    } catch (error) {
      console.error('❌ MLX Fine-Tuning Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize default datasets
   */
  private initializeDatasets(): void {
    const defaultDatasets: DatasetConfig[] = [
      {
        name: 'conversation_dataset',
        format: 'conversation',
        path: './datasets/conversations.jsonl',
        columns: {
          input: 'user_message',
          output: 'assistant_response',
          instruction: 'system_prompt'
        },
        preprocessing: {
          tokenization: 'auto',
          maxLength: 2048,
          truncation: true,
          padding: true
        }
      },
      {
        name: 'code_generation_dataset',
        format: 'jsonl',
        path: './datasets/code_generation.jsonl',
        columns: {
          input: 'description',
          output: 'code',
          instruction: 'Generate code based on the description'
        },
        preprocessing: {
          tokenization: 'auto',
          maxLength: 4096,
          truncation: true,
          padding: true
        }
      },
      {
        name: 'analysis_dataset',
        format: 'jsonl',
        path: './datasets/analysis.jsonl',
        columns: {
          input: 'text',
          output: 'analysis',
          instruction: 'Analyze the following text'
        },
        preprocessing: {
          tokenization: 'auto',
          maxLength: 1024,
          truncation: true,
          padding: true
        }
      }
    ];

    defaultDatasets.forEach(dataset => {
      this.datasets.set(dataset.name, dataset);
    });
  }

  /**
   * Create a new fine-tuning job
   */
  async createFineTuningJob(
    name: string,
    description: string,
    baseModel: string,
    trainingData: any[],
    config: FineTuningConfig,
    userId: string,
    modelProvider?: 'mlx' | 'ollama' | 'huggingface'
  ): Promise<FineTuningJob> {
    try {
      console.log(`🎯 Creating fine-tuning job: ${name}`);

      const jobId = this.generateJobId();
      const job: FineTuningJob = {
        id: jobId,
        name,
        description,
        baseModel,
        modelProvider: modelProvider || 'mlx',
        trainingData,
        config,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
        userId
      };

      this.jobs.set(jobId, job);

      // Store in database
      await this.supabase
        .from('mlx_fine_tuning_jobs')
        .insert([{
          id: jobId,
          name,
          description,
          base_model: baseModel,
          training_data: trainingData,
          config: config,
          status: 'pending',
          progress: 0,
          created_at: job.createdAt.toISOString(),
          user_id: userId
        }]);

      console.log(`✅ Fine-tuning job created: ${jobId}`);
      return job;

    } catch (error) {
      console.error('Error creating fine-tuning job:', error);
      throw error;
    }
  }

  /**
   * Start a fine-tuning job
   */
  async startFineTuningJob(jobId: string): Promise<FineTuningJob> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (job.status !== 'pending') {
        throw new Error(`Job cannot be started. Current status: ${job.status}`);
      }

      console.log(`🚀 Starting fine-tuning job: ${jobId}`);

      // Update job status
      job.status = 'running';
      job.startedAt = new Date();
      job.progress = 0;

      // Update database
      await this.supabase
        .from('mlx_fine_tuning_jobs')
        .update({
          status: 'running',
          started_at: job.startedAt.toISOString(),
          progress: 0
        })
        .eq('id', jobId);

      // Start training in background
      this.executeFineTuningJob(job).catch(error => {
        console.error(`Fine-tuning job ${jobId} failed:`, error);
        this.updateJobStatus(jobId, 'failed', 0, error.message);
      });

      return job;

    } catch (error) {
      console.error('Error starting fine-tuning job:', error);
      throw error;
    }
  }

  /**
   * Execute fine-tuning job
   */
  private async executeFineTuningJob(job: FineTuningJob): Promise<void> {
    try {
      console.log(`🎯 Executing fine-tuning job: ${job.id}`);

      // Prepare training data
      const trainingData = await this.prepareTrainingData(job.trainingData, job.config);
      
      // Create MLX training request
      const mlxRequest: MLXTrainingRequest = {
        modelName: `${job.name}_${job.id}`,
        trainingData: trainingData,
        epochs: job.config.epochs,
        learningRate: job.config.learningRate,
        batchSize: job.config.batchSize,
        validationSplit: job.config.validationSplit
      };

      // Execute training
      const mlxResponse = await this.mlxService.trainModel(mlxRequest);

      if (mlxResponse.success) {
        // Create results
        const results: FineTuningResults = {
          modelPath: mlxResponse.modelPath,
          trainingMetrics: {
            finalLoss: mlxResponse.trainingMetrics.loss || 0,
            bestLoss: mlxResponse.trainingMetrics.loss || 0,
            epochs: job.config.epochs,
            trainingTime: mlxResponse.trainingTime,
            tokensProcessed: trainingData.length * job.config.maxLength
          },
          validationMetrics: {
            accuracy: mlxResponse.trainingMetrics.accuracy || 0,
            perplexity: 0, // Calculate if needed
            bleuScore: 0, // Calculate if needed
            rougeScore: 0 // Calculate if needed
          },
          modelSize: await this.calculateModelSize(mlxResponse.modelPath),
          performanceMetrics: {
            inferenceSpeed: 0, // Measure if needed
            memoryUsage: 0, // Measure if needed
            gpuUtilization: 0 // Measure if needed
          }
        };

        // Update job with results
        job.status = 'completed';
        job.completedAt = new Date();
        job.progress = 100;
        job.results = results;

        await this.updateJobStatus(job.id, 'completed', 100, undefined, results);

        console.log(`✅ Fine-tuning job completed: ${job.id}`);

      } else {
        throw new Error(mlxResponse.error || 'Training failed');
      }

    } catch (error) {
      console.error(`Fine-tuning job ${job.id} execution failed:`, error);
      await this.updateJobStatus(job.id, 'failed', 0, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Prepare training data
   */
  private async prepareTrainingData(trainingData: any[], config: FineTuningConfig): Promise<any[]> {
    // Convert training data to MLX format
    return trainingData.map(item => ({
      input: item.input || item.prompt || item.question,
      output: item.output || item.response || item.answer,
      instruction: item.instruction || item.system || ''
    }));
  }

  /**
   * Calculate model size
   */
  private async calculateModelSize(modelPath: string): Promise<number> {
    try {
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        return stats.size;
      }
      return 0;
    } catch (error) {
      console.warn('Could not calculate model size:', error);
      return 0;
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string, 
    status: string, 
    progress: number, 
    error?: string, 
    results?: FineTuningResults
  ): Promise<void> {
    try {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = status as any;
        job.progress = progress;
        if (error) job.error = error;
        if (results) job.results = results;
        if (status === 'completed') job.completedAt = new Date();
      }

      // Update database
      const updateData: any = {
        status,
        progress,
        updated_at: new Date().toISOString()
      };

      if (error) updateData.error = error;
      if (results) updateData.results = results;
      if (status === 'completed') updateData.completed_at = new Date().toISOString();

      await this.supabase
        .from('mlx_fine_tuning_jobs')
        .update(updateData)
        .eq('id', jobId);

    } catch (error) {
      console.error('Error updating job status:', error);
    }
  }

  /**
   * Load existing jobs from database
   */
  private async loadExistingJobs(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('mlx_fine_tuning_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not load existing jobs:', error);
        return;
      }

      data?.forEach((jobData: any) => {
        const job: FineTuningJob = {
          id: jobData.id,
          name: jobData.name,
          description: jobData.description,
          baseModel: jobData.base_model,
          trainingData: jobData.training_data || [],
          config: jobData.config || {},
          status: jobData.status || 'pending',
          progress: jobData.progress || 0,
          createdAt: new Date(jobData.created_at),
          startedAt: jobData.started_at ? new Date(jobData.started_at) : undefined,
          completedAt: jobData.completed_at ? new Date(jobData.completed_at) : undefined,
          results: jobData.results,
          error: jobData.error,
          userId: jobData.user_id
        };

        this.jobs.set(job.id, job);
      });

      console.log(`📚 Loaded ${this.jobs.size} existing fine-tuning jobs`);

    } catch (error) {
      console.warn('Error loading existing jobs:', error);
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): FineTuningJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): FineTuningJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by user
   */
  getJobsByUser(userId: string): FineTuningJob[] {
    return Array.from(this.jobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        return false;
      }

      if (job.status === 'running') {
        // In a real implementation, you would stop the training process
        job.status = 'cancelled';
        await this.updateJobStatus(jobId, 'cancelled', job.progress);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return false;
    }
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        return false;
      }

      // Remove from memory
      this.jobs.delete(jobId);

      // Remove from database
      await this.supabase
        .from('mlx_fine_tuning_jobs')
        .delete()
        .eq('id', jobId);

      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
    }
  }

  /**
   * Get available datasets
   */
  getAvailableDatasets(): DatasetConfig[] {
    return Array.from(this.datasets.values());
  }

  /**
   * Add custom dataset
   */
  addDataset(dataset: DatasetConfig): void {
    this.datasets.set(dataset.name, dataset);
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    const mlxStatus = await this.mlxService.getStatus();
    
    return {
      initialized: true,
      mlxStatus,
      jobsCount: this.jobs.size,
      datasetsCount: this.datasets.size,
      modelsPath: this.modelsPath,
      availableDatasets: this.getAvailableDatasets().map(d => ({
        name: d.name,
        format: d.format,
        path: d.path
      })),
      recentJobs: this.getAllJobs()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 5)
        .map(job => ({
          id: job.id,
          name: job.name,
          status: job.status,
          progress: job.progress,
          createdAt: job.createdAt
        }))
    };
  }

  /**
   * Generate job ID
   */
  private generateJobId(): string {
    return `ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    await this.mlxService.shutdown();
    console.log('🛑 MLX Fine-Tuning Service shutdown');
  }
}

export { MLXFineTuningService, FineTuningJob, FineTuningConfig, FineTuningResults, DatasetConfig };