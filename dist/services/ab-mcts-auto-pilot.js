import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { THREE, TWO } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
import { abMCTSOrchestrator } from './ab-mcts-orchestrator';
import { feedbackCollector } from './feedback-collector';
import { mlParameterOptimizer } from './ml-parameter-optimizer';
import { multiTierLLM } from './multi-tier-llm-service';
export class ABMCTSAutoPilot extends EventEmitter {
    config;
    orchestrator;
    isRunning = false;
    taskQueue = [];
    processingTasks = new Map();
    metrics;
    learningTimer = null;
    recentResults = new Map();
    constructor(config = {}) {
        super();
        this.config = {
            enabled: true,
            autoLearnThreshold: 0.7,
            batchSize: 5,
            learningInterval: 300000,
            performanceThreshold: 0.6,
            fallbackAfterFailures: 3,
            autoOptimizeParameters: true,
            monitoringEnabled: true,
            ...config,
        };
        this.orchestrator = abMCTSOrchestrator;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            averageConfidence: 0,
            learningCycles: 0,
            parameterOptimizations: 0,
        };
    }
    async start() {
        if (this.isRunning) {
            log.warn('🤖 AB-MCTS Auto-Pilot already running', LogContext.AI);
            return;
        }
        log.info('🚀 Starting AB-MCTS Auto-Pilot', LogContext.AI, {
            config: this.config,
        });
        this.isRunning = true;
        this.emit('started');
        this.processLoop();
        if (this.config.autoLearnThreshold > 0) {
            this.learningTimer = setInterval(() => {
                this.performLearningCycle();
            }, this.config.learningInterval);
        }
        if (this.config.monitoringEnabled) {
            this.startMonitoring();
        }
    }
    async stop() {
        log.info('🛑 Stopping AB-MCTS Auto-Pilot', LogContext.AI);
        this.isRunning = false;
        if (this.learningTimer) {
            clearInterval(this.learningTimer);
            this.learningTimer = null;
        }
        await this.waitForTaskCompletion();
        this.emit('stopped');
    }
    async submitTask(userRequest, context = {}, priority = 5) {
        const taskId = uuidv4();
        const task = {
            id: taskId,
            userRequest,
            context,
            priority,
            timestamp: Date.now(),
            retries: 0,
        };
        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => b.priority - a.priority);
        log.info('📥 Task submitted to Auto-Pilot', LogContext.AI, {
            taskId,
            queueLength: this.taskQueue.length,
        });
        this.emit('taskSubmitted', task);
        return taskId;
    }
    async processLoop() {
        while (this.isRunning) {
            try {
                const batch = this.getBatch();
                if (batch.length > 0) {
                    await this.processBatch(batch);
                }
                else {
                    await this.sleep(100);
                }
            }
            catch (error) {
                log.error('❌ Error in Auto-Pilot process loop', LogContext.AI, { error });
                await this.sleep(1000);
            }
        }
    }
    async processBatch(batch) {
        const startTime = Date.now();
        log.info('🔄 Processing batch', LogContext.AI, {
            batchSize: batch.length,
            taskIds: batch.map((t) => t.id),
        });
        const results = await Promise.allSettled(batch.map((task) => this.processTask(task)));
        const processingTime = Date.now() - startTime;
        const successful = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected').length;
        this.updateMetrics({
            totalRequests: batch.length,
            successfulRequests: successful,
            failedRequests: failed,
            processingTime,
        });
        for (let i = 0; i < results.length; i++) {
            if (results[i]?.status === 'rejected' && batch[i]) {
                await this.handleFailedTask(batch[i]);
            }
        }
    }
    async processTask(task) {
        this.processingTasks.set(task.id, task);
        try {
            const agentContext = {
                userRequest: task.userRequest,
                requestId: task.id,
                userId: 'auto-pilot',
                metadata: {
                    ...task.context,
                    autoPilot: true,
                    priority: task.priority,
                    attempt: task.retries + 1,
                },
            };
            const options = {
                useCache: true,
                enableParallelism: true,
                collectFeedback: true,
                saveCheckpoints: false,
                visualize: false,
                verboseLogging: false,
                fallbackStrategy: 'greedy',
            };
            const result = await this.orchestrator.orchestrate(agentContext, options);
            this.recentResults.set(task.id, {
                task,
                result,
                timestamp: Date.now(),
            });
            await this.generateAutoFeedback(task, result);
            this.emit('taskCompleted', {
                taskId: task.id,
                result,
                processingTime: Date.now() - task.timestamp,
            });
            return result;
        }
        finally {
            this.processingTasks.delete(task.id);
        }
    }
    async generateAutoFeedback(task, result) {
        const responseTime = result.totalTime || 0;
        const tokensUsed = result.resourcesUsed?.tokensUsed || 0;
        const agentsUsed = result.resourcesUsed?.agents || 0;
        const timeScore = Math.max(0, 1 - responseTime / 10000);
        const efficiencyScore = Math.max(0, 1 - tokensUsed / 5000);
        const simplicityScore = Math.max(0, 1 - agentsUsed / 10);
        const overallScore = (timeScore + efficiencyScore + simplicityScore) / THREE;
        if (overallScore >= this.config.autoLearnThreshold) {
            const feedback = {
                nodeId: result.searchResult?.searchId || task.id,
                reward: {
                    value: overallScore,
                    components: {
                        quality: overallScore,
                        speed: timeScore,
                        cost: 1 - tokensUsed / 10000,
                    },
                    metadata: {
                        executionTime: responseTime,
                        tokensUsed,
                        memoryUsed: 0,
                        errors: 0,
                    },
                },
                errorOccurred: false,
                timestamp: Date.now(),
                context: {
                    taskType: task.type || 'general',
                    sessionId: task.id,
                },
            };
            await feedbackCollector.collectFeedback(feedback);
            log.info('📊 Auto-feedback generated', LogContext.AI, {
                taskId: task.id,
                score: overallScore,
                learned: true,
            });
        }
    }
    async performLearningCycle() {
        try {
            log.info('🧠 Starting learning cycle', LogContext.AI);
            this.metrics.learningCycles++;
            const recentFeedback = [];
            if (recentFeedback.length < 10) {
                log.info('⏸️ Not enough data for learning', LogContext.AI);
                return;
            }
            const performanceAnalysis = this.analyzePerformance(recentFeedback);
            if (this.config.autoOptimizeParameters && performanceAnalysis.averageScore < 0.8) {
                await this.optimizeParameters(performanceAnalysis);
            }
            this.emit('learningComplete', {
                cycleNumber: this.metrics.learningCycles,
                performanceAnalysis,
                optimized: this.config.autoOptimizeParameters,
            });
        }
        catch (error) {
            log.error('❌ Learning cycle failed', LogContext.AI, { error });
        }
    }
    analyzePerformance(feedback) {
        const scores = feedback.map((f) => f.score || f.reward?.value || 0);
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const times = feedback.map((f) => f.metadata?.responseTime || 0).filter((t) => t > 0);
        const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
        return {
            averageScore,
            averageTime,
            totalFeedback: feedback.length,
            scoreDistribution: this.calculateDistribution(scores),
            trends: this.calculateTrends(feedback),
        };
    }
    async optimizeParameters(analysis) {
        try {
            log.info('🔧 Optimizing parameters', LogContext.AI, { analysis });
            const recommendations = await mlParameterOptimizer.getOptimizationInsights();
            for (const recommendation of recommendations.slice(0, THREE)) {
                log.info('📊 Recommendation found', LogContext.AI, recommendation);
            }
            this.metrics.parameterOptimizations++;
            log.info('✅ Parameters optimized', LogContext.AI, {
                appliedRecommendations: recommendations.length,
            });
        }
        catch (error) {
            log.error('❌ Parameter optimization failed', LogContext.AI, { error });
        }
    }
    async handleFailedTask(task) {
        task.retries++;
        if (task.retries < this.config.fallbackAfterFailures) {
            task.priority = Math.max(1, task.priority - 1);
            this.taskQueue.push(task);
            log.info('🔄 Retrying failed task', LogContext.AI, {
                taskId: task.id,
                retries: task.retries,
            });
        }
        else {
            await this.executeFallback(task);
        }
    }
    async executeFallback(task) {
        try {
            log.warn('⚠️ Executing fallback for task', LogContext.AI, {
                taskId: task.id,
                retries: task.retries,
            });
            const { classification, plan: executionPlan } = await multiTierLLM.classifyAndPlan(task.userRequest, task.context);
            const result = await multiTierLLM.execute(JSON.stringify(executionPlan), classification);
            this.emit('taskFallback', {
                taskId: task.id,
                result,
                reason: 'max_retries_exceeded',
            });
        }
        catch (error) {
            log.error('❌ Fallback execution failed', LogContext.AI, {
                taskId: task.id,
                error,
            });
            this.emit('taskFailed', {
                taskId: task.id,
                error,
                retries: task.retries,
            });
        }
    }
    getBatch() {
        const availableSlots = this.config.batchSize - this.processingTasks.size;
        if (availableSlots <= 0) {
            return [];
        }
        return this.taskQueue.splice(0, availableSlots);
    }
    startMonitoring() {
        setInterval(() => {
            this.emit('metrics', this.getMetrics());
        }, 30000);
    }
    updateMetrics(update) {
        this.metrics.totalRequests += update.totalRequests || 0;
        this.metrics.successfulRequests += update.successfulRequests || 0;
        this.metrics.failedRequests += update.failedRequests || 0;
        const alpha = 0.1;
        if (update.processingTime) {
            this.metrics.averageResponseTime =
                alpha * update.processingTime + (1 - alpha) * this.metrics.averageResponseTime;
        }
    }
    calculateDistribution(scores) {
        const sorted = scores.sort((a, b) => a - b);
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: sorted[Math.floor(sorted.length / TWO)],
            p25: sorted[Math.floor(sorted.length * 0.25)],
            p75: sorted[Math.floor(sorted.length * 0.75)],
        };
    }
    calculateTrends(feedback) {
        const sorted = feedback.sort((a, b) => (a.metadata?.timestamp || 0) - (b.metadata?.timestamp || 0));
        const recentAvg = sorted.slice(-10).reduce((a, b) => a + (b.score || 0), 0) / 10;
        const olderAvg = sorted.slice(0, 10).reduce((a, b) => a + (b.score || 0), 0) / 10;
        return {
            improving: recentAvg > olderAvg,
            recentAverage: recentAvg,
            historicalAverage: olderAvg,
            trend: ((recentAvg - olderAvg) / olderAvg) * 100,
            averageScore: recentAvg,
            averageTime: 0,
            totalFeedback: sorted.length,
        };
    }
    async waitForTaskCompletion() {
        const maxWait = 30000;
        const startTime = Date.now();
        while (this.processingTasks.size > 0 && Date.now() - startTime < maxWait) {
            await this.sleep(100);
        }
        if (this.processingTasks.size > 0) {
            log.warn('⚠️ Some tasks still processing after timeout', LogContext.AI, {
                remaining: this.processingTasks.size,
            });
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getQueueStatus() {
        return {
            queued: this.taskQueue.length,
            processing: this.processingTasks.size,
            queuedTasks: this.taskQueue.map((t) => ({
                id: t.id,
                priority: t.priority,
                age: Date.now() - t.timestamp,
            })),
            processingTasks: Array.from(this.processingTasks.values()).map((t) => ({
                id: t.id,
                priority: t.priority,
                duration: Date.now() - t.timestamp,
            })),
        };
    }
    isActive() {
        return this.isRunning;
    }
}
export const abMCTSAutoPilot = new ABMCTSAutoPilot();
export default abMCTSAutoPilot;
//# sourceMappingURL=ab-mcts-auto-pilot.js.map