// TypeScript wrapper for the Rust Vision Resource Manager
// Provides async interface and integration with existing Universal AI Tools architecture

import { createRequire } from 'module';
import path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);

// Type definitions for the Rust NAPI bridge
export interface RustModelInfo {
    name: string;
    size_gb: number;
    loaded: boolean;
    last_used: string; // ISO date string
    load_time_ms: number;
}

export interface RustGPUMetrics {
    total_vram_gb: number;
    used_vram_gb: number;
    available_vram_gb: number;
    utilization_percent: number;
}

export interface RustTaskResult {
    task_id: string;
    model_name: string;
    execution_time_ms: number;
    success: boolean;
}

export interface RustBenchmarkResult {
    total_time_ms: number;
    successful_tasks: number;
    failed_tasks: number;
    throughput_per_second: number;
}

// Native Rust module interface (loaded via NAPI)
interface RustVisionResourceManagerNative {
    new(max_vram_gb: number): RustVisionResourceManagerNative;
    getGpuMetrics(): RustGPUMetrics;
    getLoadedModels(): string[];
    ensureModelLoaded(model_name: string): void;
    executeTask(model_name: string, task_type: string): RustTaskResult;
    getModelInfo(model_name: string): RustModelInfo | null;
    unloadAllModels(): void;
    benchmark(iterations: number): RustBenchmarkResult;
}

interface RustModule {
    VisionResourceManager: new(max_vram_gb: number) => RustVisionResourceManagerNative;
    getVersion(): string;
    checkSystemRequirements(): string;
    testBridge(): string;
    performanceComparisonReport(): string;
}

/**
 * Enhanced TypeScript wrapper for Rust Vision Resource Manager
 * Provides async operations, error handling, and event emission
 */
export class RustVisionResourceManager extends EventEmitter {
    private rustManager: RustVisionResourceManagerNative | null = null;
    private rustModule: RustModule | null = null;
    private isInitialized: boolean = false;
    private maxVramGB: number;
    private initializationPromise: Promise<void> | null = null;

    // Performance tracking
    private totalTasks: number = 0;
    private successfulTasks: number = 0;
    private failedTasks: number = 0;
    private totalExecutionTime: number = 0;

    constructor(maxVramGB: number = 20.0) {
        super();
        this.maxVramGB = maxVramGB;
        logger.info(`🦀 Initializing Rust Vision Resource Manager with ${maxVramGB}GB VRAM limit`);
    }

    /**
     * Initialize the Rust module and create the resource manager
     */
    async initialize(): Promise<void> {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.doInitialize();
        return this.initializationPromise;
    }

    private async doInitialize(): Promise<void> {
        try {
            // Try to load the compiled Rust module
            const rustModulePath = path.join(
                process.cwd(),
                'crates/vision-resource-manager/target/release/vision_resource_manager.node'
            );

            try {
                this.rustModule = require(rustModulePath) as RustModule;
                logger.info('✅ Rust module loaded successfully');
            } catch (loadError) {
                logger.warn('⚠️  Rust module not found, falling back to mock implementation');
                this.createMockImplementation();
                return;
            }

            // Create the Rust manager instance
            this.rustManager = new this.rustModule.VisionResourceManager(this.maxVramGB);
            this.isInitialized = true;

            // Log system information
            const version = this.rustModule.getVersion();
            const systemCheck = this.rustModule.checkSystemRequirements();
            
            logger.info(`🦀 Rust Vision Resource Manager v${version} initialized`);
            logger.info(systemCheck);

            // Test the bridge
            const bridgeTest = this.rustModule.testBridge();
            logger.info(bridgeTest);

            this.emit('initialized', {
                version,
                maxVramGB: this.maxVramGB,
                backendType: 'rust'
            });

        } catch (error) {
            logger.error('❌ Failed to initialize Rust Vision Resource Manager:', error);
            this.createMockImplementation();
            throw error;
        }
    }

