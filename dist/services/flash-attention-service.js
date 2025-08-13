import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { join } from 'path';
import { log, LogContext } from '../utils/logger';
class FlashAttentionService extends EventEmitter {
    config;
    isInitialized = false;
    gpuDevices = [];
    optimizationProfiles = new Map();
    attentionCache = new Map();
    performanceMetrics = [];
    pythonProcess = null;
    CACHE_SIZE_LIMIT = 1000;
    METRICS_HISTORY_LIMIT = 100;
    constructor(config) {
        super();
        this.config = {
            enableGPU: true,
            enableCPU: true,
            batchSize: 1,
            sequenceLength: 2048,
            headDim: 64,
            numHeads: 12,
            blockSize: 64,
            enableMemoryOptimization: true,
            enableKernelFusion: true,
            fallbackToStandard: true,
            maxMemoryMB: 8192,
            deviceIds: [0],
            ...config,
        };
        this.setupOptimizationProfiles();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            log.info('⚡ Initializing FlashAttention Service', LogContext.AI);
            await this.detectSystemCapabilities();
            await this.initializePythonEnvironment();
            await this.validateFlashAttentionInstallation();
            await this.startOptimizationService();
            this.isInitialized = true;
            this.emit('initialized');
            log.info('✅ FlashAttention Service initialized', LogContext.AI, {
                gpuDevices: this.gpuDevices.length,
                cpuOptimization: this.config.enableCPU,
                memoryOptimization: this.config.enableMemoryOptimization,
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize FlashAttention Service', LogContext.AI, { error });
            throw error;
        }
    }
    async detectSystemCapabilities() {
        try {
            log.info('🔍 Detecting system capabilities for FlashAttention', LogContext.AI);
            if (this.config.enableGPU) {
                await this.detectGPUDevices();
            }
            if (this.config.enableCPU) {
                await this.detectCPUCapabilities();
            }
            this.optimizeConfiguration();
        }
        catch (error) {
            log.warn('⚠️ System capability detection failed, using defaults', LogContext.AI, { error });
        }
    }
    async detectGPUDevices() {
        try {
            const script = `
import torch
import json
import sys

try:
    if torch.cuda.is_available():
        devices = []
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            devices.append({
                "deviceId": i,
                "name": props.name,
                "memoryMB": int(props.total_memory / 1024 / 1024),
                "computeCapability": f"{props.major}.{props.minor}",
                "available": True
            })
        print(json.dumps(devices))
    else:
        print("[]")
except Exception as e:
    print("[]")
`;
            const result = await this.executePythonScript(script);
            this.gpuDevices = JSON.parse(result.trim()) || [];
            log.info('🖥️ GPU devices detected', LogContext.AI, {
                deviceCount: this.gpuDevices.length,
                devices: this.gpuDevices.map(d => ({ id: d.deviceId, name: d.name, memory: d.memoryMB })),
            });
        }
        catch (error) {
            log.warn('⚠️ GPU detection failed', LogContext.AI, { error });
            this.gpuDevices = [];
        }
    }
    async detectCPUCapabilities() {
        try {
            const script = `
import torch
import platform
import json

cpu_info = {
    "cores": torch.get_num_threads(),
    "architecture": platform.machine(),
    "processor": platform.processor(),
    "optimizations": []
}

# Check for CPU optimizations
try:
    import mkl
    cpu_info["optimizations"].append("MKL")
except ImportError:
    pass

try:
    if hasattr(torch, 'backends') and hasattr(torch.backends, 'mkl'):
        if torch.backends.mkl.is_available():
            cpu_info["optimizations"].append("MKL-DNN")
except:
    pass

print(json.dumps(cpu_info))
`;
            const result = await this.executePythonScript(script);
            const cpuInfo = JSON.parse(result.trim());
            log.info('🧮 CPU capabilities detected', LogContext.AI, cpuInfo);
        }
        catch (error) {
            log.warn('⚠️ CPU capability detection failed', LogContext.AI, { error });
        }
    }
    optimizeConfiguration() {
        if (this.gpuDevices.length === 0) {
            log.info('📱 No GPU detected, optimizing for CPU-only mode', LogContext.AI);
            this.config.enableGPU = false;
            this.config.blockSize = 32;
            this.config.batchSize = Math.min(this.config.batchSize, 4);
        }
        else {
            const bestGPU = this.gpuDevices.reduce((best, current) => current.memoryMB > best.memoryMB ? current : best);
            this.config.deviceIds = [bestGPU.deviceId];
            if (bestGPU.memoryMB < 4096) {
                log.info('📱 Low GPU memory detected, optimizing configuration', LogContext.AI);
                this.config.maxMemoryMB = Math.floor(bestGPU.memoryMB * 0.7);
                this.config.blockSize = 32;
                this.config.batchSize = Math.min(this.config.batchSize, 2);
            }
            else if (bestGPU.memoryMB >= 16384) {
                log.info('🚀 High-end GPU detected, enabling aggressive optimizations', LogContext.AI);
                this.config.blockSize = 128;
                this.config.enableKernelFusion = true;
            }
            log.info('🎯 Configuration optimized for GPU', LogContext.AI, {
                selectedGPU: bestGPU.name,
                memoryMB: bestGPU.memoryMB,
                blockSize: this.config.blockSize,
            });
        }
    }
    async initializePythonEnvironment() {
        try {
            log.info('🐍 Initializing Python environment for FlashAttention', LogContext.AI);
            const scriptsDir = join(process.cwd(), 'scripts', 'flash-attention');
            if (!existsSync(scriptsDir)) {
                throw new Error(`FlashAttention scripts directory not found: ${scriptsDir}`);
            }
            const scriptPath = join(scriptsDir, 'flash_attention_optimizer.py');
            if (!existsSync(scriptPath)) {
                throw new Error(`FlashAttention Python script not found: ${scriptPath}`);
            }
            const requirementsPath = join(scriptsDir, 'requirements.txt');
            if (!existsSync(requirementsPath)) {
                throw new Error(`FlashAttention requirements file not found: ${requirementsPath}`);
            }
            log.info('✅ Python environment verified', LogContext.AI, {
                scriptsDir,
                scriptPath,
                requirementsPath
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize Python environment', LogContext.AI, { error });
            throw error;
        }
    }
    async optimizeAttention(request) {
        if (!this.isInitialized) {
            throw new Error('FlashAttention service not initialized');
        }
        const startTime = Date.now();
        try {
            const cacheKey = this.generateCacheKey(request);
            if (request.useCache && this.attentionCache.has(cacheKey)) {
                const cached = this.attentionCache.get(cacheKey);
                return {
                    ...cached,
                    metrics: {
                        ...cached.metrics,
                        executionTimeMs: 0,
                        cacheHitRate: 1.0,
                    },
                };
            }
            const profile = this.selectOptimizationProfile(request);
            const optimizedConfig = { ...this.config, ...profile.config };
            const { query, key, value, attentionMask } = this.generateAttentionTensors(request);
            const result = await this.executeFlashAttention(query, key, value, attentionMask, optimizedConfig);
            const executionTime = Date.now() - startTime;
            const metrics = {
                executionTimeMs: executionTime,
                memoryUsageMB: result.memory_usage_mb || 0,
                throughputTokensPerSec: (request.inputTokens.length * 1000) / executionTime,
                speedupFactor: this.calculateSpeedup(executionTime, request),
                memoryEfficiency: this.calculateMemoryEfficiency(result.memory_usage_mb || 0, request),
                cacheHitRate: 0.0,
            };
            const response = {
                success: !result.error,
                attentionOutput: result.output || null,
                metrics,
                fallbackUsed: result.optimization_used !== 'flash_attention',
                optimizationApplied: [result.optimization_used || 'none', profile.name],
                error: result.error,
            };
            if (response.success && request.useCache) {
                this.cacheResult(cacheKey, response);
            }
            this.recordMetrics(metrics);
            this.emit('attentionOptimized', {
                modelId: request.modelId,
                providerId: request.providerId,
                metrics,
                success: response.success,
            });
            return response;
        }
        catch (error) {
            const errorResponse = {
                success: false,
                attentionOutput: null,
                metrics: {
                    executionTimeMs: Date.now() - startTime,
                    memoryUsageMB: 0,
                    throughputTokensPerSec: 0,
                    speedupFactor: 0,
                    memoryEfficiency: 0,
                },
                fallbackUsed: true,
                optimizationApplied: ['error'],
                error: error instanceof Error ? error.message : String(error),
            };
            log.error('❌ FlashAttention optimization failed', LogContext.AI, {
                modelId: request.modelId,
                error: errorResponse.error,
            });
            return errorResponse;
        }
    }
    async executeFlashAttention(query, key, value, attentionMask, config) {
        const inputData = {
            query,
            key,
            value,
            attention_mask: attentionMask,
            config,
        };
        const scriptPath = join(process.cwd(), 'scripts', 'flash-attention', 'flash_attention_optimizer.py');
        try {
            const result = await this.executePythonFile(scriptPath, JSON.stringify(inputData));
            return JSON.parse(result);
        }
        catch (error) {
            log.error('❌ Python script execution failed', LogContext.AI, { error });
            throw error;
        }
    }
    generateAttentionTensors(request) {
        const { batchSize } = request;
        const seqLen = request.sequenceLength;
        const { numHeads } = this.config;
        const { headDim } = this.config;
        const query = this.generateRandomTensor([batchSize, numHeads, seqLen, headDim]);
        const key = this.generateRandomTensor([batchSize, numHeads, seqLen, headDim]);
        const value = this.generateRandomTensor([batchSize, numHeads, seqLen, headDim]);
        const attentionMask = request.attentionMask ?
            this.reshapeAttentionMask(request.attentionMask, [batchSize, numHeads, seqLen, seqLen]) :
            null;
        return { query, key, value, attentionMask };
    }
    generateRandomTensor(shape) {
        const [batch = 1, heads = 1, seq = 1, dim = 1] = shape;
        const tensor = [];
        for (let b = 0; b < batch; b++) {
            tensor[b] = [];
            for (let h = 0; h < heads; h++) {
                tensor[b][h] = [];
                for (let s = 0; s < seq; s++) {
                    tensor[b][h][s] = [];
                    for (let d = 0; d < dim; d++) {
                        tensor[b][h][s][d] = Math.random() * 2 - 1;
                    }
                }
            }
        }
        return tensor;
    }
    reshapeAttentionMask(mask, shape) {
        const [batch = 1, heads = 1, seqLen = 1, seqLen2 = 1] = shape;
        const reshaped = [];
        if (!mask || mask.length === 0) {
            throw new Error('Invalid attention mask: mask is empty or undefined');
        }
        let idx = 0;
        for (let b = 0; b < batch; b++) {
            reshaped[b] = [];
            for (let s = 0; s < seqLen; s++) {
                reshaped[b][s] = [];
                for (let s2 = 0; s2 < seqLen2; s2++) {
                    reshaped[b][s][s2] = mask[idx % mask.length] || 0;
                    idx++;
                }
            }
        }
        return reshaped;
    }
    setupOptimizationProfiles() {
        const profiles = [
            {
                name: 'speed_optimized',
                description: 'Maximum speed with moderate memory usage',
                recommendedFor: ['real-time', 'interactive', 'low-latency'],
                config: {
                    blockSize: 128,
                    enableKernelFusion: true,
                    enableMemoryOptimization: false,
                    batchSize: 1,
                },
            },
            {
                name: 'memory_optimized',
                description: 'Minimum memory usage with acceptable speed',
                recommendedFor: ['large-models', 'limited-memory', 'mobile'],
                config: {
                    blockSize: 32,
                    enableMemoryOptimization: true,
                    enableKernelFusion: false,
                    batchSize: 1,
                },
            },
            {
                name: 'balanced',
                description: 'Balanced speed and memory usage',
                recommendedFor: ['general', 'production', 'default'],
                config: {
                    blockSize: 64,
                    enableMemoryOptimization: true,
                    enableKernelFusion: true,
                    batchSize: 2,
                },
            },
            {
                name: 'throughput_optimized',
                description: 'Maximum throughput for batch processing',
                recommendedFor: ['batch-processing', 'offline', 'high-throughput'],
                config: {
                    blockSize: 256,
                    enableKernelFusion: true,
                    enableMemoryOptimization: false,
                    batchSize: 8,
                },
            },
        ];
        profiles.forEach(profile => {
            this.optimizationProfiles.set(profile.name, profile);
        });
    }
    selectOptimizationProfile(request) {
        const levelToProfile = {
            'low': 'memory_optimized',
            'medium': 'balanced',
            'high': 'speed_optimized',
            'aggressive': 'throughput_optimized',
        };
        const profileName = levelToProfile[request.optimizationLevel] || 'balanced';
        return this.optimizationProfiles.get(profileName) || this.optimizationProfiles.get('balanced');
    }
    generateCacheKey(request) {
        const key = {
            modelId: request.modelId,
            providerId: request.providerId,
            sequenceLength: request.sequenceLength,
            batchSize: request.batchSize,
            optimizationLevel: request.optimizationLevel,
            inputHash: this.hashArray(request.inputTokens),
        };
        return JSON.stringify(key);
    }
    hashArray(arr) {
        let hash = 0;
        for (let i = 0; i < arr.length; i++) {
            const char = arr[i] || 0;
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
    cacheResult(key, result) {
        if (this.attentionCache.size >= this.CACHE_SIZE_LIMIT) {
            const firstKey = this.attentionCache.keys().next().value;
            if (firstKey) {
                this.attentionCache.delete(firstKey);
            }
        }
        this.attentionCache.set(key, result);
    }
    recordMetrics(metrics) {
        this.performanceMetrics.push(metrics);
        if (this.performanceMetrics.length > this.METRICS_HISTORY_LIMIT) {
            this.performanceMetrics.shift();
        }
    }
    calculateSpeedup(executionTime, request) {
        const baselineTime = this.estimateStandardAttentionTime(request);
        return baselineTime / executionTime;
    }
    estimateStandardAttentionTime(request) {
        const complexity = request.sequenceLength * request.sequenceLength * request.batchSize;
        return complexity * 0.001;
    }
    calculateMemoryEfficiency(memoryUsed, request) {
        const standardMemory = this.estimateStandardAttentionMemory(request);
        return standardMemory / Math.max(memoryUsed, 1);
    }
    estimateStandardAttentionMemory(request) {
        const attentionMatrixSize = request.sequenceLength * request.sequenceLength * request.batchSize * this.config.numHeads;
        return attentionMatrixSize * 4 / (1024 * 1024);
    }
    async executePythonScript(script) {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', ['-c', script]);
            let stdout = '';
            let stderr = '';
            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                }
                else {
                    resolve(stdout);
                }
            });
            python.on('error', (error) => {
                reject(error);
            });
        });
    }
    async executePythonScriptWithInput(script, input) {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', ['-c', script]);
            let stdout = '';
            let stderr = '';
            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            python.stdin.write(input);
            python.stdin.end();
            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                }
                else {
                    resolve(stdout);
                }
            });
            python.on('error', (error) => {
                reject(error);
            });
        });
    }
    async executePythonFile(scriptPath, input) {
        return new Promise((resolve, reject) => {
            const python = spawn('python3', [scriptPath]);
            let stdout = '';
            let stderr = '';
            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            python.stdin.write(input);
            python.stdin.end();
            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed with code ${code}: ${stderr}`));
                }
                else {
                    resolve(stdout);
                }
            });
            python.on('error', (error) => {
                reject(error);
            });
        });
    }
    async validateFlashAttentionInstallation() {
        try {
            const script = `
try:
    import torch
    import flash_attn
    print("FlashAttention available:", hasattr(flash_attn, 'flash_attn_func'))
    print("PyTorch version:", torch.__version__)
    print("CUDA available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print("CUDA version:", torch.version.cuda)
except ImportError as e:
    print("Import error:", str(e))
`;
            const result = await this.executePythonScript(script);
            log.info('🔧 FlashAttention installation check', LogContext.AI, { result: result.trim() });
        }
        catch (error) {
            log.warn('⚠️ FlashAttention installation check failed', LogContext.AI, { error });
            if (!this.config.fallbackToStandard) {
                throw new Error('FlashAttention not available and fallback disabled');
            }
        }
    }
    async startOptimizationService() {
        log.info('🚀 FlashAttention optimization service started', LogContext.AI);
    }
    async getSystemCapabilities() {
        return {
            gpuDevices: this.gpuDevices,
            flashAttentionAvailable: this.isInitialized,
            optimizationProfiles: Array.from(this.optimizationProfiles.keys()),
            currentConfig: { ...this.config },
        };
    }
    async getPerformanceMetrics() {
        if (this.performanceMetrics.length === 0) {
            return {
                averageSpeedup: 0,
                averageMemoryEfficiency: 0,
                averageExecutionTime: 0,
                cacheHitRate: 0,
                totalOptimizations: 0,
            };
        }
        const metrics = this.performanceMetrics;
        return {
            averageSpeedup: metrics.reduce((sum, m) => sum + m.speedupFactor, 0) / metrics.length,
            averageMemoryEfficiency: metrics.reduce((sum, m) => sum + m.memoryEfficiency, 0) / metrics.length,
            averageExecutionTime: metrics.reduce((sum, m) => sum + m.executionTimeMs, 0) / metrics.length,
            cacheHitRate: metrics.reduce((sum, m) => sum + (m.cacheHitRate || 0), 0) / metrics.length,
            totalOptimizations: metrics.length,
        };
    }
    async updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        log.info('⚙️ FlashAttention configuration updated', LogContext.AI, { newConfig });
    }
    async clearCache() {
        this.attentionCache.clear();
        log.info('🗑️ FlashAttention cache cleared', LogContext.AI);
    }
    async getHealthStatus() {
        const details = {
            initialized: this.isInitialized,
            gpuAvailable: this.gpuDevices.length > 0,
            cacheSize: this.attentionCache.size,
            metricsCount: this.performanceMetrics.length,
            configuration: this.config,
        };
        let status = 'healthy';
        if (!this.isInitialized) {
            status = 'unhealthy';
        }
        else if (this.gpuDevices.length === 0 && this.config.enableGPU) {
            status = 'degraded';
        }
        return { status, details };
    }
    async shutdown() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
        this.attentionCache.clear();
        this.performanceMetrics.length = 0;
        this.isInitialized = false;
        log.info('⚡ FlashAttention Service shut down', LogContext.AI);
    }
}
export const flashAttentionService = new FlashAttentionService();
//# sourceMappingURL=flash-attention-service.js.map