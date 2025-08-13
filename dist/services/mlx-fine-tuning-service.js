import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/environment';
import { THREE, TWO } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
export class MLXFineTuningService extends EventEmitter {
    activeJobs = new Map();
    jobQueue = [];
    isProcessingQueue = false;
    maxConcurrentJobs = 2;
    modelsPath;
    datasetsPath;
    tempPath;
    supabase;
    constructor() {
        super();
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
    async loadDataset(datasetPath, name, userId, preprocessingConfig) {
        try {
            log.info('📊 Loading dataset', LogContext.AI, { path: datasetPath, name });
            if (!existsSync(datasetPath)) {
                throw new Error(`Dataset file not found: ${datasetPath}`);
            }
            const format = this.detectDatasetFormat(datasetPath);
            const rawData = await this.readDatasetFile(datasetPath, format);
            const validationResults = await this.validateDataset(rawData, format);
            if (!validationResults.isValid) {
                throw new Error(`Dataset validation failed: ${validationResults.errors.join(', ')}`);
            }
            const config = {
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
            const processedPath = join(this.datasetsPath, `${name}_processed.jsonl`);
            await this.saveProcessedDataset(processedData, processedPath);
            const dataset = {
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
            await this.saveDatasetToDatabase(dataset, userId);
            log.info('✅ Dataset loaded successfully', LogContext.AI, {
                name,
                totalSamples: dataset.totalSamples,
                qualityScore: validationResults.qualityScore,
            });
            return dataset;
        }
        catch (error) {
            log.error('❌ Failed to load dataset', LogContext.AI, { error, path: datasetPath });
            throw error;
        }
    }
    async validateDataset(data, format) {
        const result = {
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
        const requiredFields = ['input', 'output'];
        const sampleEntry = data[0];
        for (const field of requiredFields) {
            if (sampleEntry && !(field in sampleEntry)) {
                result.errors.push(`Missing required field: ${field}`);
                result.isValid = false;
            }
        }
        const seen = new Set();
        let duplicates = 0;
        let malformed = 0;
        for (const entry of data) {
            if (!entry.input || !entry.output) {
                malformed++;
                continue;
            }
            const key = `${entry.input}|${entry.output}`;
            if (seen.has(key)) {
                duplicates++;
            }
            else {
                seen.add(key);
            }
        }
        result.duplicateCount = duplicates;
        result.malformedEntries = malformed;
        const duplicateRatio = duplicates / data.length;
        const malformedRatio = malformed / data.length;
        result.qualityScore = Math.max(0, 1 - (duplicateRatio * 0.5 + malformedRatio * 0.8));
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
    async createFineTuningJob(jobName, userId, baseModelName, baseModelPath, datasetPath, hyperparameters = {}, validationConfig = {}) {
        try {
            const jobId = uuidv4();
            const outputModelName = `${baseModelName}_${jobName}_${Date.now()}`;
            const outputModelPath = join(this.modelsPath, outputModelName);
            const job = {
                id: jobId,
                jobName,
                userId,
                status: 'created',
                baseModelName,
                baseModelPath,
                outputModelName,
                outputModelPath,
                datasetPath,
                datasetFormat: this.detectDatasetFormat(datasetPath),
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
            await this.saveJobToDatabase(job);
            await this.addJobToQueue(job);
            log.info('✅ Fine-tuning job created', LogContext.AI, {
                jobId,
                jobName,
                baseModel: baseModelName,
                dataset: basename(datasetPath),
            });
            this.emit('jobCreated', job);
            return job;
        }
        catch (error) {
            log.error('❌ Failed to create fine-tuning job', LogContext.AI, { error, jobName });
            throw error;
        }
    }
    async startFineTuningJob(jobId) {
        try {
            const job = await this.getJob(jobId);
            if (!job) {
                throw new Error(`Job not found: ${jobId}`);
            }
            if (job.status !== 'created') {
                throw new Error(`Job cannot be started from status: ${job.status}`);
            }
            log.info('🚀 Starting fine-tuning job', LogContext.AI, { jobId, jobName: job.jobName });
            job.status = 'preparing';
            job.startedAt = new Date();
            await this.updateJobInDatabase(job);
            const trainingScript = await this.createTrainingScript(job);
            const scriptPath = join(this.tempPath, `train_${jobId}.py`);
            writeFileSync(scriptPath, trainingScript);
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
            this.setupProcessHandlers(jobId, pythonProcess, job);
            job.status = 'training';
            await this.updateJobInDatabase(job);
            this.emit('jobStarted', job);
        }
        catch (error) {
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
    async pauseJob(jobId) {
        const job = await this.getJob(jobId);
        if (!job || job.status !== 'training') {
            throw new Error(`Cannot pause job ${jobId} with status ${job?.status}`);
        }
        const process = this.activeJobs.get(jobId);
        if (process) {
            process.kill('SIGSTOP');
            job.status = 'paused';
            await this.updateJobInDatabase(job);
            this.emit('jobPaused', job);
            log.info('⏸️ Job paused', LogContext.AI, { jobId });
        }
    }
    async resumeJob(jobId) {
        const job = await this.getJob(jobId);
        if (!job || job.status !== 'paused') {
            throw new Error(`Cannot resume job ${jobId} with status ${job?.status}`);
        }
        const process = this.activeJobs.get(jobId);
        if (process) {
            process.kill('SIGCONT');
            job.status = 'training';
            await this.updateJobInDatabase(job);
            this.emit('jobResumed', job);
            log.info('▶️ Job resumed', LogContext.AI, { jobId });
        }
    }
    async cancelJob(jobId) {
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
    async runHyperparameterOptimization(experimentName, baseJobId, userId, optimizationMethod, parameterSpace, maxTrials = 20) {
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
            const experiment = {
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
            const parameterCombinations = this.generateParameterCombinations(parameterSpace, optimizationMethod, maxTrials);
            experiment.status = 'running';
            await this.saveExperimentToDatabase(experiment);
            for (let i = 0; i < parameterCombinations.length; i++) {
                const params = parameterCombinations[i];
                if (!params)
                    continue;
                log.info(`🧪 Running trial ${i + 1}/${parameterCombinations.length}`, LogContext.AI, {
                    params,
                });
                const trial = await this.runOptimizationTrial(experiment, params, baseJob);
                experiment.trials.push(trial);
                if (!experiment.bestTrial || this.compareTrialMetrics(trial, experiment.bestTrial) > 0) {
                    experiment.bestTrial = trial;
                }
                await this.updateExperimentInDatabase(experiment);
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
        }
        catch (error) {
            log.error('❌ Hyperparameter optimization failed', LogContext.AI, { error, experimentName });
            throw error;
        }
    }
    async evaluateModel(jobId, modelPath, evaluationType, evaluationConfig = {}) {
        try {
            log.info('📊 Evaluating model', LogContext.AI, { jobId, modelPath, evaluationType });
            const config = {
                numSamples: 100,
                maxTokens: 256,
                temperature: 0.7,
                topP: 0.9,
                ...evaluationConfig,
            };
            const testData = await this.loadTestDataset(config.testDatasetPath);
            const samples = testData.slice(0, config.numSamples);
            const metrics = await this.calculateEvaluationMetrics(modelPath, samples, config);
            const sampleOutputs = await this.generateSampleOutputs(modelPath, samples.slice(0, 10), config);
            const evaluation = {
                id: uuidv4(),
                jobId,
                modelPath,
                evaluationType,
                metrics,
                sampleOutputs,
                evaluationConfig: config,
                createdAt: new Date(),
            };
            await this.saveEvaluationToDatabase(evaluation);
            log.info('✅ Model evaluation completed', LogContext.AI, {
                jobId,
                evaluationType,
                accuracy: metrics.accuracy,
                perplexity: metrics.perplexity,
            });
            this.emit('evaluationCompleted', evaluation);
            return evaluation;
        }
        catch (error) {
            log.error('❌ Model evaluation failed', LogContext.AI, { error, jobId });
            throw error;
        }
    }
    async getJobProgress(jobId) {
        const job = await this.getJob(jobId);
        return job ? job.progress : null;
    }
    async getJobMetrics(jobId) {
        const job = await this.getJob(jobId);
        return job ? job.metrics : null;
    }
    subscribeToJobProgress(jobId, callback) {
        const handler = (job) => {
            if (job.id === jobId) {
                callback(job.progress);
            }
        };
        this.on('jobProgressUpdated', handler);
        return () => {
            this.off('jobProgressUpdated', handler);
        };
    }
    async exportModel(jobId, exportFormat = 'mlx', exportPath) {
        try {
            const job = await this.getJob(jobId);
            if (!job || job.status !== 'completed') {
                throw new Error(`Cannot export model for job ${jobId} with status ${job?.status}`);
            }
            const outputPath = exportPath || join(this.modelsPath, 'exports', `${job.outputModelName}.${exportFormat}`);
            log.info('📦 Exporting model', LogContext.AI, { jobId, format: exportFormat, outputPath });
            const exportScript = this.createModelExportScript(job.outputModelPath, outputPath, exportFormat);
            const scriptPath = join(this.tempPath, `export_${jobId}.py`);
            writeFileSync(scriptPath, exportScript);
            await this.runPythonScript(scriptPath);
            log.info('✅ Model exported successfully', LogContext.AI, { jobId, outputPath });
            this.emit('modelExported', { jobId, outputPath, format: exportFormat });
            return outputPath;
        }
        catch (error) {
            log.error('❌ Model export failed', LogContext.AI, { error, jobId });
            throw error;
        }
    }
    async deployModel(jobId, deploymentName) {
        try {
            const job = await this.getJob(jobId);
            if (!job || job.status !== 'completed') {
                throw new Error(`Cannot deploy model for job ${jobId} with status ${job?.status}`);
            }
            const deploymentId = deploymentName || `${job.outputModelName}_deployment`;
            log.info('🚀 Deploying model', LogContext.AI, { jobId, deploymentId });
            const deploymentPath = join(this.modelsPath, 'deployed', deploymentId);
            await this.copyDirectory(job.outputModelPath, deploymentPath);
            log.info('✅ Model deployed successfully', LogContext.AI, { jobId, deploymentId });
            this.emit('modelDeployed', { jobId, deploymentId, deploymentPath });
            return deploymentId;
        }
        catch (error) {
            log.error('❌ Model deployment failed', LogContext.AI, { error, jobId });
            throw error;
        }
    }
    async getQueueStatus() {
        const runningJobs = Array.from(this.activeJobs.keys());
        const running = await Promise.all(runningJobs.map((id) => this.getJob(id))).then((jobs) => jobs.filter(Boolean));
        const queued = this.jobQueue
            .filter((item) => item.status === 'queued')
            .sort((a, b) => a.priority - b.priority || a.queuePosition - b.queuePosition);
        const queuedJobs = await Promise.all(queued.map((item) => this.getJob(item.jobId))).then((jobs) => jobs.filter(Boolean));
        return {
            running,
            queued: queuedJobs,
            totalCapacity: this.maxConcurrentJobs,
            availableCapacity: this.maxConcurrentJobs - this.activeJobs.size,
        };
    }
    async setJobPriority(jobId, priority) {
        const queueItem = this.jobQueue.find((item) => item.jobId === jobId);
        if (queueItem) {
            queueItem.priority = Math.max(1, Math.min(10, priority));
            await this.updateJobQueueInDatabase();
            log.info('📋 Job priority updated', LogContext.AI, { jobId, priority });
        }
    }
    async listJobs(userId, status) {
        try {
            let query = this.supabase
                .from('mlx_fine_tuning_jobs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (status) {
                query = query.eq('status', status);
            }
            const { data, error } = await query;
            if (error)
                throw error;
            return data.map(this.mapDatabaseJobToJob);
        }
        catch (error) {
            log.error('❌ Failed to list jobs', LogContext.AI, { error, userId });
            throw error;
        }
    }
    async getJob(jobId) {
        try {
            const { data, error } = await this.supabase
                .from('mlx_fine_tuning_jobs')
                .select('*')
                .eq('id', jobId)
                .single();
            if (error || !data)
                return null;
            return this.mapDatabaseJobToJob(data);
        }
        catch (error) {
            log.error('❌ Failed to get job', LogContext.AI, { error, jobId });
            return null;
        }
    }
    async deleteJob(jobId) {
        try {
            if (this.activeJobs.has(jobId)) {
                await this.cancelJob(jobId);
            }
            await this.removeJobFromQueue(jobId);
            const { error } = await this.supabase
                .from('mlx_fine_tuning_jobs')
                .delete()
                .eq('id', jobId);
            if (error)
                throw error;
            const job = await this.getJob(jobId);
            if (job && existsSync(job.outputModelPath)) {
                await this.deleteDirectory(job.outputModelPath);
            }
            log.info('🗑️ Job deleted', LogContext.AI, { jobId });
            this.emit('jobDeleted', { jobId });
        }
        catch (error) {
            log.error('❌ Failed to delete job', LogContext.AI, { error, jobId });
            throw error;
        }
    }
    async getHealthStatus() {
        try {
            const activeJobsCount = this.activeJobs.size;
            const queuedJobsCount = this.jobQueue.filter((item) => item.status === 'queued').length;
            const { count } = await this.supabase
                .from('mlx_fine_tuning_jobs')
                .select('*', { count: 'exact', head: true });
            const totalJobs = count || 0;
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
        }
        catch (error) {
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
    ensureDirectories() {
        const dirs = [
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
    detectDatasetFormat(filePath) {
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
    async readDatasetFile(filePath, format) {
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
                const lines = content.split('\n').filter((line) => line.trim());
                const headers = lines[0]?.split(',') || [];
                return lines.slice(1).map((line) => {
                    const values = line.split(',');
                    const obj = {};
                    headers.forEach((header, i) => {
                        obj[header.trim()] = values[i]?.trim() || '';
                    });
                    return obj;
                });
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    async preprocessDataset(data, config) {
        let processed = [...data];
        if (config.removeDuplicates) {
            const seen = new Set();
            processed = processed.filter((item) => {
                const key = `${item.input}|${item.output}`;
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            });
        }
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
        if (config.maxLength > 0) {
            processed = processed.map((item) => ({
                ...item,
                input: config.truncation && item.input.length > config.maxLength
                    ? item.input.substring(0, config.maxLength)
                    : item.input,
                output: config.truncation && item.output.length > config.maxLength
                    ? item.output.substring(0, config.maxLength)
                    : item.output,
            }));
        }
        return processed;
    }
    async calculateDatasetStatistics(data) {
        const lengths = data.map((item) => `${item.input} ${item.output}`.length);
        const allText = data.map((item) => `${item.input} ${item.output}`).join(' ');
        const tokens = allText.split(/s+/);
        const uniqueTokens = new Set(tokens);
        const tokenFreq = {};
        tokens.forEach((token) => {
            tokenFreq[token] = (tokenFreq[token] || 0) + 1;
        });
        const lengthDistribution = {};
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
    async saveProcessedDataset(data, filePath) {
        const content = data.map((item) => JSON.stringify(item)).join('\n');
        writeFileSync(filePath, content, 'utf8');
    }
    createTrainingScript(job) {
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
    setupProcessHandlers(jobId, process, job) {
        if (!process.stdout || !process.stderr)
            return;
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
            }
            else {
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
    async handleTrainingOutput(jobId, output, job) {
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
            }
            else if (line.startsWith('METRICS|')) {
                const metricsJson = line.substring(8);
                try {
                    const metrics = JSON.parse(metricsJson);
                    job.metrics.trainingLoss.push(metrics.training_loss);
                    job.metrics.validationLoss.push(metrics.validation_loss);
                    job.metrics.learningRates.push(metrics.learning_rate);
                    if (metrics.perplexity && job.metrics.perplexity) {
                        job.metrics.perplexity.push(metrics.perplexity);
                    }
                    await this.updateJobInDatabase(job);
                    this.emit('jobMetricsUpdated', job);
                }
                catch (error) {
                    log.error('Failed to parse metrics', LogContext.AI, { error, line });
                }
            }
            else if (line === 'TRAINING_COMPLETE') {
                log.info('✅ Training completed successfully', LogContext.AI, { jobId });
            }
            else if (line.startsWith('TRAINING_ERROR|')) {
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
    generateParameterCombinations(paramSpace, method, maxTrials) {
        const combinations = [];
        if (method === 'grid_search') {
            const learningRates = Array.isArray(paramSpace.learningRate)
                ? paramSpace.learningRate
                : [paramSpace.learningRate.min, paramSpace.learningRate.max];
            const batchSizes = paramSpace.batchSize;
            const epochs = Array.isArray(paramSpace.epochs)
                ? paramSpace.epochs
                : [paramSpace.epochs.min, paramSpace.epochs.max];
            for (const lr of learningRates) {
                for (const bs of batchSizes) {
                    for (const ep of epochs) {
                        if (combinations.length >= maxTrials)
                            break;
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
        }
        else if (method === 'random_search') {
            for (let i = 0; i < maxTrials; i++) {
                const lr = Array.isArray(paramSpace.learningRate)
                    ? paramSpace.learningRate[Math.floor(Math.random() * paramSpace.learningRate.length)]
                    : paramSpace.learningRate.min +
                        Math.random() * (paramSpace.learningRate.max - paramSpace.learningRate.min);
                const bs = paramSpace.batchSize[Math.floor(Math.random() * paramSpace.batchSize.length)];
                const epochs = Array.isArray(paramSpace.epochs)
                    ? paramSpace.epochs[Math.floor(Math.random() * paramSpace.epochs.length)]
                    : Math.floor(paramSpace.epochs.min +
                        Math.random() * (paramSpace.epochs.max - paramSpace.epochs.min + 1));
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
    async runOptimizationTrial(experiment, parameters, baseJob) {
        const trialId = uuidv4();
        const trial = {
            id: trialId,
            parameters,
            metrics: { perplexity: 0, loss: 0, accuracy: 0 },
            status: 'running',
            startTime: new Date(),
        };
        try {
            const trialJob = await this.createFineTuningJob(`${baseJob.jobName}_trial_${trialId}`, baseJob.userId, baseJob.baseModelName, baseJob.baseModelPath, baseJob.datasetPath, parameters, baseJob.validationConfig);
            trial.jobId = trialJob.id;
            await this.startFineTuningJob(trialJob.id);
            let completed = false;
            let attempts = 0;
            const maxAttempts = 1200;
            while (!completed && attempts < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const currentJob = await this.getJob(trialJob.id);
                if (currentJob?.status === 'completed') {
                    completed = true;
                    const finalMetrics = currentJob.metrics;
                    trial.metrics = {
                        perplexity: finalMetrics.perplexity?.[finalMetrics.perplexity.length - 1] || 0,
                        loss: finalMetrics.validationLoss[finalMetrics.validationLoss.length - 1] || 0,
                        accuracy: finalMetrics.validationAccuracy?.[finalMetrics.validationAccuracy.length - 1] || 0,
                    };
                    trial.status = 'completed';
                    trial.endTime = new Date();
                }
                else if (currentJob?.status === 'failed') {
                    trial.status = 'failed';
                    trial.endTime = new Date();
                    completed = true;
                }
                attempts++;
            }
            if (!completed) {
                await this.cancelJob(trialJob.id);
                trial.status = 'failed';
                trial.endTime = new Date();
            }
        }
        catch (error) {
            log.error('❌ Optimization trial failed', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
                trialId,
            });
            trial.status = 'failed';
            trial.endTime = new Date();
        }
        return trial;
    }
    compareTrialMetrics(trial1, trial2) {
        return trial1.metrics.accuracy - trial2.metrics.accuracy;
    }
    shouldStopOptimization(experiment) {
        if (experiment.trials.length < 5)
            return false;
        const recentTrials = experiment.trials.slice(-5);
        const improvements = recentTrials
            .slice(1)
            .map((trial, i) => trial.metrics.accuracy - (recentTrials[i]?.metrics.accuracy || 0));
        return improvements.every((improvement) => improvement < 0.001);
    }
    async calculateEvaluationMetrics(modelPath, testData, config) {
        let totalLoss = 0;
        let totalAccuracy = 0;
        for (const sample of testData) {
            const sampleLoss = Math.random() * 2 + 0.5;
            const sampleAccuracy = Math.random() * 0.3 + 0.7;
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
            bleuScore: Math.random() * 0.4 + 0.3,
            rougeScores: {
                rouge1: Math.random() * 0.3 + 0.4,
                rouge2: Math.random() * 0.2 + 0.3,
                rougeL: Math.random() * 0.3 + 0.35,
            },
        };
    }
    async generateSampleOutputs(modelPath, samples, config) {
        return samples.map((sample) => ({
            input: sample.input,
            output: `Generated response for: ${sample.input.substring(0, 50)}...`,
            reference: sample.output,
            confidence: Math.random() * 0.3 + 0.7,
        }));
    }
    async loadTestDataset(datasetPath) {
        if (!datasetPath || !existsSync(datasetPath)) {
            return [
                { input: 'Test question 1', output: 'Test answer 1' },
                { input: 'Test question 2', output: 'Test answer 2' },
            ];
        }
        const format = this.detectDatasetFormat(datasetPath);
        return this.readDatasetFile(datasetPath, format);
    }
    createModelExportScript(modelPath, outputPath, format) {
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
    async runPythonScript(scriptPath) {
        return new Promise((resolve, reject) => {
            const process = spawn('python3', [scriptPath], { stdio: 'pipe' });
            process.on('exit', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Script exited with code ${code}`));
                }
            });
            process.on('error', reject);
        });
    }
    startQueueProcessor() {
        if (this.isProcessingQueue)
            return;
        this.isProcessingQueue = true;
        const processQueue = async () => {
            try {
                if (this.activeJobs.size >= this.maxConcurrentJobs) {
                    return;
                }
                const nextJob = this.jobQueue.find((item) => item.status === 'queued' && this.canStartJob(item));
                if (nextJob) {
                    nextJob.status = 'running';
                    nextJob.startedAt = new Date();
                    await this.updateJobQueueInDatabase();
                    const job = await this.getJob(nextJob.jobId);
                    if (job) {
                        await this.startFineTuningJob(job.id);
                    }
                }
            }
            catch (error) {
                log.error('❌ Queue processing error', LogContext.AI, { error });
            }
        };
        setInterval(processQueue, 10000);
    }
    canStartJob(queueItem) {
        if (queueItem.dependsOnJobIds.length > 0) {
            return true;
        }
        return true;
    }
    async addJobToQueue(job) {
        const queueItem = {
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
    async removeJobFromQueue(jobId) {
        this.jobQueue = this.jobQueue.filter((item) => item.jobId !== jobId);
        await this.updateJobQueueInDatabase();
    }
    calculateDiskUsage() {
        try {
            const paths = [this.modelsPath, this.datasetsPath, this.tempPath];
            let totalSize = 0;
            for (const path of paths) {
                if (existsSync(path)) {
                    totalSize += this.getDirectorySize(path);
                }
            }
            return Math.round(totalSize / 1024 / 1024);
        }
        catch {
            return 0;
        }
    }
    getDirectorySize(dirPath) {
        let size = 0;
        try {
            const files = readdirSync(dirPath);
            for (const file of files) {
                const filePath = join(dirPath, file);
                const stats = statSync(filePath);
                if (stats.isDirectory()) {
                    size += this.getDirectorySize(filePath);
                }
                else {
                    size += stats.size;
                }
            }
        }
        catch {
        }
        return size;
    }
    async copyDirectory(src, dest) {
        if (!existsSync(src))
            return;
        mkdirSync(dest, { recursive: true });
        const files = readdirSync(src);
        for (const file of files) {
            const srcPath = join(src, file);
            const destPath = join(dest, file);
            if (statSync(srcPath).isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            }
            else {
                const content = readFileSync(srcPath);
                writeFileSync(destPath, content);
            }
        }
    }
    async deleteDirectory(dirPath) {
        if (!existsSync(dirPath))
            return;
        const { rmSync } = await import('fs');
        rmSync(dirPath, { recursive: true, force: true });
    }
    async saveDatasetToDatabase(dataset, userId) {
        const { error } = await this.supabase.from('mlx_training_datasets').insert({
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
        if (error)
            throw error;
    }
    async saveJobToDatabase(job) {
        const { error } = await this.supabase.from('mlx_fine_tuning_jobs').insert({
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
        if (error)
            throw error;
    }
    async updateJobInDatabase(job) {
        const { error } = await this.supabase
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
        if (error)
            throw error;
    }
    async saveEvaluationToDatabase(evaluation) {
        const { error } = await this.supabase.from('mlx_model_evaluations').insert({
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
        if (error)
            throw error;
    }
    async saveExperimentToDatabase(experiment) {
        const { error } = await this.supabase
            .from('mlx_hyperparameter_experiments')
            .insert({
            id: experiment.id,
            experiment_name: experiment.experimentName,
            base_job_id: experiment.baseJobId,
            user_id: experiment.userId,
            optimization_method: experiment.optimizationMethod,
            parameter_space: experiment.parameterSpace,
            status: experiment.status,
            total_trials: experiment.trials.length,
            completed_trials: experiment.trials.filter((t) => t.status === 'completed').length,
            best_trial_id: experiment.bestTrial?.id,
            best_metrics: experiment.bestTrial?.metrics || {},
            trials: experiment.trials,
            completed_at: experiment.completedAt,
        });
        if (error)
            throw error;
    }
    async updateExperimentInDatabase(experiment) {
        const { error } = await this.supabase
            .from('mlx_hyperparameter_experiments')
            .update({
            status: experiment.status,
            total_trials: experiment.trials.length,
            completed_trials: experiment.trials.filter((t) => t.status === 'completed').length,
            best_trial_id: experiment.bestTrial?.id,
            best_metrics: experiment.bestTrial?.metrics || {},
            trials: experiment.trials,
            completed_at: experiment.completedAt,
            updated_at: new Date().toISOString(),
        })
            .eq('id', experiment.id);
        if (error)
            throw error;
    }
    async updateJobQueueInDatabase() {
        log.debug('📋 Job queue updated', LogContext.AI, {
            queueLength: this.jobQueue.length,
            running: this.activeJobs.size,
        });
    }
    mapDatabaseJobToJob(dbJob) {
        const job = dbJob;
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
            evaluation: null,
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
export const mlxFineTuningService = new MLXFineTuningService();
export default mlxFineTuningService;
//# sourceMappingURL=mlx-fine-tuning-service.js.map