    /**
     * Create a mock implementation for development/fallback
     */
    private createMockImplementation(): void {
        logger.info('🔄 Creating mock implementation for development');
        this.isInitialized = true;
        this.emit('initialized', {
            version: '0.1.0-mock',
            maxVramGB: this.maxVramGB,
            backendType: 'mock'
        });
    }

    /**
     * Get current GPU metrics
     */
    async getGPUMetrics(): Promise<RustGPUMetrics> {
        await this.ensureInitialized();
        
        if (!this.rustManager) {
            // Mock implementation
            return {
                total_vram_gb: this.maxVramGB,
                used_vram_gb: Math.random() * 5,
                available_vram_gb: this.maxVramGB - Math.random() * 5,
                utilization_percent: Math.random() * 50
            };
        }

        try {
            const metrics = this.rustManager.getGpuMetrics();
            this.emit('metrics', metrics);
            return metrics;
        } catch (error) {
            logger.error('Failed to get GPU metrics:', error);
            throw error;
        }
    }

    /**
     * Get list of currently loaded models
     */
    async getLoadedModels(): Promise<string[]> {
        await this.ensureInitialized();
        
        if (!this.rustManager) {
            return ['mock-model-1', 'mock-model-2'];
        }

        try {
            return this.rustManager.getLoadedModels();
        } catch (error) {
            logger.error('Failed to get loaded models:', error);
            throw error;
        }
    }

