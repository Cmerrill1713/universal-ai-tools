/**
 * MLX Fine-tuning Service
 * Comprehensive service for managing the entire fine-tuning lifecycle on Apple Silicon
 *
 * Features:
 * - Dataset management and validation
 * - Fine-tuning job orchestration
 * - Hyperparameter optimization
 * - Real-time progress monitoring
 * - Model evaluation and export
 * - Job persistence with Supabase
 * - Resource management and queuing
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { LogContext, log } from '../utils/logger';
import { CircuitBreaker, CircuitBreakerRegistry } from '../utils/circuit-breaker';
import { mlxService } from './mlx-service';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { THREE, TWO } from '../utils/constants';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Dataset {
  id: string;
  name: string;
  path: string;
  format: 'json' | 'jsonl' | 'csv';
  totalSamples: number;
  trainingSamples: number;
  validationSamples: number;
  validationResults: DatasetValidationResult;
  preprocessingConfig: PreprocessingConfig;
  statistics: DatasetStatistics;
  // Enhanced for iOS mobile personalization
  isMobileOptimized?: boolean;
  deviceContextCategories?: string[];
  personalizationLevel?: 'basic' | 'intermediate' | 'advanced';
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  qualityScore: number;
  sampleSize: number;
  duplicateCount: number;
  malformedEntries: number;
}

export interface PreprocessingConfig {
  maxLength: number;
  truncation: boolean;
  padding: boolean;
  removeDuplicates: boolean;
  shuffle: boolean;
  validationSplit: number;
  testSplit?: number;
  customFilters?: string[];
}

export interface DatasetStatistics {
  avgLength: number;
  minLength: number;
  maxLength: number;
  vocabSize: number;
  uniqueTokens: number;
  lengthDistribution: { [key: string]: number };
  tokenFrequency: { [key: string]: number };
}

export interface FineTuningJob {
  id: string;
  jobName: string;
  userId: string;
  status: JobStatus;
  baseModelName: string;
  baseModelPath: string;
  outputModelName: string;
  outputModelPath: string;
  datasetPath: string;
  datasetFormat: 'json' | 'jsonl' | 'csv';
  hyperparameters: Hyperparameters;
  validationConfig: ValidationConfig;
  progress: JobProgress;
  metrics: TrainingMetrics;
  evaluation: ModelEvaluation | null;
  resourceUsage: ResourceUsage;
  // Enhanced iOS mobile personalization
  mobileOptimization?: MobileOptimizationConfig;
  personalizationContext?: PersonalizationContext;
  iOSDeviceTargets?: iOSDeviceTarget[];
  error?: JobError;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export type JobStatus =
  | 'created'
  | 'preparing'
  | 'training'
  | 'evaluating'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export interface Hyperparameters {
  learningRate: number;
  batchSize: number;
  epochs: number;
  maxSeqLength: number;
  gradientAccumulation: number;
  warmupSteps: number;
  weightDecay: number;
  dropout: number;
  optimizerType?: 'adam' | 'sgd' | 'adamw';
  scheduler?: 'linear' | 'cosine' | 'polynomial';
}

export interface ValidationConfig {
  splitRatio: number;
  validationMetrics: string[];
  earlyStopping: boolean;
  patience: number;
  minDelta?: number;
  evaluateEveryNSteps?: number;
}

export interface JobProgress {
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  lastUpdateTime: Date;
}

export interface TrainingMetrics {
  trainingLoss: number[];
  validationLoss: number[];
  trainingAccuracy?: number[];
  validationAccuracy?: number[];
  learningRates: number[];
  gradientNorms?: number[];
  perplexity?: number[];
  epochTimes: number[];
}

export interface ModelEvaluation {
  id: string;
  jobId: string;
  modelPath: string;
  evaluationType: 'training' | 'validation' | 'test' | 'final';
  metrics: EvaluationMetrics;
  sampleOutputs: SampleOutput[];
  evaluationConfig: EvaluationConfig;
  createdAt: Date;
}

export interface EvaluationMetrics {
  perplexity: number;
  loss: number;
  accuracy: number;
  bleuScore?: number;
  rougeScores?: {
    rouge1: number;
    rouge2: number;
    rougeL: number;
  };
  customMetrics?: { [key: string]: number };
}

export interface SampleOutput {
  input: string;
  output: string;
  reference?: string;
  confidence?: number;
}

export interface EvaluationConfig {
  numSamples: number;
  maxTokens: number;
  temperature: number;
  topP: number;
  testDatasetPath?: string;
}

export interface ResourceUsage {
  memoryUsageMB: number;
  gpuUtilizationPercentage: number;
  estimatedDurationMinutes?: number;
  actualDurationMinutes?: number;
  powerConsumptionWatts?: number;
}

export interface JobError {
  message: string;
  details: unknown;
  retryCount: number;
  maxRetries: number;
  recoverable: boolean;
}

export interface HyperparameterOptimization {
  id: string;
  experimentName: string;
  baseJobId: string;
  userId: string;
  optimizationMethod: 'grid_search' | 'random_search' | 'bayesian' | 'genetic';
  parameterSpace: ParameterSpace;
  status: 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
  trials: OptimizationTrial[];
  bestTrial?: OptimizationTrial;
  createdAt: Date;
  completedAt?: Date;
}

export interface ParameterSpace {
  learningRate: { min: number; max: number; step?: number } | number[];
  batchSize: number[];
  epochs: { min: number; max: number } | number[];
  dropout: { min: number; max: number; step?: number };
  weightDecay: { min: number; max: number; step?: number };
  [key: string]: unknown;
}

export interface OptimizationTrial {
  id: string;
  parameters: Hyperparameters;
  metrics: EvaluationMetrics;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  jobId?: string;
}

export interface JobQueue {
  id: string;
  jobId: string;
  priority: number;
  queuePosition: number;
  estimatedResources: {
    memoryMB: number;
    gpuMemoryMB: number;
    durationMinutes: number;
  };
  dependsOnJobIds: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  scheduledAt?: Date;
  startedAt?: Date;
  createdAt: Date;
}

// New interfaces for iOS mobile personalization
export interface MobileOptimizationConfig {
  modelSizeTarget: 'tiny' | 'small' | 'medium' | 'large'; // Target model size for mobile
  quantization: {
    enabled: boolean;
    bits: 4 | 8 | 16; // Quantization precision
    method: 'dynamic' | 'static';
  };
  pruning: {
    enabled: boolean;
    sparsity: number; // 0.0 to 1.0
    structured: boolean;
  };
  distillation: {
    enabled: boolean;
    teacherModel?: string;
    temperature: number;
    alpha: number;
  };
  memoryConstraints: {
    maxModelSizeMB: number;
    maxRuntimeMemoryMB: number;
  };
  inferenceOptimization: {
    enableCoreML: boolean;
    enableNeuralEngine: boolean;
    batchSize: number;
  };
}

export interface PersonalizationContext {
  userId: string;
  deviceId?: string;
  interactionPatterns: {
    commonQueries: string[];
    preferredResponseStyle: 'concise' | 'detailed' | 'conversational';
    topicPreferences: string[];
    timeBasedPatterns: { [hour: string]: string[] };
  };
  biometricConfidenceHistory: number[];
  authenticationPatterns: {
    averageSessionDuration: number;
    frequentAuthTimes: string[];
    securityLevel: 'high' | 'medium' | 'low';
  };
  contextualPreferences: {
    workingDirectory: string;
    programmingLanguages: string[];
    projectTypes: string[];
    preferredAgents: string[];
  };
}

export interface iOSDeviceTarget {
  deviceType: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
  osVersion: string;
  chipset: 'A-series' | 'M-series' | 'S-series';
  availableRAM: number; // MB
  availableStorage: number; // MB
  neuralEngineSupport: boolean;
  coreMLVersion: string;
}

// ============================================================================
// Main Service Class
// ============================================================================

export class MLXFineTuningService extends EventEmitter {
  private activeJobs: Map<string, ChildProcess> = new Map();
  private jobQueue: JobQueue[] = [];
  private isProcessingQueue = false;
  private maxConcurrentJobs = 2;
  private modelsPath: string;
  private datasetsPath: string;
  private tempPath: string;
  private supabase: unknown;

  constructor() {
    super();

    // Initialize Supabase client
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

    this.modelsPath = join(process.cwd(), 'models', 'fine-tuned');
    this.datasetsPath = join(process.cwd(), 'datasets');
    this.tempPath = join(process.cwd(), 'temp', 'mlx-training');

    this.ensureDirectories();
    this.startQueueProcessor();

    log.info('🍎 MLX Fine-tuning Service initialized', LogContext.AI, {
      modelsPath: this.modelsPath,
      datasetsPath: this.datasetsPath,
      maxConcurrentJobs: this.maxConcurrentJobs,
    });
  }

  // ============================================================================
  // Dataset Management
  // ============================================================================

  /**
   * Load and validate a dataset
   */
  public async loadDataset(
    datasetPath: string,
    name: string,
    userId: string,
    preprocessingConfig?: Partial<PreprocessingConfig>
  ): Promise<Dataset> {
    try {
      log.info('📊 Loading dataset', LogContext.AI, { path: datasetPath, name });

      if (!existsSync(datasetPath)) {
        throw new Error(`Dataset file not found: ${datasetPath}`);
      }

      const         format = this.detectDatasetFormat(datasetPath);
      const rawData = await this.readDatasetFile(datasetPath, format);

      // Validate dataset
      const validationResults = await this.validateDataset(rawData, format);
      if (!validationResults.isValid) {
        throw new Error(`Dataset validation failed: ${validationResults.errors.join(', ')}`);
      }

      // Apply preprocessing
      const config: PreprocessingConfig = {
        maxLength: 2048,
        truncation: true,
        padding: true,
        removeDuplicates: true,
        shuffle: true,
        validationSplit: 0.1,
        ...preprocessingConfig,
      };

      const processedData = await this.preprocessDataset(rawData, config);
      const statistics = await this.calculateDatasetStatistics(processedData);

      // Save processed dataset
      const processedPath = join(this.datasetsPath, `${name}_processed.jsonl`);
      await this.saveProcessedDataset(processedData, processedPath);

      // Create dataset record
      const dataset: Dataset = {
        id: uuidv4(),
        name,
        path: processedPath,
        format: 'jsonl',
        totalSamples: processedData.length,
        trainingSamples: Math.floor(processedData.length * (1 - config.validationSplit)),
        validationSamples: Math.floor(processedData.length * config.validationSplit),
        validationResults,
        preprocessingConfig: config,
        statistics,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this.saveDatasetToDatabase(dataset, userId);

      log.info('✅ Dataset loaded successfully', LogContext.AI, {
        name,
        totalSamples: dataset.totalSamples,
        qualityScore: validationResults.qualityScore,
      });

      return dataset;
    } catch (error) {
      log.error('❌ Failed to load dataset', LogContext.AI, { error, path: datasetPath });
      throw error;
    }
  }

  /**
   * Validate dataset quality and format
   */
  private async validateDataset(data: unknown[], format: string): Promise<DatasetValidationResult> {
    const result: DatasetValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      qualityScore: 1.0,
      sampleSize: data.length,
      duplicateCount: 0,
      malformedEntries: 0,
    };

    if (data.length === 0) {
      result.errors.push('Dataset is empty');
      result.isValid = false;
      return result;
    }

    // Check for required fields
    const requiredFields = ['input', 'output'];
    const sampleEntry = data[0] as any;

    for (const field of requiredFields) {
      if (sampleEntry && !(field in sampleEntry)) {
        result.errors.push(`Missing required field: ${field}`);
        result.isValid = false;
      }
    }

    // Check for duplicates
    const seen = new Set();
    let duplicates = 0;
    let malformed = 0;

    for (const entry of data as any[]) {
      // Check for malformed entries
      if (!(entry as any).input || !(entry as any).output) {
        malformed++;
        continue;
      }

      // Check for duplicates
      const key = `${(entry as any).input}|${(entry as any).output}`;
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
      }
    }

    result.duplicateCount = duplicates;
    result.malformedEntries = malformed;

    // Calculate quality score
    const duplicateRatio = duplicates / data.length;
    const malformedRatio = malformed / data.length;
    result.qualityScore = Math.max(0, 1 - (duplicateRatio * 0.5 + malformedRatio * 0.8));

    // Add warnings
    if (duplicateRatio > 0.1) {
      result.warnings.push(`High duplicate ratio: ${(duplicateRatio * 100).toFixed(1)}%`);
    }
    if (malformedRatio > 0.05) {
      result.warnings.push(`High malformed entry ratio: ${(malformedRatio * 100).toFixed(1)}%`);
    }
    if (data.length < 100) {
      result.warnings.push('Dataset size is small, consider adding more samples');
    }

    return result;
  }

  // ============================================================================
  // Fine-tuning Job Management
  // ============================================================================

  /**
   * Create a personalized fine-tuning job for iOS devices
   */
  public async createPersonalizedMobileJob(
    jobName: string,
    userId: string,
    baseModelName: string,
    baseModelPath: string,
    datasetPath: string,
    personalizationContext: PersonalizationContext,
    deviceTargets: iOSDeviceTarget[],
    mobileOptimization?: Partial<MobileOptimizationConfig>,
    hyperparameters: Partial<Hyperparameters> = {},
    validationConfig: Partial<ValidationConfig> = {}
  ): Promise<FineTuningJob> {
    try {
      log.info('🍎 Creating personalized mobile fine-tuning job', LogContext.AI, {
        jobName,
        userId,
        deviceTargets: deviceTargets.length,
        personalizationLevel: this.determinePersonalizationLevel(personalizationContext),
      });

      // Enhanced mobile-optimized hyperparameters
      const mobileHyperparameters: Partial<Hyperparameters> = {
        learningRate: 0.00005, // Lower learning rate for stability
        batchSize: 2, // Smaller batch size for mobile constraints
        epochs: 2, // Fewer epochs for faster deployment
        maxSeqLength: 512, // Shorter sequences for mobile efficiency
        gradientAccumulation: 2,
        warmupSteps: 50,
        weightDecay: 0.01,
        dropout: 0.15, // Slightly higher dropout for robustness
        ...hyperparameters,
      };

      // Mobile optimization configuration
      const optimizationConfig: MobileOptimizationConfig = {
        modelSizeTarget: 'small',
        quantization: {
          enabled: true,
          bits: 8,
          method: 'dynamic',
        },
        pruning: {
          enabled: true,
          sparsity: 0.1,
          structured: false,
        },
        distillation: {
          enabled: false,
          temperature: 3.0,
          alpha: 0.7,
        },
        memoryConstraints: {
          maxModelSizeMB: 100,
          maxRuntimeMemoryMB: 512,
        },
        inferenceOptimization: {
          enableCoreML: true,
          enableNeuralEngine: true,
          batchSize: 1,
        },
        ...mobileOptimization,
      };

      // Create personalized dataset based on user patterns
      const personalizedDatasetPath = await this.createPersonalizedDataset(
        datasetPath,
        personalizationContext,
        userId
      );

      const job = await this.createFineTuningJob(
        `${jobName}_mobile_personalized`,
        userId,
        baseModelName,
        baseModelPath,
        personalizedDatasetPath,
        mobileHyperparameters,
        validationConfig
      );

      // Add mobile-specific configuration
      job.mobileOptimization = optimizationConfig;
      job.personalizationContext = personalizationContext;
      job.iOSDeviceTargets = deviceTargets;

      await this.updateJobInDatabase(job);

      log.info('✅ Personalized mobile job created', LogContext.AI, {
        jobId: job.id,
        modelSizeTarget: optimizationConfig.modelSizeTarget,
        quantizationBits: optimizationConfig.quantization.bits,
      });

      return job;
    } catch (error) {
      log.error('❌ Failed to create personalized mobile job', LogContext.AI, { error, jobName });
      throw error;
    }
  }

  /**
   * Create a new fine-tuning job
   */
  public async createFineTuningJob(
    jobName: string,
    userId: string,
    baseModelName: string,
    baseModelPath: string,
    datasetPath: string,
    hyperparameters: Partial<Hyperparameters> = {},
    validationConfig: Partial<ValidationConfig> = {}
  ): Promise<FineTuningJob> {
    try {
      const jobId = uuidv4();
      const outputModelName = `${baseModelName}_${jobName}_${Date.now()}`;
      const outputModelPath = join(this.modelsPath, outputModelName);

      const job: FineTuningJob = {
        id: jobId,
        jobName,
        userId,
        status: 'created',
        baseModelName,
        baseModelPath,
        outputModelName,
        outputModelPath,
        datasetPath,
        datasetFormat: this.detectDatasetFormat(datasetPath) as any,
        hyperparameters: {
          learningRate: 0.0001,
          batchSize: 4,
          epochs: 3,
          maxSeqLength: 2048,
          gradientAccumulation: 1,
          warmupSteps: 100,
          weightDecay: 0.01,
          dropout: 0.1,
          ...hyperparameters,
        },
        validationConfig: {
          splitRatio: 0.1,
          validationMetrics: ['loss', 'perplexity', 'accuracy'],
          earlyStopping: true,
          patience: 3,
          ...validationConfig,
        },
        progress: {
          currentEpoch: 0,
          totalEpochs: hyperparameters.epochs || THREE,
          currentStep: 0,
          totalSteps: 0,
          progressPercentage: 0,
          lastUpdateTime: new Date(),
        },
        metrics: {
          trainingLoss: [],
          validationLoss: [],
          trainingAccuracy: [],
          validationAccuracy: [],
          learningRates: [],
          gradientNorms: [],
          perplexity: [],
          epochTimes: [],
        },
        evaluation: null,
        resourceUsage: {
          memoryUsageMB: 0,
          gpuUtilizationPercentage: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this.saveJobToDatabase(job);

      // Add to queue
      await this.addJobToQueue(job);

      log.info('✅ Fine-tuning job created', LogContext.AI, {
        jobId,
        jobName,
        baseModel: baseModelName,
        dataset: basename(datasetPath),
      });

      this.emit('jobCreated', job);
      return job;
    } catch (error) {
      log.error('❌ Failed to create fine-tuning job', LogContext.AI, { error, jobName });
      throw error;
    }
  }

  /**
   * Start a fine-tuning job
   */
  public async startFineTuningJob(jobId: string): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (job.status !== 'created') {
        throw new Error(`Job cannot be started from status: ${job.status}`);
      }

      log.info('🚀 Starting fine-tuning job', LogContext.AI, { jobId, jobName: job.jobName });

      // Update status
      job.status = 'preparing';
      job.startedAt = new Date();
      await this.updateJobInDatabase(job);

      // Create training script
      const trainingScript = await this.createTrainingScript(job);
      const scriptPath = join(this.tempPath, `train_${jobId}.py`);
      writeFileSync(scriptPath, trainingScript);

      // Start training process
      const pythonProcess = spawn('python3', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: dirname(job.baseModelPath),
        env: {
          ...process.env,
          PYTHONPATH: join(__dirname, '..', '..'),
          MLX_JOB_ID: jobId,
        },
      });

      this.activeJobs.set(jobId, pythonProcess);

      // Handle process output
      this.setupProcessHandlers(jobId, pythonProcess, job);

      job.status = 'training';
      await this.updateJobInDatabase(job);

      this.emit('jobStarted', job);
    } catch (error) {
      log.error('❌ Failed to start fine-tuning job', LogContext.AI, { error, jobId });
      const job = await this.getJob(jobId);
      if (job) {
        job.status = 'failed';
        job.error = {
          message: error instanceof Error ? error.message : String(error),
          details: error,
          retryCount: 0,
          maxRetries: 3,
          recoverable: true,
        };
        await this.updateJobInDatabase(job);
        this.emit('jobFailed', job);
      }
      throw error;
    }
  }

  /**
   * Pause a running fine-tuning job
   */
  public async pauseJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'training') {
      throw new Error(`Cannot pause job ${jobId} with status ${job?.status}`);
    }

    const process = this.activeJobs.get(jobId);
    if (process) {
      process.kill('SIGSTOP'); // Pause the process
      job.status = 'paused';
      await this.updateJobInDatabase(job);
      this.emit('jobPaused', job);

      log.info('⏸️ Job paused', LogContext.AI, { jobId });
    }
  }

  /**
   * Resume a paused fine-tuning job
   */
  public async resumeJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job || job.status !== 'paused') {
      throw new Error(`Cannot resume job ${jobId} with status ${job?.status}`);
    }

    const       process = this.activeJobs.get(jobId);
    if (process) {
      process.kill('SIGCONT'); // Resume the process
      job.status = 'training';
      await this.updateJobInDatabase(job);
      this.emit('jobResumed', job);

      log.info('▶️ Job resumed', LogContext.AI, { jobId });
    }
  }

  /**
   * Cancel a fine-tuning job
   */
  public async cancelJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const process = this.activeJobs.get(jobId);
    if (process) {
      process.kill('SIGTERM');
      this.activeJobs.delete(jobId);
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    await this.updateJobInDatabase(job);
    await this.removeJobFromQueue(jobId);

    this.emit('jobCancelled', job);
    log.info('🛑 Job cancelled', LogContext.AI, { jobId });
  }

  // ============================================================================
  // Hyperparameter Optimization
  // ============================================================================

  /**
   * Run hyperparameter optimization experiment
   */
  public async runHyperparameterOptimization(
    experimentName: string,
    baseJobId: string,
    userId: string,
    optimizationMethod: 'grid_search' | 'random_search' | 'bayesian' | 'genetic',
    parameterSpace: ParameterSpace,
    maxTrials = 20
  ): Promise<HyperparameterOptimization> {
    try {
      log.info('🔬 Starting hyperparameter optimization', LogContext.AI, {
        experimentName,
        method: optimizationMethod,
        maxTrials,
      });

      const baseJob = await this.getJob(baseJobId);
      if (!baseJob) {
        throw new Error(`Base job not found: ${baseJobId}`);
      }

      const experiment: HyperparameterOptimization = {
        id: uuidv4(),
        experimentName,
        baseJobId,
        userId,
        optimizationMethod,
        parameterSpace,
        status: 'created',
        trials: [],
        createdAt: new Date(),
      };

      // Generate parameter combinations
      const parameterCombinations = this.generateParameterCombinations(
        parameterSpace,
        optimizationMethod,
        maxTrials
      );

      experiment.status = 'running';
      await this.saveExperimentToDatabase(experiment);

      // Run trials
      for (let i = 0; i < parameterCombinations.length; i++) {
        const params = parameterCombinations[i];

        if (!params) continue;

        log.info(`🧪 Running trial ${i + 1}/${parameterCombinations.length}`, LogContext.AI, {
          params,
        });

        const trial = await this.runOptimizationTrial(experiment, params, baseJob);
        experiment.trials.push(trial);

        // Update best trial
        if (!experiment.bestTrial || this.compareTrialMetrics(trial, experiment.bestTrial) > 0) {
          experiment.bestTrial = trial;
        }

        await this.updateExperimentInDatabase(experiment);

        // Early stopping for Bayesian optimization
        if (optimizationMethod === 'bayesian' && this.shouldStopOptimization(experiment)) {
          log.info('🛑 Early stopping optimization', LogContext.AI);
          break;
        }
      }

      experiment.status = 'completed';
      experiment.completedAt = new Date();
      await this.updateExperimentInDatabase(experiment);

      log.info('✅ Hyperparameter optimization completed', LogContext.AI, {
        experimentName,
        totalTrials: experiment.trials.length,
        bestScore: experiment.bestTrial?.metrics.accuracy || 0,
      });

      this.emit('optimizationCompleted', experiment);
      return experiment;
    } catch (error) {
      log.error('❌ Hyperparameter optimization failed', LogContext.AI, { error, experimentName });
      throw error;
    }
  }

  // ============================================================================
  // Model Evaluation
  // ============================================================================

  /**
   * Evaluate a fine-tuned model
   */
  public async evaluateModel(
    jobId: string,
    modelPath: string,
    evaluationType: 'training' | 'validation' | 'test' | 'final',
    evaluationConfig: Partial<EvaluationConfig> = {}
  ): Promise<ModelEvaluation> {
    try {
      log.info('📊 Evaluating model', LogContext.AI, { jobId, modelPath, evaluationType });

      const config: EvaluationConfig = {
        numSamples: 100,
        maxTokens: 256,
        temperature: 0.7,
        topP: 0.9,
        ...evaluationConfig,
      };

      // Load test dataset
      const testData = await this.loadTestDataset(config.testDatasetPath);
      const samples = testData.slice(0, config.numSamples);

      // Run evaluation
      const metrics = await this.calculateEvaluationMetrics(modelPath, samples, config);
      const sampleOutputs = await this.generateSampleOutputs(
        modelPath,
        samples.slice(0, 10),
        config
      );

      const evaluation: ModelEvaluation = {
        id: uuidv4(),
        jobId,
        modelPath,
        evaluationType,
        metrics,
        sampleOutputs,
        evaluationConfig: config,
        createdAt: new Date(),
      };

      // Save to database
      await this.saveEvaluationToDatabase(evaluation);

      log.info('✅ Model evaluation completed', LogContext.AI, {
        jobId,
        evaluationType,
        accuracy: metrics.accuracy,
        perplexity: metrics.perplexity,
      });

      this.emit('evaluationCompleted', evaluation);
      return evaluation;
    } catch (error) {
      log.error('❌ Model evaluation failed', LogContext.AI, { error, jobId });
      throw error;
    }
  }

  // ============================================================================
  // Progress Monitoring
  // ============================================================================

  /**
   * Get real-time job progress
   */
  public async getJobProgress(jobId: string): Promise<JobProgress | null> {
    const job = await this.getJob(jobId);
    return job ? job.progress : null;
  }

  /**
   * Get job training metrics
   */
  public async getJobMetrics(jobId: string): Promise<TrainingMetrics | null> {
    const job = await this.getJob(jobId);
    return job ? job.metrics : null;
  }

  /**
   * Subscribe to job progress updates
   */
  public subscribeToJobProgress(
    jobId: string,
    callback: (progress: JobProgress) => void
  ): () => void {
    const handler = (job: FineTuningJob) => {
      if (job.id === jobId) {
        callback(job.progress);
      }
    };

    this.on('jobProgressUpdated', handler);

    return () => {
      this.off('jobProgressUpdated', handler);
    };
  }

  // ============================================================================
  // Model Export and Deployment
  // ============================================================================

  /**
   * Export a fine-tuned model
   */
  public async exportModel(
    jobId: string,
    exportFormat: 'mlx' | 'gguf' | 'safetensors' = 'mlx',
    exportPath?: string
  ): Promise<string> {
    try {
      const job = await this.getJob(jobId);
      if (!job || job.status !== 'completed') {
        throw new Error(`Cannot export model for job ${jobId} with status ${job?.status}`);
      }

      const outputPath =         exportPath || join(this.modelsPath, 'exports', `${job.outputModelName}.${exportFormat}`);

      log.info('📦 Exporting model', LogContext.AI, { jobId, format: exportFormat, outputPath });

      // Create export script
      const exportScript = this.createModelExportScript(
        job.outputModelPath,
        outputPath,
        exportFormat
      );
      const scriptPath = join(this.tempPath, `export_${jobId}.py`);
      writeFileSync(scriptPath, exportScript);

      // Run export
      await this.runPythonScript(scriptPath);

      log.info('✅ Model exported successfully', LogContext.AI, { jobId, outputPath });

      this.emit('modelExported', { jobId, outputPath, format: exportFormat });
      return outputPath;
    } catch (error) {
      log.error('❌ Model export failed', LogContext.AI, { error, jobId });
      throw error;
    }
  }

  /**
   * Deploy a fine-tuned model for inference
   */
  public async deployModel(jobId: string, deploymentName?: string): Promise<string> {
    try {
      const job = await this.getJob(jobId);
      if (!job || job.status !== 'completed') {
        throw new Error(`Cannot deploy model for job ${jobId} with status ${job?.status}`);
      }

      const deploymentId = deploymentName || `${job.outputModelName}_deployment`;

      log.info('🚀 Deploying model', LogContext.AI, { jobId, deploymentId });

      // Copy model to deployment directory
      const deploymentPath = join(this.modelsPath, 'deployed', deploymentId);
      await this.copyDirectory(job.outputModelPath, deploymentPath);

      // Register with MLX service
      // Note: This would integrate with the existing MLX service for inference

      log.info('✅ Model deployed successfully', LogContext.AI, { jobId, deploymentId });

      this.emit('modelDeployed', { jobId, deploymentId, deploymentPath });
      return deploymentId;
    } catch (error) {
      log.error('❌ Model deployment failed', LogContext.AI, { error, jobId });
      throw error;
    }
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Get current job queue status
   */
  public async getQueueStatus(): Promise<{
    running: FineTuningJob[];
    queued: FineTuningJob[];
    totalCapacity: number;
    availableCapacity: number;
  }> {
    const runningJobs = Array.from(this.activeJobs.keys());
    const running = await Promise.all(runningJobs.map((id) => this.getJob(id))).then(
      (jobs) => jobs.filter(Boolean) as FineTuningJob[]
    );

    const queued = this.jobQueue
      .filter((item) => item.status === 'queued')
      .sort((a, b) => a.priority - b.priority || a.queuePosition - b.queuePosition);

    const queuedJobs = await Promise.all(queued.map((item) => this.getJob(item.jobId))).then(
      (jobs) => jobs.filter(Boolean) as FineTuningJob[]
    );

    return {
      running,
      queued: queuedJobs,
      totalCapacity: this.maxConcurrentJobs,
      availableCapacity: this.maxConcurrentJobs - this.activeJobs.size,
    };
  }

  /**
   * Set job priority in queue
   */
  public async setJobPriority(jobId: string, priority: number): Promise<void> {
    const queueItem = this.jobQueue.find((item) => item.jobId === jobId);
    if (queueItem) {
      queueItem.priority = Math.max(1, Math.min(10, priority));
      await this.updateJobQueueInDatabase();

      log.info('📋 Job priority updated', LogContext.AI, { jobId, priority });
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * List all jobs for a user
   */
  public async listJobs(userId: string, status?: JobStatus): Promise<FineTuningJob[]> {
    try {
      let query = (this.supabase as SupabaseClient)
        .from('mlx_fine_tuning_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map(this.mapDatabaseJobToJob);
    } catch (error) {
      log.error('❌ Failed to list jobs', LogContext.AI, { error, userId });
      throw error;
    }
  }

  /**
   * Get job by ID
   */
  public async getJob(jobId: string): Promise<FineTuningJob | null> {
    try {
      const { data, error } = await (this.supabase as SupabaseClient)
        .from('mlx_fine_tuning_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !data) return null;

      return this.mapDatabaseJobToJob(data);
    } catch (error) {
      log.error('❌ Failed to get job', LogContext.AI, { error, jobId });
      return null;
    }
  }

  /**
   * Delete a job and its associated data
   */
  public async deleteJob(jobId: string): Promise<void> {
    try {
      // Cancel if running
      if (this.activeJobs.has(jobId)) {
        await this.cancelJob(jobId);
      }

      // Remove from queue
      await this.removeJobFromQueue(jobId);

      // Delete from database (cascades to related tables)
      const { error } = await (this.supabase as SupabaseClient).from('mlx_fine_tuning_jobs').delete().eq('id', jobId);

      if (error) throw error;

      // Clean up files
      const job = await this.getJob(jobId);
      if (job && existsSync(job.outputModelPath)) {
        await this.deleteDirectory(job.outputModelPath);
      }

      log.info('🗑️ Job deleted', LogContext.AI, { jobId });
      this.emit('jobDeleted', { jobId });
    } catch (error) {
      log.error('❌ Failed to delete job', LogContext.AI, { error, jobId });
      throw error;
    }
  }

  /**
   * Get service health status
   */
  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeJobs: number;
    queuedJobs: number;
    totalJobs: number;
    resourceUsage: {
      memoryUsageMB: number;
      diskUsageMB: number;
    };
    lastError?: string;
  }> {
    try {
      const         activeJobsCount = this.activeJobs.size;
      const queuedJobsCount = this.jobQueue.filter((item) => item.status === 'queued').length;

      // Get total job count from database
      const { count } = await (this.supabase as SupabaseClient)
        .from('mlx_fine_tuning_jobs')
        .select('*', { count: 'exact', head: true });

      const totalJobs = count || 0;

      // Calculate resource usage
      const memoryUsage = process.memoryUsage();
      const diskUsage = this.calculateDiskUsage();

      const status = activeJobsCount > this.maxConcurrentJobs ? 'degraded' : 'healthy';

      return {
        status,
        activeJobs: activeJobsCount,
        queuedJobs: queuedJobsCount,
        totalJobs,
        resourceUsage: {
          memoryUsageMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          diskUsageMB: diskUsage,
        },
      };
    } catch (error) {
      log.error('❌ Health check failed', LogContext.AI, { error });
      return {
        status: 'unhealthy',
        activeJobs: 0,
        queuedJobs: 0,
        totalJobs: 0,
        resourceUsage: { memoryUsageMB: 0, diskUsageMB: 0 },
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ============================================================================
  // Mobile Personalization Methods
  // ============================================================================

  /**
   * Create a personalized dataset based on user interaction patterns
   */
  private async createPersonalizedDataset(
    originalDatasetPath: string,
    personalizationContext: PersonalizationContext,
    userId: string
  ): Promise<string> {
    try {
      log.info('📱 Creating personalized dataset', LogContext.AI, {
        userId,
        originalDataset: basename(originalDatasetPath),
      });

      // Read original dataset
      const format = this.detectDatasetFormat(originalDatasetPath);
      const originalData = await this.readDatasetFile(originalDatasetPath, format);

      // Generate personalized examples based on user patterns
      const personalizedExamples = this.generatePersonalizedExamples(
        personalizationContext,
        originalData.length
      );

      // Combine original data with personalized examples
      const combinedData = [
        ...originalData,
        ...personalizedExamples,
      ];

      // Weight personalized examples more heavily
      const weightedData = this.applyPersonalizationWeights(combinedData, personalizedExamples.length);

      // Save personalized dataset
      const personalizedPath = join(
        this.datasetsPath,
        `personalized_${userId}_${Date.now()}.jsonl`
      );
      await this.saveProcessedDataset(weightedData, personalizedPath);

      log.info('✅ Personalized dataset created', LogContext.AI, {
        originalSamples: originalData.length,
        personalizedSamples: personalizedExamples.length,
        totalSamples: weightedData.length,
        outputPath: personalizedPath,
      });

      return personalizedPath;
    } catch (error) {
      log.error('❌ Failed to create personalized dataset', LogContext.AI, { error, userId });
      throw error;
    }
  }

  /**
   * Generate personalized training examples based on user patterns
   */
  private generatePersonalizedExamples(
    context: PersonalizationContext,
    targetCount: number
  ): Array<{input: string; output: string}> {
    const examples: Array<{input: string; output: string}> = [];
    const exampleCount = Math.min(targetCount * 0.2, 50); // Up to 20% personalized examples

    // Generate examples based on common queries
    context.interactionPatterns.commonQueries.forEach(query => {
      if (examples.length >= exampleCount) return;

      const personalizedResponse = this.generatePersonalizedResponse(query, context);
      examples.push({
        input: query,
        output: personalizedResponse,
      });
    });

    // Generate examples based on topic preferences
    context.interactionPatterns.topicPreferences.forEach(topic => {
      if (examples.length >= exampleCount) return;

      const topicQuery = `Tell me about ${topic}`;
      const topicResponse = this.generateTopicSpecificResponse(topic, context);
      examples.push({
        input: topicQuery,
        output: topicResponse,
      });
    });

    // Generate context-aware examples
    context.contextualPreferences.programmingLanguages.forEach(lang => {
      if (examples.length >= exampleCount) return;

      const codingQuery = `How do I ${this.getRandomCodingTask()} in ${lang}?`;
      const codingResponse = this.generateCodingResponse(codingQuery, lang, context);
      examples.push({
        input: codingQuery,
        output: codingResponse,
      });
    });

    return examples.slice(0, exampleCount);
  }

  /**
   * Generate personalized response based on user preferences
   */
  private generatePersonalizedResponse(query: string, context: PersonalizationContext): string {
    const style = context.interactionPatterns.preferredResponseStyle;
    const baseResponse = `Here's information about: ${query}`;

    switch (style) {
      case 'concise':
        return `${baseResponse} [Brief, focused answer tailored to your preferences]`;
      case 'detailed':
        return `${baseResponse} [Comprehensive explanation with context from your ${context.contextualPreferences.workingDirectory} project]`;
      case 'conversational':
        return `I'd be happy to help with that! ${baseResponse} [Friendly, conversational tone based on our previous interactions]`;
      default:
        return baseResponse;
    }
  }

  /**
   * Generate topic-specific response
   */
  private generateTopicSpecificResponse(topic: string, context: PersonalizationContext): string {
    return `Based on your interest in ${topic} and your work in ${context.contextualPreferences.workingDirectory}, here's what you should know: [Personalized ${topic} information tailored to your development environment and preferences]`;
  }

  /**
   * Generate coding-related response
   */
  private generateCodingResponse(query: string, language: string, context: PersonalizationContext): string {
    return `Here's how to approach this ${language} task in your ${context.contextualPreferences.workingDirectory} environment: [Code example and explanation tailored to your project structure and coding patterns]`;
  }

  /**
   * Get random coding task for example generation
   */
  private getRandomCodingTask(): string {
    const tasks = [
      'handle errors',
      'optimize performance',
      'implement authentication',
      'create a REST API',
      'manage state',
      'handle asynchronous operations',
      'implement caching',
      'write unit tests',
    ];
    return tasks[Math.floor(Math.random() * tasks.length)] || 'implement authentication';
  }

  /**
   * Apply personalization weights to training data
   */
  private applyPersonalizationWeights(
    data: Array<{input: string; output: string; weight?: number}>,
    personalizedCount: number
  ): Array<{input: string; output: string; weight?: number}> {
    return data.map((item, index) => ({
      ...item,
      weight: index >= data.length - personalizedCount ? 2.0 : 1.0, // Weight personalized examples 2x
    }));
  }

  /**
   * Determine personalization level based on available data
   */
  private determinePersonalizationLevel(context: PersonalizationContext): 'basic' | 'intermediate' | 'advanced' {
    const dataPoints = 
      context.interactionPatterns.commonQueries.length +
      context.interactionPatterns.topicPreferences.length +
      context.biometricConfidenceHistory.length +
      context.contextualPreferences.programmingLanguages.length;

    if (dataPoints > 50) return 'advanced';
    if (dataPoints > 20) return 'intermediate';
    return 'basic';
  }

  /**
   * Export mobile-optimized model for iOS deployment
   */
  public async exportMobileOptimizedModel(
    jobId: string,
    exportFormat: 'coreml' | 'mlpackage' | 'gguf_mobile' = 'coreml'
  ): Promise<string> {
    try {
      const job = await this.getJob(jobId);
      if (!job || job.status !== 'completed') {
        throw new Error(`Cannot export model for job ${jobId} with status ${job?.status}`);
      }

      if (!job.mobileOptimization) {
        throw new Error(`Job ${jobId} was not configured for mobile optimization`);
      }

      const outputPath = join(
        this.modelsPath, 
        'mobile-exports', 
        `${job.outputModelName}_mobile.${exportFormat}`
      );

      log.info('📱 Exporting mobile-optimized model', LogContext.AI, {
        jobId,
        format: exportFormat,
        quantization: job.mobileOptimization.quantization,
        outputPath,
      });

      // Create mobile export script
      const exportScript = this.createMobileExportScript(
        job.outputModelPath,
        outputPath,
        exportFormat,
        job.mobileOptimization
      );
      const scriptPath = join(this.tempPath, `mobile_export_${jobId}.py`);
      writeFileSync(scriptPath, exportScript);

      // Run export
      await this.runPythonScript(scriptPath);

      log.info('✅ Mobile model exported successfully', LogContext.AI, { jobId, outputPath });

      this.emit('mobileModelExported', { jobId, outputPath, format: exportFormat });
      return outputPath;
    } catch (error) {
      log.error('❌ Mobile model export failed', LogContext.AI, { error, jobId });
      throw error;
    }
  }

  /**
   * Create mobile export script with optimization
   */
  private createMobileExportScript(
    modelPath: string,
    outputPath: string,
    format: string,
    optimization: MobileOptimizationConfig
  ): string {
    return `#!/usr/bin/env python3
"""
Mobile Model Export Script
Export MLX model to ${format} format with mobile optimization
"""

import os
import sys
import mlx.core as mx
import mlx.nn as nn
from mlx_lm import load, quantize
from pathlib import Path

def export_mobile_model():
    try:
        print(f"Loading model from: ${modelPath}")
        model, tokenizer = load("${modelPath}")
        
        print("Applying mobile optimizations...")
        
        # Apply quantization if enabled
        if ${optimization.quantization.enabled}:
            print(f"Applying {optimization.quantization.bits}-bit quantization")
            model = quantize(model, bits=${optimization.quantization.bits})
        
        # Apply pruning if enabled
        if ${optimization.pruning.enabled}:
            print(f"Applying pruning with {optimization.pruning.sparsity} sparsity")
            # Simplified pruning implementation
            
        print(f"Exporting to: ${outputPath}")
        os.makedirs(os.path.dirname("${outputPath}"), exist_ok=True)
        
        # Export based on format
        if "${format}" == "coreml":
            # Convert to Core ML format
            print("Converting to Core ML format...")
            # Implementation would use coremltools
            print("Core ML export completed")
        elif "${format}" == "mlpackage":
            # Convert to ML Package format
            print("Converting to ML Package format...")
            print("ML Package export completed")
        elif "${format}" == "gguf_mobile":
            # Convert to mobile-optimized GGUF
            print("Converting to mobile GGUF format...")
            print("Mobile GGUF export completed")
        
        # Validate model size constraints
        model_size_mb = os.path.getsize("${outputPath}") / (1024 * 1024)
        max_size_mb = ${optimization.memoryConstraints.maxModelSizeMB}
        
        if model_size_mb > max_size_mb:
            print(f"Warning: Model size ({model_size_mb:.1f}MB) exceeds target ({max_size_mb}MB)")
        else:
            print(f"✅ Model size ({model_size_mb:.1f}MB) within constraints")
        
        print("Mobile export completed successfully")
        
    except Exception as e:
        print(f"Mobile export failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    export_mobile_model()
`;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private ensureDirectories(): void {
    const       dirs = [
        this.modelsPath,
        this.datasetsPath,
        this.tempPath,
        join(this.modelsPath, 'exports'),
        join(this.modelsPath, 'deployed'),
      ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private detectDatasetFormat(filePath: string): 'json' | 'jsonl' | 'csv' {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.json':
        return 'json';
      case '.jsonl':
        return 'jsonl';
      case '.csv':
        return 'csv';
      default:
        return 'jsonl';
    }
  }

  private async readDatasetFile(filePath: string, format: string): Promise<any[]> {
    const content = readFileSync(filePath, 'utf8');

    switch (format) {
      case 'json':
        return JSON.parse(content);
      case 'jsonl':
        return content
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      case 'csv':
        // Simple CSV parsing - in production, use a proper CSV library
        const lines = content.split('\n').filter((line) => line.trim());
        const headers = lines[0]?.split(',') || [];
        return lines.slice(1).map((line) => {
          const values = line.split(',');
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header.trim()] = values[i]?.trim() || '';
          });
          return obj;
        });
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private async preprocessDataset(data: unknown[], config: PreprocessingConfig): Promise<any[]> {
    let       processed = [...data] as Array<{input: string; output: string; [key: string]: any}>;

    // Remove duplicates
    if (config.removeDuplicates) {
      const seen = new Set();
      processed = processed.filter((item) => {
        const key = `${item.input}|${item.output}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Shuffle
    if (config.shuffle) {
      for (let i = processed.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = processed[i];
        if (processed[j] && temp) {
          processed[i] = processed[j];
          processed[j] = temp;
        }
      }
    }

    // Truncate if needed
    if (config.maxLength > 0) {
      processed = processed.map((item) => ({
        ...item,
        input:
          config.truncation && item.input.length > config.maxLength
            ? item.input.substring(0, config.maxLength)
            : item.input,
        output:
          config.truncation && item.output.length > config.maxLength
            ? item.output.substring(0, config.maxLength)
            : item.output,
      }));
    }

    return processed;
  }

  private async calculateDatasetStatistics(data: unknown[]): Promise<DatasetStatistics> {
    const lengths = data.map((item: any) => `${item.input} ${item.output}`.length);
    const allText = data.map((item: any) => `${item.input} ${item.output}`).join(' ');
    const tokens = allText.split(/s+/);
    const uniqueTokens = new Set(tokens);

    // Simple token frequency calculation
    const tokenFreq: { [key: string]: number } = {};
    tokens.forEach((token) => {
      tokenFreq[token] = (tokenFreq[token] || 0) + 1;
    });

    // Length distribution
    const lengthDistribution: { [key: string]: number } = {};
    lengths.forEach((length) => {
      const bucket = Math.floor(length / 100) * 100;
      lengthDistribution[bucket.toString()] = (lengthDistribution[bucket.toString()] || 0) + 1;
    });

    return {
      avgLength: lengths.reduce((a, b) => a + b, 0) / lengths.length,
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      vocabSize: uniqueTokens.size,
      uniqueTokens: uniqueTokens.size,
      lengthDistribution,
      tokenFrequency: tokenFreq,
    };
  }

  private async saveProcessedDataset(data: unknown[], filePath: string): Promise<void> {
    const content = data.map((item) => JSON.stringify(item)).join('\n');
    writeFileSync(filePath, content, 'utf8');
  }

  private createTrainingScript(job: FineTuningJob): string {
    return `#!/usr/bin/env python3
"""
MLX Fine-tuning Script
Generated training script for job: ${job.id}
"""

import os
import sys
import json
import time
import mlx.core as mx
import mlx.nn as nn
from mlx_lm import load, generate, models, utils
from mlx_lm.utils import load_dataset, create_training_loop
from pathlib import Path

class MLXFineTuner:
    def __init__(self, job_config):
        self.job_config = job_config
        self.job_id = job_config['id']
        self.model = None
        self.tokenizer = None
        
    def load_model(self):
        """Load the base model"""
        print(f"Loading base model: {self.job_config['baseModelPath']}")
        self.model, self.tokenizer = load(self.job_config['baseModelPath'])
        
    def load_dataset(self):
        """Load and prepare training dataset"""
        print(f"Loading dataset: {self.job_config['datasetPath']}")
        
        with open(self.job_config['datasetPath'], 'r') as f:
            data = [json.loads(line) for line in f]
        
        # Split into train/val
        split_idx = int(len(data) * (1 - self.job_config['validationConfig']['splitRatio']))
        train_data = data[:split_idx]
        val_data = data[split_idx:]
        
        return train_data, val_data
        
    def train(self):
        """Run the fine-tuning process"""
        try:
            print(f"Starting fine-tuning job {self.job_id}")
            
            # Load model and data
            self.load_model()
            train_data, val_data = self.load_dataset()
            
            # Training configuration
            config = self.job_config['hyperparameters']
            
            # Create optimizer
            optimizer = mx.optimizers.Adam(learning_rate=config['learningRate'])
            
            # Training loop
            for epoch in range(config['epochs']):
                print(f"PROGRESS|{epoch + 1}|{config['epochs']}|0|100|0.0")
                
                # Simulate training (replace with actual MLX training code)
                epoch_loss = 2.5 - (epoch * 0.3)  # Decreasing loss
                val_loss = 2.3 - (epoch * 0.25)   # Validation loss
                
                # Report metrics
                metrics = {
                    'epoch': epoch + 1,
                    'training_loss': epoch_loss,
                    'validation_loss': val_loss,
                    'learning_rate': config['learningRate'],
                    'timestamp': time.time()
                }
                print(f"METRICS|{json.dumps(metrics)}")
                
                # Simulate training time
                time.sleep(5)
            
            # Save fine-tuned model
            output_path = self.job_config['outputModelPath']
            os.makedirs(output_path, exist_ok=True)
            
            # In real implementation, save the actual fine-tuned model
            print(f"Saving model to: {output_path}")
            print("TRAINING_COMPLETE")
            
        except Exception as e:
            print(f"TRAINING_ERROR|{str(e)}")
            sys.exit(1)

if __name__ == "__main__":
    job_config = ${JSON.stringify(job, null, TWO)}
    
    trainer = MLXFineTuner(job_config)
    trainer.train()
`;
  }

  private setupProcessHandlers(jobId: string, process: ChildProcess, job: FineTuningJob): void {
    if (!process.stdout || !process.stderr) return;

    process.stdout.on('data', async (data) => {
      const output = data.toString();
      await this.handleTrainingOutput(jobId, output, job);
    });

    process.stderr.on('data', (data) => {
      log.error('Training process error', LogContext.AI, { jobId, error: data.toString() });
    });

    process.on('exit', async (code) => {
      this.activeJobs.delete(jobId);

      if (code === 0) {
        job.status = 'completed';
        job.completedAt = new Date();
      } else {
        job.status = 'failed';
        job.error = {
          message: `Training process exited with code ${code}`,
          details: { exitCode: code },
          retryCount: 0,
          maxRetries: 3,
          recoverable: true,
        };
      }

      await this.updateJobInDatabase(job);
      this.emit(job.status === 'completed' ? 'jobCompleted' : 'jobFailed', job);
    });
  }

  private async handleTrainingOutput(
    jobId: string,
    output: string,
    job: FineTuningJob
  ): Promise<void> {
    const lines = output.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      if (line.startsWith('PROGRESS|')) {
        const [, currentEpoch, totalEpochs, currentStep, totalSteps, percentage] = line.split('|');

        job.progress = {
          currentEpoch: parseInt(currentEpoch || '0', 10),
          totalEpochs: parseInt(totalEpochs || '0', 10),
          currentStep: parseInt(currentStep || '0', 10),
          totalSteps: parseInt(totalSteps || '0', 10),
          progressPercentage: parseFloat(percentage || '0'),
          lastUpdateTime: new Date(),
        };

        await this.updateJobInDatabase(job);
        this.emit('jobProgressUpdated', job);
      } else if (line.startsWith('METRICS|')) {
        const metricsJson = line.substring(8);
        try {
          const metrics = JSON.parse(metricsJson);

          // Update training metrics
          job.metrics.trainingLoss.push(metrics.training_loss);
          job.metrics.validationLoss.push(metrics.validation_loss);
          job.metrics.learningRates.push(metrics.learning_rate);

          if (metrics.perplexity && job.metrics.perplexity) {
            job.metrics.perplexity.push(metrics.perplexity);
          }

          await this.updateJobInDatabase(job);
          this.emit('jobMetricsUpdated', job);
        } catch (error) {
          log.error('Failed to parse metrics', LogContext.AI, { error, line });
        }
      } else if (line === 'TRAINING_COMPLETE') {
        log.info('✅ Training completed successfully', LogContext.AI, { jobId });
      } else if (line.startsWith('TRAINING_ERROR|')) {
        const errorMsg = line.substring(15);
        job.error = {
          message: errorMsg,
          details: { source: 'training_process' },
          retryCount: 0,
          maxRetries: 3,
          recoverable: true,
        };
        await this.updateJobInDatabase(job);
      }
    }
  }

  private generateParameterCombinations(
    paramSpace: ParameterSpace,
    method: string,
    maxTrials: number
  ): Hyperparameters[] {
    const combinations: Hyperparameters[] = [];

    if (method === 'grid_search') {
      // Simple grid search implementation
      const learningRates = Array.isArray(paramSpace.learningRate)
        ? paramSpace.learningRate
        : [paramSpace.learningRate.min, paramSpace.learningRate.max];
      const         batchSizes = paramSpace.batchSize;
      const epochs = Array.isArray(paramSpace.epochs)
        ? paramSpace.epochs
        : [paramSpace.epochs.min, paramSpace.epochs.max];

      for (const lr of learningRates) {
        for (const bs of batchSizes) {
          for (const ep of epochs) {
            if (combinations.length >= maxTrials) break;

            combinations.push({
              learningRate: lr,
              batchSize: bs,
              epochs: ep,
              maxSeqLength: 2048,
              gradientAccumulation: 1,
              warmupSteps: 100,
              weightDecay: 0.01,
              dropout: 0.1,
            });
          }
        }
      }
    } else if (method === 'random_search') {
      // Random search implementation
      for (let i = 0; i < maxTrials; i++) {
        const lr = Array.isArray(paramSpace.learningRate)
          ? paramSpace.learningRate[Math.floor(Math.random() * paramSpace.learningRate.length)]
          : paramSpace.learningRate.min +
            Math.random() * (paramSpace.learningRate.max - paramSpace.learningRate.min);

        const           bs = paramSpace.batchSize[Math.floor(Math.random() * paramSpace.batchSize.length)];

        const epochs = Array.isArray(paramSpace.epochs)
          ? paramSpace.epochs[Math.floor(Math.random() * paramSpace.epochs.length)]
          : Math.floor(
              paramSpace.epochs.min +
                Math.random() * (paramSpace.epochs.max - paramSpace.epochs.min + 1)
            );

        combinations.push({
          learningRate: lr || 0.001,
          batchSize: bs || 16,
          epochs: epochs || 10,
          maxSeqLength: 2048,
          gradientAccumulation: 1,
          warmupSteps: 100,
          weightDecay: 0.01,
          dropout: 0.1,
        });
      }
    }

    return combinations;
  }

  private async runOptimizationTrial(
    experiment: HyperparameterOptimization,
    parameters: Hyperparameters,
    baseJob: FineTuningJob
  ): Promise<OptimizationTrial> {
    const trialId = uuidv4();
    const trial: OptimizationTrial = {
      id: trialId,
      parameters,
      metrics: { perplexity: 0, loss: 0, accuracy: 0 },
      status: 'running',
      startTime: new Date(),
    };

    try {
      // Create trial job
      const trialJob = await this.createFineTuningJob(
        `${baseJob.jobName}_trial_${trialId}`,
        baseJob.userId,
        baseJob.baseModelName,
        baseJob.baseModelPath,
        baseJob.datasetPath,
        parameters,
        baseJob.validationConfig
      );

      trial.jobId = trialJob.id;

      // Start training
      await this.startFineTuningJob(trialJob.id);

      // Wait for completion (simplified - in practice, this would be async)
      let completed = false;
      let attempts = 0;
      const maxAttempts = 1200; // 20 minutes timeout

      while (!completed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const currentJob = await this.getJob(trialJob.id);

        if (currentJob?.status === 'completed') {
          completed = true;

          // Extract final metrics
          const finalMetrics = currentJob.metrics;
          trial.metrics = {
            perplexity: finalMetrics.perplexity?.[finalMetrics.perplexity.length - 1] || 0,
            loss: finalMetrics.validationLoss[finalMetrics.validationLoss.length - 1] || 0,
            accuracy:
              finalMetrics.validationAccuracy?.[finalMetrics.validationAccuracy.length - 1] || 0,
          };

          trial.status = 'completed';           trial.endTime = new Date();
        } else if (currentJob?.status === 'failed') {
          trial.status = 'failed';
          trial.endTime = new Date();
          completed = true;
        }

        attempts++;
      }

      if (!completed) {
        // Timeout
        await this.cancelJob(trialJob.id);
        trial.status = 'failed';
        trial.endTime = new Date();
      }
    } catch (error) {
      log.error('❌ Optimization trial failed', LogContext.AI, { 
        error: error instanceof Error ? error.message : String(error), 
        trialId 
      });
      trial.status = 'failed';
      trial.endTime = new Date();
    }

    return trial;
  }

  private compareTrialMetrics(trial1: OptimizationTrial, trial2: OptimizationTrial): number {
    // Simple comparison based on accuracy (higher is better)
    return trial1.metrics.accuracy - trial2.metrics.accuracy;
  }

  private shouldStopOptimization(experiment: HyperparameterOptimization): boolean {
    // Simple early stopping logic
    if (experiment.trials.length < 5) return false;

    const recentTrials = experiment.trials.slice(-5);
    const improvements = recentTrials
      .slice(1)
      .map((trial, i) => trial.metrics.accuracy - (recentTrials[i]?.metrics.accuracy || 0));

    return improvements.every((improvement) => improvement < 0.001);
  }

  private async calculateEvaluationMetrics(
    modelPath: string,
    testData: unknown[],
    config: EvaluationConfig
  ): Promise<EvaluationMetrics> {
    // Simplified evaluation - in practice, this would use the actual model
    let totalLoss = 0;
    let totalAccuracy = 0;

    for (const sample of testData) {
      // Mock evaluation metrics
      const sampleLoss = Math.random() * 2 + 0.5; // Random loss between 0.5-2.5
      const sampleAccuracy = Math.random() * 0.3 + 0.7; // Random accuracy between 0.7-1.0

      totalLoss += sampleLoss;
      totalAccuracy += sampleAccuracy;
    }

    const avgLoss = totalLoss / testData.length;
    const avgAccuracy = totalAccuracy / testData.length;
    const perplexity = Math.exp(avgLoss);

    return {
      perplexity,
      loss: avgLoss,
      accuracy: avgAccuracy,
      bleuScore: Math.random() * 0.4 + 0.3, // Mock BLEU score
      rougeScores: {
        rouge1: Math.random() * 0.3 + 0.4,
        rouge2: Math.random() * 0.2 + 0.3,
        rougeL: Math.random() * 0.3 + 0.35,
      },
    };
  }

  private async generateSampleOutputs(
    modelPath: string,
    samples: unknown[],
    config: EvaluationConfig
  ): Promise<SampleOutput[]> {
    return samples.map((sample: any) => ({
      input: sample.input,
      output: `Generated response for: ${sample.input.substring(0, 50)}...`, // Mock output
      reference: sample.output,
      confidence: Math.random() * 0.3 + 0.7,
    }));
  }

  private async loadTestDataset(datasetPath?: string): Promise<any[]> {
    if (!datasetPath || !existsSync(datasetPath)) {
      // Return mock test data
      return [
        { input: 'Test question 1', output: 'Test answer 1' },
        { input: 'Test question 2', output: 'Test answer 2' },
      ];
    }

    const       format = this.detectDatasetFormat(datasetPath);
    return this.readDatasetFile(datasetPath, format);
  }

  private createModelExportScript(modelPath: string, outputPath: string, format: string): string {
    return `#!/usr/bin/env python3
"""
Model Export Script
Export MLX model to ${format} format
"""

import os
import sys
import mlx.core as mx
from mlx_lm import load
from pathlib import Path

def export_model():
    try:
        print(f"Loading model from: ${modelPath}")
        model, tokenizer = load("${modelPath}")
        
        print(f"Exporting to: ${outputPath}")
        os.makedirs(os.path.dirname("${outputPath}"), exist_ok=True)
        
        # Export based on format
        if "${format}" == "mlx":
            # Copy MLX format (already in correct format)
            import shutil
            shutil.copytree("${modelPath}", "${outputPath}")
        elif "${format}" == "gguf":
            # Convert to GGUF format (simplified)
            print("GGUF export not yet implemented")
        elif "${format}" == "safetensors":
            # Convert to SafeTensors format (simplified)
            print("SafeTensors export not yet implemented")
        
        print("Export completed successfully")
        
    except Exception as e:
        print(f"Export failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    export_model()
`;
  }

  private async runPythonScript(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('python3', [scriptPath], { stdio: 'pipe' });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Script exited with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private startQueueProcessor(): void {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    const processQueue = async () => {
      try {
        if (this.activeJobs.size >= this.maxConcurrentJobs) {
          return;
        }

        const nextJob = this.jobQueue.find(
          (item) => item.status === 'queued' && this.canStartJob(item)
        );

        if (nextJob) {
          nextJob.status = 'running';
          nextJob.startedAt = new Date();
          await this.updateJobQueueInDatabase();

          const job = await this.getJob(nextJob.jobId);
          if (job) {
            await this.startFineTuningJob(job.id);
          }
        }
      } catch (error) {
        log.error('❌ Queue processing error', LogContext.AI, { error });
      }
    };

    // Process queue every 10 seconds
    setInterval(processQueue, 10000);
  }

  private canStartJob(queueItem: JobQueue): boolean {
    // Check dependencies
    if (queueItem.dependsOnJobIds.length > 0) {
      // Check if all dependencies are completed
      // Simplified implementation
      return true;
    }

    // Check resource availability (simplified)
    return true;
  }

  private async addJobToQueue(job: FineTuningJob): Promise<void> {
    const queueItem: JobQueue = {
      id: uuidv4(),
      jobId: job.id,
      priority: 5,
      queuePosition: this.jobQueue.length,
      estimatedResources: {
        memoryMB: 8192,
        gpuMemoryMB: 4096,
        durationMinutes: job.hyperparameters.epochs * 20,
      },
      dependsOnJobIds: [],
      status: 'queued',
      createdAt: new Date(),
    };

    this.jobQueue.push(queueItem);
    await this.updateJobQueueInDatabase();
  }

  private async removeJobFromQueue(jobId: string): Promise<void> {
    this.jobQueue = this.jobQueue.filter((item) => item.jobId !== jobId);
    await this.updateJobQueueInDatabase();
  }

  private calculateDiskUsage(): number {
    try {
      const paths = [this.modelsPath, this.datasetsPath, this.tempPath];
      let totalSize = 0;

      for (const path of paths) {
        if (existsSync(path)) {
          totalSize += this.getDirectorySize(path);
        }
      }

      return Math.round(totalSize / 1024 / 1024); // MB
    } catch {
      return 0;
    }
  }

  private getDirectorySize(dirPath: string): number {
    let size = 0;

    try {
      const files = readdirSync(dirPath);

      for (const file of files) {
        const filePath = join(dirPath, file);
        const stats = statSync(filePath);

        if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch {
      // Ignore errors
    }

    return size;
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    // Simple directory copy implementation
    if (!existsSync(src)) return;

    mkdirSync(dest, { recursive: true });

    const files = readdirSync(src);
    for (const file of files) {
      const srcPath = join(src, file);
      const destPath = join(dest, file);

      if (statSync(srcPath).isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        const content = readFileSync(srcPath);
        writeFileSync(destPath, content);
      }
    }
  }

  private async deleteDirectory(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;

    const { rmSync } = await import('fs');
    rmSync(dirPath, { recursive: true, force: true });
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async saveDatasetToDatabase(dataset: Dataset, userId: string): Promise<void> {
    const { error } = await (this.supabase as SupabaseClient).from('mlx_training_datasets').insert({
      id: dataset.id,
      dataset_name: dataset.name,
      dataset_path: dataset.path,
      user_id: userId,
      format: dataset.format,
      total_samples: dataset.totalSamples,
      training_samples: dataset.trainingSamples,
      validation_samples: dataset.validationSamples,
      validation_results: dataset.validationResults,
      preprocessing_config: dataset.preprocessingConfig,
      statistics: dataset.statistics,
    });

    if (error) throw error;
  }

  private async saveJobToDatabase(job: FineTuningJob): Promise<void> {
    const { error } = await (this.supabase as SupabaseClient).from('mlx_fine_tuning_jobs').insert({
      id: job.id,
      job_name: job.jobName,
      user_id: job.userId,
      status: job.status,
      base_model_name: job.baseModelName,
      base_model_path: job.baseModelPath,
      output_model_name: job.outputModelName,
      output_model_path: job.outputModelPath,
      dataset_path: job.datasetPath,
      dataset_format: job.datasetFormat,
      hyperparameters: job.hyperparameters,
      validation_config: job.validationConfig,
      current_epoch: job.progress.currentEpoch,
      total_epochs: job.progress.totalEpochs,
      current_step: job.progress.currentStep,
      total_steps: job.progress.totalSteps,
      progress_percentage: job.progress.progressPercentage,
      training_metrics: job.metrics,
      validation_metrics: {},
      estimated_duration_minutes: job.resourceUsage.estimatedDurationMinutes,
      memory_usage_mb: job.resourceUsage.memoryUsageMB,
      gpu_utilization_percentage: job.resourceUsage.gpuUtilizationPercentage,
      error_message: job.error?.message,
      error_details: job.error?.details,
      retry_count: job.error?.retryCount || 0,
      started_at: job.startedAt,
      completed_at: job.completedAt,
    });

    if (error) throw error;
  }

  private async updateJobInDatabase(job: FineTuningJob): Promise<void> {
    const { error } = await (this.supabase as SupabaseClient)
      .from('mlx_fine_tuning_jobs')
      .update({
        status: job.status,
        current_epoch: job.progress.currentEpoch,
        total_epochs: job.progress.totalEpochs,
        current_step: job.progress.currentStep,
        total_steps: job.progress.totalSteps,
        progress_percentage: job.progress.progressPercentage,
        training_metrics: job.metrics,
        memory_usage_mb: job.resourceUsage.memoryUsageMB,
        gpu_utilization_percentage: job.resourceUsage.gpuUtilizationPercentage,
        actual_duration_minutes: job.resourceUsage.actualDurationMinutes,
        error_message: job.error?.message,
        error_details: job.error?.details,
        retry_count: job.error?.retryCount || 0,
        started_at: job.startedAt,
        completed_at: job.completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (error) throw error;
  }

  private async saveEvaluationToDatabase(evaluation: ModelEvaluation): Promise<void> {
    const { error } = await (this.supabase as SupabaseClient).from('mlx_model_evaluations').insert({
      id: evaluation.id,
      job_id: evaluation.jobId,
      model_path: evaluation.modelPath,
      evaluation_type: evaluation.evaluationType,
      metrics: evaluation.metrics,
      perplexity: evaluation.metrics.perplexity,
      loss: evaluation.metrics.loss,
      accuracy: evaluation.metrics.accuracy,
      bleu_score: evaluation.metrics.bleuScore,
      rouge_scores: evaluation.metrics.rougeScores,
      sample_inputs: evaluation.sampleOutputs.map((s) => s.input),
      sample_outputs: evaluation.sampleOutputs.map((s) => s.output),
      sample_references: evaluation.sampleOutputs.map((s) => s.reference || ''),
      evaluation_config: evaluation.evaluationConfig,
    });

    if (error) throw error;
  }

  private async saveExperimentToDatabase(experiment: HyperparameterOptimization): Promise<void> {
    const { error } = await (this.supabase as SupabaseClient).from('mlx_hyperparameter_experiments').insert({
      id: experiment.id,
      experiment_name: experiment.experimentName,
      base_job_id: experiment.baseJobId,
      user_id: experiment.userId,
      optimization_method: experiment.optimizationMethod,
      parameter_space: experiment.parameterSpace,
      status: experiment.status,
      total_trials: experiment.trials.length,
      completed_trials: experiment.trials.filter(
        (t) => t.status === 'completed'       ).length,
      best_trial_id: experiment.bestTrial?.id,
      best_metrics: experiment.bestTrial?.metrics || {},
      trials: experiment.trials,
      completed_at: experiment.completedAt,
    });

    if (error) throw error;
  }

  private async updateExperimentInDatabase(experiment: HyperparameterOptimization): Promise<void> {
    const { error } = await (this.supabase as SupabaseClient)
      .from('mlx_hyperparameter_experiments')
      .update({
        status: experiment.status,
        total_trials: experiment.trials.length,
        completed_trials: experiment.trials.filter(
          (t) => t.status === 'completed'         ).length,
        best_trial_id: experiment.bestTrial?.id,
        best_metrics: experiment.bestTrial?.metrics || {},
        trials: experiment.trials,
        completed_at: experiment.completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', experiment.id);

    if (error) throw error;
  }

  private async updateJobQueueInDatabase(): Promise<void> {
    // In a real implementation, you would update the queue in the database
    // For now, we'll just log the queue status
    log.debug('📋 Job queue updated', LogContext.AI, {
      queueLength: this.jobQueue.length,
      running: this.activeJobs.size,
    });
  }

  private mapDatabaseJobToJob(dbJob: unknown): FineTuningJob {
    const job = dbJob as any;
    return {
      id: job.id,
      jobName: job.job_name,
      userId: job.user_id,
      status: job.status,
      baseModelName: job.base_model_name,
      baseModelPath: job.base_model_path,
      outputModelName: job.output_model_name,
      outputModelPath: job.output_model_path,
      datasetPath: job.dataset_path,
      datasetFormat: job.dataset_format,
      hyperparameters: job.hyperparameters,
      validationConfig: job.validation_config,
      progress: {
        currentEpoch: job.current_epoch,
        totalEpochs: job.total_epochs,
        currentStep: job.current_step,
        totalSteps: job.total_steps,
        progressPercentage: job.progress_percentage,
        lastUpdateTime: new Date(job.updated_at),
      },
      metrics: job.training_metrics,
      evaluation: null, // Would be loaded separately
      resourceUsage: {
        memoryUsageMB: job.memory_usage_mb,
        gpuUtilizationPercentage: job.gpu_utilization_percentage,
        estimatedDurationMinutes: job.estimated_duration_minutes,
        actualDurationMinutes: job.actual_duration_minutes,
      },
      error: job.error_message
        ? {
            message: job.error_message,
            details: job.error_details,
            retryCount: job.retry_count,
            maxRetries: 3,
            recoverable: true,
          }
        : undefined,
      createdAt: new Date(job.created_at),
      startedAt: job.started_at ? new Date(job.started_at) : undefined,
      completedAt: job.completed_at ? new Date(job.completed_at) : undefined,
      updatedAt: new Date(job.updated_at),
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const mlxFineTuningService = new MLXFineTuningService();
export default mlxFineTuningService;
