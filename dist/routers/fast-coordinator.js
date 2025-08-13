import { Router } from 'express';
import { dspyFastOptimizer } from '../services/dspy-fast-optimizer';
import { fastCoordinator } from '../services/fast-llm-coordinator';
import { lfm2Bridge } from '../services/lfm2-bridge';
import { log, LogContext } from '../utils/logger';
const router = Router();
router.post('/routing-decision', async (req, res) => {
    try {
        const { userRequest, context = {} } = req.body;
        if (!userRequest) {
            return res.status(400).json({
                success: false,
                error: 'userRequest is required',
            });
        }
        const startTime = Date.now();
        const decision = await fastCoordinator.makeRoutingDecision(userRequest, {
            taskType: context.taskType || 'general',
            complexity: context.complexity || 'medium',
            urgency: context.urgency || 'medium',
            expectedResponseLength: context.expectedResponseLength || 'medium',
            requiresCreativity: context.requiresCreativity || false,
            requiresAccuracy: context.requiresAccuracy || true,
        });
        const executionTime = Date.now() - startTime;
        res.json({
            success: true,
            data: {
                decision,
                metadata: {
                    executionTime: `${executionTime}ms`,
                    timestamp: new Date().toISOString(),
                    coordinator: 'fast-llm',
                },
            },
        });
        log.info('⚡ Fast routing decision completed', LogContext.AI, {
            targetService: decision.targetService,
            complexity: decision.complexity,
            executionTime: `${executionTime}ms`,
        });
    }
    catch (error) {
        log.error('❌ Fast routing decision failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'Fast routing decision failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/execute', async (req, res) => {
    try {
        const { userRequest, context = {} } = req.body;
        if (!userRequest) {
            return res.status(400).json({
                success: false,
                error: 'userRequest is required',
            });
        }
        const coordinationContext = {
            taskType: context.taskType || 'general',
            complexity: context.complexity || 'medium',
            urgency: context.urgency || 'medium',
            expectedResponseLength: context.expectedResponseLength || 'medium',
            requiresCreativity: context.requiresCreativity || false,
            requiresAccuracy: context.requiresAccuracy || true,
        };
        const result = await fastCoordinator.executeWithCoordination(userRequest, coordinationContext);
        res.json({
            success: true,
            data: {
                response: result.response,
                metadata: {
                    ...result.metadata,
                    timestamp: new Date().toISOString(),
                    coordinator: 'fast-llm',
                },
            },
        });
        log.info('🚀 Fast coordination execution completed', LogContext.AI, {
            serviceUsed: result.metadata.serviceUsed,
            executionTime: `${result.metadata.executionTime}ms`,
            tokensUsed: result.metadata.tokensUsed,
        });
    }
    catch (error) {
        log.error('❌ Fast coordination execution failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'Fast coordination execution failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/coordinate-agents', async (req, res) => {
    try {
        const { primaryTask, supportingTasks = [] } = req.body;
        if (!primaryTask) {
            return res.status(400).json({
                success: false,
                error: 'primaryTask is required',
            });
        }
        const startTime = Date.now();
        const result = await fastCoordinator.coordinateMultipleAgents(primaryTask, supportingTasks);
        const totalExecutionTime = Date.now() - startTime;
        res.json({
            success: true,
            data: {
                primary: result.primary,
                supporting: result.supporting,
                coordination: {
                    ...result.coordination,
                    totalExecutionTime: `${totalExecutionTime}ms`,
                },
                metadata: {
                    timestamp: new Date().toISOString(),
                    coordinator: 'fast-llm',
                },
            },
        });
        log.info('🎭 Multi-agent coordination completed', LogContext.AI, {
            primaryTask: primaryTask.substring(0, 50),
            supportingTasks: supportingTasks.length,
            servicesUsed: result.coordination.servicesUsed,
            totalTime: `${totalExecutionTime}ms`,
        });
    }
    catch (error) {
        log.error('❌ Multi-agent coordination failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'Multi-agent coordination failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/lfm2/quick', async (req, res) => {
    try {
        const { userRequest, taskType = 'simple_qa' } = req.body;
        if (!userRequest) {
            return res.status(400).json({
                success: false,
                error: 'userRequest is required',
            });
        }
        const response = await lfm2Bridge.quickResponse(userRequest, taskType);
        res.json({
            success: true,
            data: {
                response: response.content,
                metadata: {
                    model: response.model,
                    tokens: response.tokens,
                    executionTime: `${response.executionTime}ms`,
                    confidence: response.confidence,
                    timestamp: new Date().toISOString(),
                },
            },
        });
        log.info('⚡ LFM2 quick response completed', LogContext.AI, {
            taskType,
            executionTime: `${response.executionTime}ms`,
            tokens: response.tokens,
        });
    }
    catch (error) {
        log.error('❌ LFM2 quick response failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'LFM2 quick response failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/optimize', async (req, res) => {
    try {
        const { taskType, examples = [] } = req.body;
        if (!taskType) {
            return res.status(400).json({
                success: false,
                error: 'taskType is required',
            });
        }
        const optimization = await dspyFastOptimizer.optimizeLFM2Responses(taskType, examples);
        res.json({
            success: true,
            data: {
                optimization,
                metadata: {
                    timestamp: new Date().toISOString(),
                    optimizer: 'dspy',
                },
            },
        });
        log.info('🔧 DSPy optimization completed', LogContext.AI, {
            taskType,
            performanceGain: `${(optimization.performanceGain * 100).toFixed(1)}%`,
            confidence: optimization.confidence,
        });
    }
    catch (error) {
        log.error('❌ DSPy optimization failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'DSPy optimization failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/benchmark', async (req, res) => {
    try {
        const { testRequests = [] } = req.body;
        if (testRequests.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'testRequests array is required',
            });
        }
        const results = await dspyFastOptimizer.benchmarkServices(testRequests);
        res.json({
            success: true,
            data: {
                benchmark: results,
                metadata: {
                    timestamp: new Date().toISOString(),
                    testCount: testRequests.length,
                },
            },
        });
        log.info('📊 Service benchmark completed', LogContext.AI, {
            testCount: testRequests.length,
            recommendations: results.recommendations.length,
        });
    }
    catch (error) {
        log.error('❌ Service benchmark failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'Service benchmark failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/status', async (req, res) => {
    try {
        const coordinatorStatus = fastCoordinator.getSystemStatus();
        const lfm2Metrics = lfm2Bridge.getMetrics();
        const optimizationStatus = dspyFastOptimizer.getOptimizationStatus();
        res.json({
            success: true,
            data: {
                coordinator: coordinatorStatus,
                lfm2: lfm2Metrics,
                optimization: optimizationStatus,
                metadata: {
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                },
            },
        });
        log.info('📋 Fast coordinator status retrieved', LogContext.AI, {
            lfm2Ready: lfm2Metrics.isInitialized || false,
            totalOptimizations: optimizationStatus.totalOptimizations,
        });
    }
    catch (error) {
        log.error('❌ Failed to get status', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'Failed to get status',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/auto-tune', async (req, res) => {
    try {
        log.info('🎛️ Starting auto-tune process', LogContext.AI);
        const results = await dspyFastOptimizer.autoTuneSystem();
        res.json({
            success: true,
            data: {
                tuning: results,
                metadata: {
                    timestamp: new Date().toISOString(),
                },
            },
        });
        log.info('✅ Auto-tune completed', LogContext.AI, {
            optimizationsApplied: results.optimizationsApplied,
            performanceImprovement: `${(results.performanceImprovement * 100).toFixed(1)}%`,
        });
    }
    catch (error) {
        log.error('❌ Auto-tune failed', LogContext.AI, { error });
        res.status(500).json({
            success: false,
            error: 'Auto-tune failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        const lfm2 = lfm2Bridge.getMetrics();
        const circuit = lfm2Bridge.getCircuitBreakerMetrics();
        return res.json({
            success: true,
            data: {
                lfm2,
                circuitBreaker: circuit,
                pythonProcessAlive: lfm2Bridge.isAvailable(),
            },
            metadata: {
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                env: process.env.NODE_ENV || 'development',
            },
        });
    }
    catch (error) {
        log.error('❌ Fast coordinator health failed', LogContext.AI, { error });
        return res.status(500).json({
            success: false,
            error: 'Health check failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
export default router;
//# sourceMappingURL=fast-coordinator.js.map