import { Router } from 'express';
import { flashAttentionConfigSchema, flashAttentionOptimizeSchema, validateRequestBody } from '../middleware/validation-schemas';
import { flashAttentionService } from '../services/flash-attention-service';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';
const router = Router();
const requireAuth = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }
    req.userId = userId;
    next();
};
router.use(requireAuth);
router.post('/optimize', validateRequestBody(flashAttentionOptimizeSchema), async (req, res) => {
    try {
        const { validatedData } = req;
        const { userId } = req;
        const request = {
            modelId: validatedData.modelId,
            providerId: validatedData.providerId,
            inputTokens: validatedData.inputTokens,
            attentionMask: validatedData.attentionMask,
            sequenceLength: validatedData.sequenceLength,
            batchSize: validatedData.batchSize,
            useCache: validatedData.useCache,
            optimizationLevel: validatedData.optimizationLevel,
        };
        log.info('⚡ FlashAttention optimization requested', LogContext.AI, {
            modelId: validatedData.modelId,
            providerId: validatedData.providerId,
            sequenceLength: validatedData.sequenceLength,
            batchSize: validatedData.batchSize,
            optimizationLevel: validatedData.optimizationLevel,
            userId,
        });
        const result = await flashAttentionService.optimizeAttention(request);
        const { modelId } = validatedData;
        if (result.success) {
            log.info('✅ FlashAttention optimization completed', LogContext.AI, {
                modelId,
                executionTime: result.metrics.executionTimeMs,
                speedup: result.metrics.speedupFactor,
                memoryEfficiency: result.metrics.memoryEfficiency,
                fallbackUsed: result.fallbackUsed,
            });
        }
        else {
            log.warn('⚠️ FlashAttention optimization failed', LogContext.AI, {
                modelId,
                error: result.error,
                fallbackUsed: result.fallbackUsed,
            });
        }
        sendSuccess(res, {
            success: result.success,
            metrics: result.metrics,
            fallbackUsed: result.fallbackUsed,
            optimizationApplied: result.optimizationApplied,
            hasOutput: Boolean(result.attentionOutput),
            outputSize: result.attentionOutput?.length || 0,
            error: result.error,
        });
    }
    catch (error) {
        log.error('❌ FlashAttention optimization error', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'FlashAttention optimization failed');
    }
});
router.get('/capabilities', async (req, res) => {
    try {
        const capabilities = await flashAttentionService.getSystemCapabilities();
        sendSuccess(res, capabilities);
    }
    catch (error) {
        log.error('❌ Failed to get FlashAttention capabilities', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get system capabilities');
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await flashAttentionService.getPerformanceMetrics();
        sendSuccess(res, metrics);
    }
    catch (error) {
        log.error('❌ Failed to get FlashAttention metrics', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to get performance metrics');
    }
});
router.put('/config', validateRequestBody(flashAttentionConfigSchema), async (req, res) => {
    try {
        const { validatedData } = req;
        const { userId } = req;
        if (Object.keys(validatedData).length === 0) {
            return sendError(res, 'VALIDATION_ERROR', 'No configuration parameters provided');
        }
        await flashAttentionService.updateConfiguration(validatedData);
        log.info('⚙️ FlashAttention configuration updated', LogContext.AI, {
            config: validatedData,
            userId,
        });
        sendSuccess(res, { updated: true, config: validatedData });
    }
    catch (error) {
        log.error('❌ Failed to update FlashAttention configuration', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to update configuration');
    }
});
router.delete('/cache', async (req, res) => {
    try {
        const { userId } = req;
        await flashAttentionService.clearCache();
        log.info('🗑️ FlashAttention cache cleared', LogContext.AI, { userId });
        sendSuccess(res, { cleared: true });
    }
    catch (error) {
        log.error('❌ Failed to clear FlashAttention cache', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to clear cache');
    }
});
router.get('/health', async (req, res) => {
    try {
        const health = await flashAttentionService.getHealthStatus();
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 206 : 503;
        res.status(statusCode);
        sendSuccess(res, health);
    }
    catch (error) {
        log.error('❌ FlashAttention health check failed', LogContext.AI, { error });
        sendError(res, 'SERVICE_ERROR', 'Health check failed');
    }
});
router.post('/benchmark', async (req, res) => {
    try {
        const { sequenceLengths = [512, 1024, 2048, 4096], batchSizes = [1, 2, 4], iterations = 3, } = req.body;
        const { userId } = req;
        if (!Array.isArray(sequenceLengths) || sequenceLengths.length === 0) {
            return sendError(res, 'VALIDATION_ERROR', 'sequenceLengths must be a non-empty array');
        }
        if (!Array.isArray(batchSizes) || batchSizes.length === 0) {
            return sendError(res, 'VALIDATION_ERROR', 'batchSizes must be a non-empty array');
        }
        const iterNum = parseInt(String(iterations));
        if (isNaN(iterNum) || iterNum <= 0 || iterNum > 10) {
            return sendError(res, 'VALIDATION_ERROR', 'iterations must be between 1 and 10');
        }
        for (const seqLen of sequenceLengths) {
            const len = parseInt(String(seqLen));
            if (isNaN(len) || len <= 0 || len > 16384) {
                return sendError(res, 'VALIDATION_ERROR', 'sequenceLengths values must be between 1 and 16384');
            }
        }
        for (const batchSize of batchSizes) {
            const size = parseInt(String(batchSize));
            if (isNaN(size) || size <= 0 || size > 16) {
                return sendError(res, 'VALIDATION_ERROR', 'batchSizes values must be between 1 and 16');
            }
        }
        log.info('🏁 Starting FlashAttention benchmark', LogContext.AI, {
            sequenceLengths,
            batchSizes,
            iterations: iterNum,
            userId,
        });
        const benchmarkResults = [];
        for (const seqLen of sequenceLengths) {
            for (const batchSize of batchSizes) {
                const configResults = [];
                for (let i = 0; i < iterNum; i++) {
                    const inputTokens = Array.from({ length: seqLen }, (_, idx) => idx % 1000);
                    const request = {
                        modelId: 'benchmark-model',
                        providerId: 'benchmark',
                        inputTokens,
                        sequenceLength: seqLen,
                        batchSize,
                        useCache: false,
                        optimizationLevel: 'high',
                    };
                    const result = await flashAttentionService.optimizeAttention(request);
                    configResults.push(result.metrics);
                }
                const avgMetrics = {
                    sequenceLength: seqLen,
                    batchSize,
                    avgExecutionTimeMs: configResults.reduce((sum, m) => sum + m.executionTimeMs, 0) / configResults.length,
                    avgMemoryUsageMB: configResults.reduce((sum, m) => sum + m.memoryUsageMB, 0) / configResults.length,
                    avgThroughput: configResults.reduce((sum, m) => sum + m.throughputTokensPerSec, 0) / configResults.length,
                    avgSpeedup: configResults.reduce((sum, m) => sum + m.speedupFactor, 0) / configResults.length,
                    avgMemoryEfficiency: configResults.reduce((sum, m) => sum + m.memoryEfficiency, 0) / configResults.length,
                    iterations: iterNum,
                };
                benchmarkResults.push(avgMetrics);
            }
        }
        log.info('✅ FlashAttention benchmark completed', LogContext.AI, {
            configurations: benchmarkResults.length,
            userId,
        });
        sendSuccess(res, {
            results: benchmarkResults,
            summary: {
                totalConfigurations: benchmarkResults.length,
                avgSpeedup: benchmarkResults.reduce((sum, r) => sum + r.avgSpeedup, 0) / benchmarkResults.length,
                avgMemoryEfficiency: benchmarkResults.reduce((sum, r) => sum + r.avgMemoryEfficiency, 0) / benchmarkResults.length,
                benchmarkCompleted: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        log.error('❌ FlashAttention benchmark failed', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'Benchmark failed');
    }
});
router.post('/recommendations', async (req, res) => {
    try {
        const { modelType, useCase, hardwareConstraints = {}, performanceRequirements = {}, } = req.body;
        const recommendations = [];
        if (modelType === 'large-language-model') {
            recommendations.push({
                category: 'Model Type',
                recommendation: 'Use memory_optimized profile for large language models',
                reason: 'Large models require careful memory management',
                config: {
                    optimizationLevel: 'medium',
                    enableMemoryOptimization: true,
                    blockSize: 32,
                },
            });
        }
        else if (modelType === 'small-model') {
            recommendations.push({
                category: 'Model Type',
                recommendation: 'Use speed_optimized profile for small models',
                reason: 'Small models can benefit from aggressive speed optimizations',
                config: {
                    optimizationLevel: 'high',
                    enableKernelFusion: true,
                    blockSize: 128,
                },
            });
        }
        if (useCase === 'real-time') {
            recommendations.push({
                category: 'Use Case',
                recommendation: 'Minimize latency with speed_optimized profile',
                reason: 'Real-time applications require low latency',
                config: {
                    optimizationLevel: 'aggressive',
                    batchSize: 1,
                    enableKernelFusion: true,
                },
            });
        }
        else if (useCase === 'batch-processing') {
            recommendations.push({
                category: 'Use Case',
                recommendation: 'Maximize throughput with throughput_optimized profile',
                reason: 'Batch processing can utilize larger batch sizes',
                config: {
                    optimizationLevel: 'aggressive',
                    batchSize: 8,
                    enableMemoryOptimization: false,
                },
            });
        }
        if (hardwareConstraints.limitedMemory) {
            recommendations.push({
                category: 'Hardware',
                recommendation: 'Enable aggressive memory optimization',
                reason: 'Limited memory requires careful optimization',
                config: {
                    enableMemoryOptimization: true,
                    blockSize: 16,
                    maxMemoryMB: 2048,
                },
            });
        }
        if (hardwareConstraints.noGPU) {
            recommendations.push({
                category: 'Hardware',
                recommendation: 'Optimize for CPU-only execution',
                reason: 'No GPU available, focus on CPU optimizations',
                config: {
                    enableGPU: false,
                    enableCPU: true,
                    blockSize: 32,
                },
            });
        }
        if (performanceRequirements.maxLatency) {
            const maxLatency = parseInt(String(performanceRequirements.maxLatency));
            if (maxLatency < 100) {
                recommendations.push({
                    category: 'Performance',
                    recommendation: 'Use aggressive optimization for ultra-low latency',
                    reason: `Target latency of ${maxLatency}ms requires aggressive optimization`,
                    config: {
                        optimizationLevel: 'aggressive',
                        enableKernelFusion: true,
                        batchSize: 1,
                    },
                });
            }
        }
        if (recommendations.length === 0) {
            recommendations.push({
                category: 'Default',
                recommendation: 'Use balanced profile for general use',
                reason: 'Balanced configuration works well for most use cases',
                config: {
                    optimizationLevel: 'balanced',
                    enableMemoryOptimization: true,
                    enableKernelFusion: true,
                    blockSize: 64,
                },
            });
        }
        sendSuccess(res, {
            recommendations,
            appliedAt: new Date().toISOString(),
        });
    }
    catch (error) {
        log.error('❌ Failed to generate FlashAttention recommendations', LogContext.AI, { error });
        sendError(res, 'INTERNAL_ERROR', 'Failed to generate recommendations');
    }
});
export default router;
//# sourceMappingURL=flash-attention.js.map