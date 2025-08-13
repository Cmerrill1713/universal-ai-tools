import { EventEmitter } from 'events';
const GOOD_CONFIDENCE = 0.7;
const MODERATE_CONFIDENCE = 0.6;
export class BaseAgent extends EventEmitter {
    config;
    metrics;
    isInitialized = false;
    memoryCoordinator;
    logger;
    constructor(config) {
        super();
        this.config = config;
        this.metrics = this.initializeMetrics();
        this.logger = console;
        this.setupLogger();
        this.setupEventListeners();
    }
    async setupLogger() {
        try {
            const { logger } = await import('../utils/logger.js');
            this.logger = logger;
        }
        catch {
            this.logger = console;
        }
    }
    initializeMetrics() {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            averageLatencyMs: 0,
            performanceScore: 1.0,
        };
    }
    setupEventListeners() {
        this.on('request_started', this.onRequestStarted.bind(this));
        this.on('request_completed', this.onRequestCompleted.bind(this));
        this.on('request_failed', this.onRequestFailed.bind(this));
    }
    async initialize(memoryCoordinator) {
        try {
            this.memoryCoordinator = memoryCoordinator;
            if (this.config.memoryEnabled && this.memoryCoordinator) {
                await this.loadMemory();
            }
            await this.onInitialize();
            this.isInitialized = true;
            this.logger.info(`✅ Agent ${this.config.name} initialized successfully`);
        }
        catch (error) {
            this.logger.error(`❌ Failed to initialize agent ${this.config.name}:`, error);
            throw error;
        }
    }
    async execute(context) {
        const startTime = Date.now();
        const { requestId } = context;
        this.emit('request_started', { agentId: this.config.name, requestId, context });
        try {
            if (!this.isInitialized) {
                throw new Error(`Agent ${this.config.name} not initialized`);
            }
            this.metrics.totalRequests++;
            let memoryContext = null;
            if (this.config.memoryEnabled && this.memoryCoordinator) {
                memoryContext = await this.retrieveMemory(context);
            }
            const result = await this.processWithTimeout({
                ...context,
                memoryContext,
            });
            if (this.config.memoryEnabled && this.memoryCoordinator && result.success) {
                await this.storeMemory(context, result);
            }
            const latencyMs = Date.now() - startTime;
            this.updateMetrics(latencyMs, true);
            if (latencyMs > this.config.maxLatencyMs) {
                this.logger.warn(`⚠️ Agent ${this.config.name} exceeded latency target: ${latencyMs}ms > ${this.config.maxLatencyMs}ms`);
            }
            const response = {
                ...result,
                latencyMs,
                agentId: this.config.name,
            };
            this.emit('request_completed', { agentId: this.config.name, requestId, response });
            return response;
        }
        catch (error) {
            const latencyMs = Date.now() - startTime;
            this.updateMetrics(latencyMs, false);
            const errorResponse = {
                success: false,
                data: null,
                reasoning: `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`,
                confidence: 0,
                latencyMs,
                agentId: this.config.name,
                error: error instanceof Error ? error.message : String(error),
            };
            this.emit('request_failed', { agentId: this.config.name, requestId, error: errorResponse });
            return errorResponse;
        }
    }
    async processWithTimeout(context) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Agent execution timeout after ${this.config.maxLatencyMs}ms`));
            }, this.config.maxLatencyMs);
            this.process(context)
                .then((result) => {
                clearTimeout(timeout);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    getStatus() {
        return {
            name: this.config.name,
            isInitialized: this.isInitialized,
            metrics: { ...this.metrics },
            config: {
                priority: this.config.priority,
                capabilities: this.config.capabilities.map((c) => c.name),
                dependencies: this.config.dependencies,
            },
            healthScore: this.calculateHealthScore(),
        };
    }
    async shutdown() {
        try {
            await this.onShutdown();
            this.removeAllListeners();
            this.isInitialized = false;
            this.logger.info(`✅ Agent ${this.config.name} shutdown complete`);
        }
        catch (error) {
            this.logger.error(`❌ Error during agent shutdown:`, error);
        }
    }
    async loadMemory() {
        if (!this.memoryCoordinator)
            return;
        try {
            if (this.memoryCoordinator &&
                typeof this.memoryCoordinator === 'object' &&
                'retrieveAgentMemory' in this.memoryCoordinator &&
                typeof this.memoryCoordinator.retrieveAgentMemory === 'function') {
                await this.memoryCoordinator.retrieveAgentMemory(this.config.name);
            }
            this.logger.debug(`📚 Loaded memory for agent ${this.config.name}`);
        }
        catch (error) {
            this.logger.warn(`⚠️ Failed to load memory for agent ${this.config.name}:`, error);
        }
    }
    async retrieveMemory(context) {
        if (!this.memoryCoordinator)
            return null;
        try {
            if (this.memoryCoordinator &&
                typeof this.memoryCoordinator === 'object' &&
                'retrieveRelevantMemory' in this.memoryCoordinator &&
                typeof this.memoryCoordinator.retrieveRelevantMemory === 'function') {
                return await this.memoryCoordinator.retrieveRelevantMemory(this.config.name, context.userRequest);
            }
            return null;
        }
        catch (error) {
            this.logger.warn(`⚠️ Failed to retrieve memory:`, error);
            return null;
        }
    }
    async storeMemory(context, result) {
        if (!this.memoryCoordinator)
            return;
        try {
            if (this.memoryCoordinator &&
                typeof this.memoryCoordinator === 'object' &&
                'storeAgentMemory' in this.memoryCoordinator &&
                typeof this.memoryCoordinator.storeAgentMemory === 'function') {
                await this.memoryCoordinator.storeAgentMemory(this.config.name, context, result);
            }
        }
        catch (error) {
            this.logger.warn(`⚠️ Failed to store memory:`, error);
        }
    }
    onRequestStarted(event) {
        if (event && typeof event === 'object' && 'requestId' in event) {
            this.logger.debug(`🚀 Agent ${this.config.name} processing request ${event.requestId}`);
        }
    }
    onRequestCompleted(event) {
        if (event && typeof event === 'object' && 'requestId' in event) {
            this.logger.debug(`✅ Agent ${this.config.name} completed request ${event.requestId}`);
        }
    }
    onRequestFailed(event) {
        if (event && typeof event === 'object' && 'requestId' in event && 'error' in event) {
            this.logger.error(`❌ Agent ${this.config.name} failed request ${event.requestId}:`, event.error);
        }
    }
    updateMetrics(latencyMs, success) {
        if (success) {
            this.metrics.successfulRequests++;
        }
        if (this.metrics.totalRequests === 1) {
            this.metrics.averageLatencyMs = latencyMs;
        }
        else {
            const alpha = 0.1;
            this.metrics.averageLatencyMs =
                alpha * latencyMs + (1 - alpha) * this.metrics.averageLatencyMs;
        }
        this.metrics.lastExecuted = new Date();
        this.metrics.performanceScore = this.calculatePerformanceScore();
    }
    calculatePerformanceScore() {
        if (this.metrics.totalRequests === 0)
            return 1.0;
        const successRate = this.metrics.successfulRequests / this.metrics.totalRequests;
        const latencyScore = Math.max(0, 1 - this.metrics.averageLatencyMs / this.config.maxLatencyMs);
        return successRate * GOOD_CONFIDENCE + latencyScore * 0.3;
    }
    calculateHealthScore() {
        if (!this.isInitialized)
            return 0;
        const performanceWeight = MODERATE_CONFIDENCE;
        const uptimeWeight = 0.2;
        const errorRateWeight = 0.2;
        const errorRate = this.metrics.totalRequests > 0
            ? (this.metrics.totalRequests - this.metrics.successfulRequests) /
                this.metrics.totalRequests
            : 0;
        const healthScore = this.metrics.performanceScore * performanceWeight +
            1.0 * uptimeWeight +
            (1 - errorRate) * errorRateWeight;
        return Math.max(0, Math.min(1, healthScore));
    }
}
export default BaseAgent;
//# sourceMappingURL=base_agent.js.map