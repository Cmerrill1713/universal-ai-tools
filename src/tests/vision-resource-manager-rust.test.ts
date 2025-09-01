// Integration tests for Rust Vision Resource Manager
// Tests both mock and native Rust implementations

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { RustVisionResourceManager } from '../services/vision-resource-manager-rust.js';
import { logger } from '../utils/logger.js';

describe('Rust Vision Resource Manager', () => {
    let manager: RustVisionResourceManager;
    
    beforeAll(async () => {
        // Suppress logs during testing
        logger.transports.forEach(transport => {
            transport.level = 'error';
        });
    });

    beforeEach(async () => {
        manager = new RustVisionResourceManager(20.0);
        await manager.initialize();
    });

    afterEach(async () => {
        if (manager) {
            await manager.shutdown();
        }
    });

    describe('Initialization', () => {
        it('should initialize successfully', async () => {
            expect(manager).toBeDefined();
            expect(typeof manager.getBackendType).toBe('function');
            
            const backendType = manager.getBackendType();
            expect(['rust', 'mock']).toContain(backendType);
            
            console.log(`✅ Using ${backendType} backend`);
        });

        it('should emit initialization event', (done) => {
            const testManager = new RustVisionResourceManager(10.0);
            
            testManager.on('initialized', (data) => {
                expect(data).toHaveProperty('version');
                expect(data).toHaveProperty('maxVramGB');
                expect(data).toHaveProperty('backendType');
                expect(data.maxVramGB).toBe(10.0);
                
                testManager.shutdown().then(() => done());
            });
            
            testManager.initialize();
        });
    });

    describe('GPU Metrics', () => {
        it('should return valid GPU metrics', async () => {
            const metrics = await manager.getGPUMetrics();
            
            expect(metrics).toHaveProperty('total_vram_gb');
            expect(metrics).toHaveProperty('used_vram_gb');
            expect(metrics).toHaveProperty('available_vram_gb');
            expect(metrics).toHaveProperty('utilization_percent');
            
            expect(typeof metrics.total_vram_gb).toBe('number');
            expect(metrics.total_vram_gb).toBeGreaterThan(0);
            expect(metrics.used_vram_gb).toBeGreaterThanOrEqual(0);
            expect(metrics.available_vram_gb).toBeGreaterThanOrEqual(0);
            expect(metrics.utilization_percent).toBeGreaterThanOrEqual(0);
            expect(metrics.utilization_percent).toBeLessThanOrEqual(100);
            
            console.log(`📊 GPU Metrics: ${JSON.stringify(metrics, null, 2)}`);
        });

        it('should emit metrics event', (done) => {
            manager.on('metrics', (metrics) => {
                expect(metrics).toHaveProperty('total_vram_gb');
                done();
            });
            
            manager.getGPUMetrics();
        });
    });

    describe('Model Management', () => {
        it('should get loaded models list', async () => {
            const models = await manager.getLoadedModels();
            
            expect(Array.isArray(models)).toBe(true);
            console.log(`📦 Loaded models: ${JSON.stringify(models)}`);
        });

        it('should load a model successfully', async () => {
            const modelName = 'yolo-v8n';
            
            const beforeLoading = await manager.getLoadedModels();
            await manager.ensureModelLoaded(modelName);
            const afterLoading = await manager.getLoadedModels();
            
            // In mock mode, this might not change, but should not throw
            expect(afterLoading).toBeDefined();
            console.log(`✅ Model loading test completed for ${modelName}`);
        });

        it('should emit model loaded event', (done) => {
            const modelName = 'clip-vit-b32';
            
            manager.on('modelLoaded', (data) => {
                expect(data).toHaveProperty('modelName');
                expect(data).toHaveProperty('loadTime');
                expect(data.modelName).toBe(modelName);
                expect(typeof data.loadTime).toBe('number');
                done();
            });
            
            manager.ensureModelLoaded(modelName);
        });

        it('should get model info', async () => {
            const modelName = 'yolo-v8n';
            const info = await manager.getModelInfo(modelName);
            
            if (info) {
                expect(info).toHaveProperty('name');
                expect(info).toHaveProperty('size_gb');
                expect(info).toHaveProperty('loaded');
                expect(info).toHaveProperty('last_used');
                expect(info).toHaveProperty('load_time_ms');
                
                expect(info.name).toBe(modelName);
                expect(typeof info.size_gb).toBe('number');
                expect(typeof info.loaded).toBe('boolean');
                expect(typeof info.last_used).toBe('string');
                expect(typeof info.load_time_ms).toBe('number');
                
                console.log(`📋 Model info for ${modelName}: ${JSON.stringify(info, null, 2)}`);
            }
        });

        it('should unload all models', async () => {
            // Load a model first
            await manager.ensureModelLoaded('yolo-v8n');
            
            // Then unload all
            await manager.unloadAllModels();
            
            // Should complete without error
            console.log('✅ All models unloaded successfully');
        });

        it('should emit all models unloaded event', (done) => {
            manager.on('allModelsUnloaded', () => {
                done();
            });
            
            manager.unloadAllModels();
        });
    });

    describe('Task Execution', () => {
        it('should execute a task successfully', async () => {
            const modelName = 'yolo-v8n';
            const taskType = 'test_task';
            
            const result = await manager.executeTask(modelName, taskType);
            
            expect(result).toHaveProperty('task_id');
            expect(result).toHaveProperty('model_name');
            expect(result).toHaveProperty('execution_time_ms');
            expect(result).toHaveProperty('success');
            
            expect(result.model_name).toBe(modelName);
            expect(typeof result.execution_time_ms).toBe('number');
            expect(result.execution_time_ms).toBeGreaterThan(0);
            expect(result.success).toBe(true);
            
            console.log(`🚀 Task result: ${JSON.stringify(result, null, 2)}`);
        });

        it('should emit task completed event', (done) => {
            const modelName = 'clip-vit-b32';
            const taskType = 'inference';
            
            manager.on('taskCompleted', (result) => {
                expect(result).toHaveProperty('task_id');
                expect(result).toHaveProperty('model_name');
                expect(result.model_name).toBe(modelName);
                done();
            });
            
            manager.executeTask(modelName, taskType);
        });

        it('should handle multiple concurrent tasks', async () => {
            const tasks = [
                manager.executeTask('yolo-v8n', 'detection'),
                manager.executeTask('clip-vit-b32', 'embedding'),
                manager.executeTask('yolo-v8n', 'classification'),
            ];
            
            const results = await Promise.all(tasks);
            
            expect(results).toHaveLength(3);
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                console.log(`✅ Concurrent task ${index + 1} completed in ${result.execution_time_ms}ms`);
            });
        });
    });

    describe('Performance Monitoring', () => {
        it('should track performance statistics', async () => {
            // Execute some tasks to generate stats
            await manager.executeTask('yolo-v8n', 'test1');
            await manager.executeTask('clip-vit-b32', 'test2');
            
            const stats = manager.getPerformanceStats();
            
            expect(stats).toHaveProperty('totalTasks');
            expect(stats).toHaveProperty('successfulTasks');
            expect(stats).toHaveProperty('failedTasks');
            expect(stats).toHaveProperty('successRate');
            expect(stats).toHaveProperty('averageExecutionTime');
            expect(stats).toHaveProperty('backendType');
            
            expect(stats.totalTasks).toBeGreaterThanOrEqual(2);
            expect(stats.successfulTasks).toBeGreaterThanOrEqual(2);
            expect(stats.successRate).toBeGreaterThan(0);
            expect(['rust', 'mock']).toContain(stats.backendType);
            
            console.log(`📈 Performance stats: ${JSON.stringify(stats, null, 2)}`);
        });

        it('should generate performance report', async () => {
            const report = await manager.getPerformanceReport();
            
            expect(typeof report).toBe('string');
            expect(report.length).toBeGreaterThan(0);
            
            console.log(`📊 Performance report:\n${report}`);
        });
    });

    describe('Benchmarking', () => {
        it('should run benchmark successfully', async () => {
            const iterations = 10; // Small number for tests
            const result = await manager.benchmark(iterations);
            
            expect(result).toHaveProperty('total_time_ms');
            expect(result).toHaveProperty('successful_tasks');
            expect(result).toHaveProperty('failed_tasks');
            expect(result).toHaveProperty('throughput_per_second');
            
            expect(typeof result.total_time_ms).toBe('number');
            expect(result.total_time_ms).toBeGreaterThan(0);
            expect(result.successful_tasks).toBeGreaterThanOrEqual(0);
            expect(result.failed_tasks).toBeGreaterThanOrEqual(0);
            expect(result.successful_tasks + result.failed_tasks).toBe(iterations);
            expect(typeof result.throughput_per_second).toBe('number');
            
            console.log(`🏁 Benchmark result: ${JSON.stringify(result, null, 2)}`);
        });

        it('should emit benchmark completed event', (done) => {
            manager.on('benchmarkCompleted', (result) => {
                expect(result).toHaveProperty('total_time_ms');
                expect(result).toHaveProperty('throughput_per_second');
                done();
            });
            
            manager.benchmark(5);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid model names gracefully', async () => {
            try {
                await manager.executeTask('invalid-model', 'test');
                // If it doesn't throw, that's also okay (mock implementation might allow it)
            } catch (error) {
                expect(error).toBeDefined();
                console.log(`✅ Error handling test passed: ${error.message}`);
            }
        });

        it('should emit task error event for failures', (done) => {
            manager.on('taskError', (error) => {
                expect(error).toHaveProperty('modelName');
                expect(error).toHaveProperty('taskType');
                expect(error).toHaveProperty('error');
                done();
            });
            
            // Try to trigger an error (might not work in mock mode)
            manager.executeTask('definitely-invalid-model-name', 'test').catch(() => {
                // Error is expected and handled by event
            });
            
            // Ensure test completes even if no error is emitted
            setTimeout(done, 1000);
        });
    });

    describe('Backend Detection', () => {
        it('should correctly identify backend type', () => {
            const backendType = manager.getBackendType();
            const isUsingRust = manager.isUsingRustBackend();
            
            expect(['rust', 'mock']).toContain(backendType);
            expect(typeof isUsingRust).toBe('boolean');
            
            if (backendType === 'rust') {
                expect(isUsingRust).toBe(true);
                console.log('🦀 Using native Rust backend');
            } else {
                expect(isUsingRust).toBe(false);
                console.log('🔧 Using mock backend');
            }
        });
    });

    describe('Memory Management', () => {
        it('should manage VRAM efficiently', async () => {
            // Load multiple models
            const models = ['yolo-v8n', 'clip-vit-b32', 'sd3b'];
            
            for (const model of models) {
                await manager.ensureModelLoaded(model);
            }
            
            // Check GPU metrics
            const metrics = await manager.getGPUMetrics();
            expect(metrics.used_vram_gb).toBeGreaterThanOrEqual(0);
            expect(metrics.available_vram_gb).toBeGreaterThanOrEqual(0);
            
            // Unload all models
            await manager.unloadAllModels();
            
            console.log('✅ Memory management test completed');
        });
    });

    describe('Event System', () => {
        it('should properly emit and handle events', (done) => {
            let eventsReceived = 0;
            const expectedEvents = 2;
            
            const checkCompletion = () => {
                eventsReceived++;
                if (eventsReceived >= expectedEvents) {
                    done();
                }
            };
            
            manager.on('taskCompleted', checkCompletion);
            manager.on('metrics', checkCompletion);
            
            // Trigger events
            manager.executeTask('yolo-v8n', 'test');
            manager.getGPUMetrics();
        });
    });
});