    /**
     * Ensure a model is loaded into VRAM
     */
    async ensureModelLoaded(modelName: string): Promise<void> {
        await this.ensureInitialized();
        
        if (!this.rustManager) {
            logger.info(`📦 Mock: Loading model ${modelName}`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate load time
            return;
        }

        try {
            const startTime = Date.now();
            this.rustManager.ensureModelLoaded(modelName);
            const loadTime = Date.now() - startTime;
            
            logger.info(`✅ Model ${modelName} loaded in ${loadTime}ms (Rust backend)`);
            this.emit('modelLoaded', { modelName, loadTime });
            
        } catch (error) {
            logger.error(`❌ Failed to load model ${modelName}:`, error);
            this.emit('modelLoadError', { modelName, error: error.message });
            throw error;
        }
    }

    /**
     * Execute a task with the specified model
     */
    async executeTask(modelName: string, taskType: string): Promise<RustTaskResult> {
        await this.ensureInitialized();
        
        this.totalTasks++;
        
        if (!this.rustManager) {
            // Mock implementation
            const executionTime = Math.random() * 200 + 50; // 50-250ms
            await new Promise(resolve => setTimeout(resolve, executionTime));
            
            const result: RustTaskResult = {
                task_id: `mock_task_${Date.now()}`,
                model_name: modelName,
                execution_time_ms: Math.floor(executionTime),
                success: true
            };
            
            this.successfulTasks++;
            this.totalExecutionTime += executionTime;
            
            logger.info(`🎯 Mock task completed: ${modelName} in ${result.execution_time_ms}ms`);
            this.emit('taskCompleted', result);
            
            return result;
        }

        try {
            const startTime = Date.now();
            const result = this.rustManager.executeTask(modelName, taskType);
            const actualExecutionTime = Date.now() - startTime;
            
            this.successfulTasks++;
            this.totalExecutionTime += actualExecutionTime;
            
            logger.info(`🚀 Rust task completed: ${modelName} in ${result.execution_time_ms}ms`);
            this.emit('taskCompleted', result);
            
            return result;
            
        } catch (error) {
            this.failedTasks++;
            logger.error(`❌ Task execution failed for ${modelName}:`, error);
            this.emit('taskError', { modelName, taskType, error: error.message });
            throw error;
        }
    }

    /**
     * Get information about a specific model
     */
    async getModelInfo(modelName: string): Promise<RustModelInfo | null> {
        await this.ensureInitialized();
        
        if (!this.rustManager) {
            // Mock implementation
            return {
                name: modelName,
                size_gb: Math.random() * 5,
                loaded: Math.random() > 0.5,
                last_used: new Date().toISOString(),
                load_time_ms: Math.floor(Math.random() * 1000 + 100)
            };
        }

        try {
            return this.rustManager.getModelInfo(modelName);
        } catch (error) {
            logger.error(`Failed to get model info for ${modelName}:`, error);
            throw error;
        }
    }

    /**
     * Unload all models to free VRAM
     */
    async unloadAllModels(): Promise<void> {
        await this.ensureInitialized();
        
        if (!this.rustManager) {
            logger.info('🗑️  Mock: Unloading all models');
            return;
        }

        try {
            this.rustManager.unloadAllModels();
            logger.info('🗑️  All models unloaded');
            this.emit('allModelsUnloaded');
        } catch (error) {
            logger.error('Failed to unload models:', error);
            throw error;
        }
    }

    /**
     * Run performance benchmark
     */
    async benchmark(iterations: number = 50): Promise<RustBenchmarkResult> {
        await this.ensureInitialized();
        
        if (!this.rustManager) {
            // Mock benchmark
            const totalTime = iterations * 100; // 100ms per task
            return {
                total_time_ms: totalTime,
                successful_tasks: iterations,
                failed_tasks: 0,
                throughput_per_second: 1000 / 100 // 10 tasks/second
            };
        }

        try {
            logger.info(`🏁 Starting benchmark with ${iterations} iterations`);
            const result = this.rustManager.benchmark(iterations);
            
            logger.info(`✅ Benchmark completed: ${result.successful_tasks}/${iterations} successful, ` +
                       `${result.throughput_per_second.toFixed(1)} tasks/sec`);
            
            this.emit('benchmarkCompleted', result);
            return result;
            
        } catch (error) {
            logger.error('Benchmark failed:', error);
            throw error;
        }
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        const avgExecutionTime = this.totalTasks > 0 ? this.totalExecutionTime / this.totalTasks : 0;
        const successRate = this.totalTasks > 0 ? (this.successfulTasks / this.totalTasks) * 100 : 0;
        
        return {
            totalTasks: this.totalTasks,
            successfulTasks: this.successfulTasks,
            failedTasks: this.failedTasks,
            successRate: Math.round(successRate * 100) / 100,
            averageExecutionTime: Math.round(avgExecutionTime * 100) / 100,
            backendType: this.rustManager ? 'rust' : 'mock'
        };
    }

    /**
     * Get performance comparison report
     */
    async getPerformanceReport(): Promise<string> {
        await this.ensureInitialized();
        
        if (!this.rustModule) {
            return `📊 Performance Report (Mock Implementation)
Current Stats: ${JSON.stringify(this.getPerformanceStats(), null, 2)}
Note: Using mock implementation - load Rust module for actual performance data.`;
        }

        try {
            const report = this.rustModule.performanceComparisonReport();
            const currentStats = this.getPerformanceStats();
            
            return `${report}

📈 Current Session Stats:
${JSON.stringify(currentStats, null, 2)}`;
            
        } catch (error) {
            logger.error('Failed to get performance report:', error);
            throw error;
        }
    }

    /**
     * Shutdown the resource manager
     */
    async shutdown(): Promise<void> {
        if (this.rustManager) {
            await this.unloadAllModels();
            logger.info('🛑 Rust Vision Resource Manager shut down');
        }
        
        this.isInitialized = false;
        this.rustManager = null;
        this.emit('shutdown');
    }

    /**
     * Ensure the manager is initialized
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    /**
     * Check if the manager is using the Rust backend
     */
    isUsingRustBackend(): boolean {
        return this.rustManager !== null;
    }

    /**
     * Get the backend type
     */
    getBackendType(): 'rust' | 'mock' {
        return this.rustManager ? 'rust' : 'mock';
    }
}

// Export a singleton instance for easy use
export const rustVisionResourceManager = new RustVisionResourceManager();

// Auto-initialize for immediate use
rustVisionResourceManager.initialize().catch(error => {
    logger.warn('Auto-initialization of Rust Vision Resource Manager failed:', error);
});

export default RustVisionResourceManager;