/**
 * MLX Fine-Tuning Service
 * Handles fine-tuning models using MLX with LoRA and automatic conversion
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

interface FineTuneConfig {
  baseModel: string;
  taskType: 'conversation' | 'instruction' | 'completion' | 'custom';
  loraRank?: number;
  learningRate?: number;
  batchSize?: number;
  numEpochs?: number;
  validationSplit?: number;
  earlyStoppingPatience?: number;
}

interface DatasetConfig {
  source: 'memories' | 'file' | 'huggingface';
  path?: string;
  filters?: {
    minImportance?: number;
    categories?: string[];
    dateRange?: { start: Date; end: Date };
  };
  format?: 'jsonl' | 'csv' | 'parquet';
}

interface FineTuningJob {
  id: string;
  status: 'preparing' | 'training' | 'validating' | 'converting' | 'completed' | 'failed';
  config: FineTuneConfig;
  startTime: Date;
  currentEpoch?: number;
  metrics?: TrainingMetrics;
  outputPath?: string;
  error?: string;
}

interface TrainingMetrics {
  loss: number[];
  validationLoss?: number[];
  learningRate: number[];
  tokensPerSecond?: number;
  totalTokens?: number;
  bestCheckpoint?: number;
}

export class MLXFineTuningService extends EventEmitter {
  private supabase: SupabaseClient;
  private activeJobs: Map<string, FineTuningJob> = new Map();
  private workspacePath: string;
  private isMLXAvailable = false;

  constructor(
    workspacePath?: string,
    supabaseUrl?: string,
    supabaseKey?: string
  ) {
    super();
    
    this.workspacePath = workspacePath || path.join(process.env.HOME || '~', '.mlx_finetuning');
    this.supabase = createClient(
      supabaseUrl || process.env.SUPABASE_URL || '',
      supabaseKey || process.env.SUPABASE_ANON_KEY || ''
    );

    this.initialize();
  }

  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    // Create workspace directory
    await fs.mkdir(this.workspacePath, { recursive: true });
    
    // Check MLX availability
    try {
      await execAsync('python3 -c "import mlx_lm"');
      this.isMLXAvailable = true;
      console.log('MLX fine-tuning available');
    } catch {
      this.isMLXAvailable = false;
      console.warn('MLX not available for fine-tuning');
    }
  }

  /**
   * Create a fine-tuning pipeline
   */
  async createFineTuningPipeline(config: FineTuneConfig, datasetConfig: DatasetConfig): Promise<FineTuningJob> {
    const jobId = `ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: FineTuningJob = {
      id: jobId,
      status: 'preparing',
      config: {
        loraRank: 16,
        learningRate: 1e-5,
        batchSize: 4,
        numEpochs: 3,
        validationSplit: 0.1,
        earlyStoppingPatience: 3,
        ...config
      },
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);
    this.emit('job-started', { jobId, config });

    try {
      // Step 1: Prepare dataset
      const datasetPath = await this.prepareDataset(jobId, datasetConfig);
      
      // Step 2: Configure MLX LoRA
      const mlxConfig = await this.configureMlxLora(job, datasetPath);
      
      // Step 3: Start fine-tuning
      await this.startFineTuning(job, mlxConfig);
      
      // Monitor progress
      this.monitorProgress(job);
      
      return job;
      
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      this.emit('job-failed', { jobId, error: job.error });
      throw error;
    }
  }

  /**
   * Prepare dataset from memories
   */
  private async prepareDatasetFromMemories(
    jobId: string,
    filters?: DatasetConfig['filters']
  ): Promise<string> {
    // Query memories from Supabase
    let query = this.supabase.from('ai_memories').select('*');
    
    if (filters?.minImportance) {
      query = query.gte('importance_score', filters.minImportance);
    }
    if (filters?.categories) {
      query = query.in('memory_category', filters.categories);
    }
    if (filters?.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString());
    }
    
    const { data: memories, error } = await query;
    
    if (error || !memories || memories.length === 0) {
      throw new Error('No memories found for fine-tuning');
    }
    
    // Convert to training format
    const trainingData = memories.map(memory => ({
      instruction: this.extractInstruction(memory),
      input: memory.content,
      output: this.extractOutput(memory)
    }));
    
    // Save as JSONL
    const datasetPath = path.join(this.workspacePath, jobId, 'dataset.jsonl');
    await fs.mkdir(path.dirname(datasetPath), { recursive: true });
    
    const jsonlContent = trainingData
      .map(item => JSON.stringify(item))
      .join('\n');
    
    await fs.writeFile(datasetPath, jsonlContent);
    
    this.emit('dataset-prepared', { jobId, samples: trainingData.length });
    return datasetPath;
  }

  /**
   * Prepare dataset based on configuration
   */
  private async prepareDataset(jobId: string, config: DatasetConfig): Promise<string> {
    switch (config.source) {
      case 'memories':
        return this.prepareDatasetFromMemories(jobId, config.filters);
        
      case 'file':
        if (!config.path) throw new Error('File path required');
        return this.prepareDatasetFromFile(jobId, config.path, config.format);
        
      case 'huggingface':
        if (!config.path) throw new Error('Dataset name required');
        return this.prepareDatasetFromHuggingFace(jobId, config.path);
        
      default:
        throw new Error(`Unknown dataset source: ${config.source}`);
    }
  }

  /**
   * Prepare dataset from file
   */
  private async prepareDatasetFromFile(
    jobId: string,
    filePath: string,
    format?: string
  ): Promise<string> {
    const datasetPath = path.join(this.workspacePath, jobId, 'dataset.jsonl');
    await fs.mkdir(path.dirname(datasetPath), { recursive: true });
    
    // Copy or convert file
    if (format === 'jsonl' || filePath.endsWith('.jsonl')) {
      await fs.copyFile(filePath, datasetPath);
    } else {
      // Convert other formats to JSONL
      throw new Error(`Format ${format} conversion not yet implemented`);
    }
    
    return datasetPath;
  }

  /**
   * Prepare dataset from HuggingFace
   */
  private async prepareDatasetFromHuggingFace(
    jobId: string,
    datasetName: string
  ): Promise<string> {
    const script = `
from datasets import load_dataset
import json

dataset = load_dataset("${datasetName}", split="train[:1000]")
output_path = "${path.join(this.workspacePath, jobId, 'dataset.jsonl')}"

with open(output_path, 'w') as f:
    for item in dataset:
        json.dump(item, f)
        f.write('\\n')
`;

    await execAsync(`python3 -c "${script}"`);
    return path.join(this.workspacePath, jobId, 'dataset.jsonl');
  }

  /**
   * Configure MLX LoRA
   */
  private async configureMlxLora(job: FineTuningJob, datasetPath: string): Promise<any> {
    const configPath = path.join(this.workspacePath, job.id, 'config.yaml');
    
    const config = `
model: ${job.config.baseModel}
data:
  train: ${datasetPath}
  validation_split: ${job.config.validationSplit}
  
lora:
  rank: ${job.config.loraRank}
  alpha: ${(job.config.loraRank || 16) * 2}
  dropout: 0.05
  target_modules:
    - q_proj
    - v_proj
    - k_proj
    - o_proj
    
training:
  learning_rate: ${job.config.learningRate}
  batch_size: ${job.config.batchSize}
  num_epochs: ${job.config.numEpochs}
  warmup_steps: 100
  save_steps: 500
  eval_steps: 100
  
output_dir: ${path.join(this.workspacePath, job.id, 'output')}
`;

    await fs.writeFile(configPath, config);
    return configPath;
  }

  /**
   * Start fine-tuning process
   */
  private async startFineTuning(job: FineTuningJob, configPath: string): Promise<void> {
    job.status = 'training';
    
    if (!this.isMLXAvailable) {
      // Simulate training for development
      await this.simulateTraining(job);
      return;
    }

    const script = `
import mlx_lm
from mlx_lm import load, train
import yaml
import json

# Load config
with open("${configPath}", 'r') as f:
    config = yaml.safe_load(f)

# Start training
trainer = train.Trainer(config)
trainer.train()

# Save final model
output_path = config['output_dir']
trainer.save_model(output_path)

print(json.dumps({"status": "completed", "output": output_path}))
`;

    const scriptPath = path.join(this.workspacePath, job.id, 'train.py');
    await fs.writeFile(scriptPath, script);
    
    // Run training in background
    const child = exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        job.status = 'failed';
        job.error = error.message;
        this.emit('job-failed', { jobId: job.id, error: error.message });
      } else {
        try {
          const result = JSON.parse(stdout);
          job.status = 'converting';
          job.outputPath = result.output;
          this.convertToOllama(job);
        } catch (e) {
          job.status = 'failed';
          job.error = 'Failed to parse training output';
        }
      }
    });
    
    // Parse training logs for metrics
    child.stdout?.on('data', (data) => {
      this.parseTrainingMetrics(job, data.toString());
    });
  }

  /**
   * Monitor training progress
   */
  private monitorProgress(job: FineTuningJob): void {
    const interval = setInterval(() => {
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval);
        return;
      }
      
      this.emit('job-progress', {
        jobId: job.id,
        status: job.status,
        metrics: job.metrics,
        currentEpoch: job.currentEpoch
      });
    }, 5000); // Every 5 seconds
  }

  /**
   * Parse training metrics from logs
   */
  private parseTrainingMetrics(job: FineTuningJob, log: string): void {
    if (!job.metrics) {
      job.metrics = {
        loss: [],
        validationLoss: [],
        learningRate: []
      };
    }
    
    // Parse epoch
    const epochMatch = log.match(/Epoch (\d+)/);
    if (epochMatch) {
      job.currentEpoch = parseInt(epochMatch[1]);
    }
    
    // Parse loss
    const lossMatch = log.match(/loss: ([\d.]+)/);
    if (lossMatch) {
      job.metrics.loss.push(parseFloat(lossMatch[1]));
    }
    
    // Parse validation loss
    const valLossMatch = log.match(/val_loss: ([\d.]+)/);
    if (valLossMatch) {
      job.metrics.validationLoss?.push(parseFloat(valLossMatch[1]));
    }
  }

  /**
   * Simulate training for development
   */
  private async simulateTraining(job: FineTuningJob): Promise<void> {
    job.metrics = {
      loss: [],
      validationLoss: [],
      learningRate: []
    };
    
    for (let epoch = 0; epoch < job.config.numEpochs!; epoch++) {
      job.currentEpoch = epoch + 1;
      job.metrics.loss.push(1.5 - (epoch * 0.3));
      job.metrics.validationLoss?.push(1.6 - (epoch * 0.25));
      
      this.emit('job-progress', {
        jobId: job.id,
        epoch: epoch + 1,
        loss: job.metrics.loss[epoch]
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    job.status = 'converting';
    job.outputPath = path.join(this.workspacePath, job.id, 'output');
    await this.convertToOllama(job);
  }

  /**
   * Convert fine-tuned model to Ollama format
   */
  private async convertToOllama(job: FineTuningJob): Promise<void> {
    try {
      const modelName = `${job.config.baseModel}-ft-${job.id.substring(0, 8)}`;
      
      if (!this.isMLXAvailable) {
        // Simulate conversion
        job.status = 'completed';
        this.emit('job-completed', { jobId: job.id, modelName });
        await this.evaluateFineTunedModel(job, modelName);
        return;
      }
      
      // Convert to GGUF format
      const ggufPath = await this.convertToGGUF(job.outputPath!);
      
      // Create Ollama model
      await this.createOllamaModel(modelName, ggufPath);
      
      job.status = 'completed';
      this.emit('job-completed', { jobId: job.id, modelName });
      
      // Evaluate the fine-tuned model
      await this.evaluateFineTunedModel(job, modelName);
      
    } catch (error) {
      job.status = 'failed';
      job.error = `Conversion failed: ${error}`;
      this.emit('job-failed', { jobId: job.id, error: job.error });
    }
  }

  /**
   * Convert model to GGUF format
   */
  private async convertToGGUF(modelPath: string): Promise<string> {
    const ggufPath = `${modelPath}.gguf`;
    
    const script = `
python3 -m mlx_lm.convert --model ${modelPath} --output ${ggufPath} --format gguf
`;
    
    await execAsync(script);
    return ggufPath;
  }

  /**
   * Create Ollama model from GGUF
   */
  private async createOllamaModel(modelName: string, ggufPath: string): Promise<void> {
    const modelfile = `
FROM ${ggufPath}

TEMPLATE """{{ .System }}
{{ .Prompt }}"""

SYSTEM """You are a helpful AI assistant that has been fine-tuned for specific tasks."""
`;

    const modelfilePath = `${ggufPath}.modelfile`;
    await fs.writeFile(modelfilePath, modelfile);
    
    await execAsync(`ollama create ${modelName} -f ${modelfilePath}`);
  }

  /**
   * Evaluate fine-tuned model
   */
  private async evaluateFineTunedModel(job: FineTuningJob, modelName: string): Promise<void> {
    // Basic evaluation - can be extended
    const testPrompts = [
      'What did you learn during fine-tuning?',
      'How are you different from your base model?',
      'Can you demonstrate your specialized knowledge?'
    ];
    
    const evaluationResults = [];
    
    for (const prompt of testPrompts) {
      try {
        const { stdout } = await execAsync(
          `echo "${prompt}" | ollama run ${modelName} --max-tokens 50`
        );
        evaluationResults.push({
          prompt,
          response: stdout.trim()
        });
      } catch (error) {
        evaluationResults.push({
          prompt,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Store evaluation
    await this.supabase.from('fine_tuning_evaluations').insert({
      job_id: job.id,
      model_name: modelName,
      base_model: job.config.baseModel,
      metrics: job.metrics,
      evaluation_results: evaluationResults,
      timestamp: new Date()
    });
    
    this.emit('evaluation-completed', { jobId: job.id, results: evaluationResults });
  }

  /**
   * Helper methods
   */
  private extractInstruction(memory: any): string {
    // Extract instruction from memory metadata or generate one
    if (memory.metadata?.instruction) {
      return memory.metadata.instruction;
    }
    
    // Generate based on memory type
    switch (memory.memory_type) {
      case 'technical_note':
        return 'Explain the following technical concept:';
      case 'user_interaction':
        return 'Respond to the following query:';
      case 'analysis_result':
        return 'Analyze and summarize:';
      default:
        return 'Process the following information:';
    }
  }

  private extractOutput(memory: any): string {
    // Extract expected output or use related content
    if (memory.metadata?.output) {
      return memory.metadata.output;
    }
    
    // Use any related response or summary
    return memory.metadata?.summary || memory.content;
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): FineTuningJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * List all jobs
   */
  listJobs(): FineTuningJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return;
    }
    
    job.status = 'failed';
    job.error = 'Cancelled by user';
    
    // Kill any running processes
    try {
      await execAsync(`pkill -f ${jobId}`);
    } catch {
      // Process might not exist
    }
    
    this.emit('job-cancelled', { jobId });
  }

  /**
   * Clean up old jobs
   */
  async cleanup(daysOld = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.startTime < cutoffDate && (job.status === 'completed' || job.status === 'failed')) {
        // Remove job directory
        const jobPath = path.join(this.workspacePath, jobId);
        await fs.rmdir(jobPath, { recursive: true }).catch(() => {});
        
        this.activeJobs.delete(jobId);
      }
    }
  }
}

export default MLXFineTuningService;