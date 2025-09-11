export class HttpMCTSBridge {
    config;
    baseUrl;
    initialized = false;
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    constructor(baseUrl = process.env.AB_MCTS_URL || 'http://localhost:8082', config) {
        this.config = config;
        this.baseUrl = baseUrl.replace(/\/$/, '');
        console.log(`AB-MCTS HTTP Bridge initialized with URL: ${this.baseUrl}`);
    }
    async initialize() {
        try {
            if (this.config) {
                const response = await fetch(`${this.baseUrl}/api/v1/initialize`, {
                    method: 'POST',
                    headers: this.headers,
                    body: JSON.stringify(this.config),
                });
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Initialization failed: ${error}`);
                }
            }
            const health = await this.healthCheck();
            if (health.bridgeStatus !== 'healthy') {
                throw new Error('Service is not healthy');
            }
            this.initialized = true;
            console.log('AB-MCTS HTTP Bridge initialized successfully');
        }
        catch (error) {
            throw new Error(`Failed to initialize AB-MCTS bridge: ${error}`);
        }
    }
    isReady() {
        return this.initialized;
    }
    async updateConfig(config) {
        const response = await fetch(`${this.baseUrl}/api/v1/initialize`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(config),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to update config: ${error}`);
        }
        this.config = config;
    }
    async reset() {
        await this.updateConfig(this.config || this.getDefaultConfig());
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/health`, {
                method: 'GET',
                headers: this.headers,
            });
            if (!response.ok) {
                throw new Error(`Health check failed with status ${response.status}`);
            }
            const data = await response.json();
            return {
                bridgeStatus: data.status === 'healthy' ? 'healthy' : 'unhealthy',
                bridgeVersion: data.version || '1.0.0',
                configValid: true,
                timestamp: Date.now(),
                engine: {
                    status: data.status === 'healthy' ? 'healthy' : 'error',
                    message: data.status,
                },
                features: data.features || {
                    thompsonSampling: false,
                    bayesianLearning: false,
                    caching: false,
                    parallelSimulation: false,
                },
            };
        }
        catch (error) {
            return {
                bridgeStatus: 'unhealthy',
                bridgeVersion: '1.0.0',
                configValid: false,
                timestamp: Date.now(),
                engine: {
                    status: 'error',
                    message: `Health check failed: ${error}`,
                },
                features: {
                    thompsonSampling: false,
                    bayesianLearning: false,
                    caching: false,
                    parallelSimulation: false,
                },
            };
        }
    }
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    }
    async searchOptimalAgents(context, availableAgents, options) {
        this.ensureInitialized();
        const response = await fetch(`${this.baseUrl}/api/v1/search`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                context,
                available_agents: availableAgents,
                options,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`MCTS search failed: ${error}`);
        }
        return response.json();
    }
    async recommendAgents(context, availableAgents, maxRecommendations = 3) {
        this.ensureInitialized();
        const response = await fetch(`${this.baseUrl}/api/v1/recommend`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                context,
                available_agents: availableAgents,
                max_recommendations: maxRecommendations,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Agent recommendation failed: ${error}`);
        }
        return response.json();
    }
    async updateWithFeedback(sessionId, agentName, reward) {
        this.ensureInitialized();
        const response = await fetch(`${this.baseUrl}/api/v1/feedback`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                session_id: sessionId,
                agent_name: agentName,
                reward,
            }),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Feedback update failed: ${error}`);
        }
    }
    async getPerformanceStats() {
        const response = await fetch(`${this.baseUrl}/metrics`, {
            method: 'GET',
            headers: { 'Accept': 'text/plain' },
        });
        if (!response.ok) {
            throw new Error(`Failed to get performance stats: ${response.statusText}`);
        }
        const metricsText = await response.text();
        return {
            totalIterations: this.parseMetric(metricsText, 'ab_mcts_iterations_total') || 0,
            totalSearches: this.parseMetric(metricsText, 'ab_mcts_searches_total'),
            nodesExplored: this.parseMetric(metricsText, 'ab_mcts_nodes_explored_total') || 0,
            averageDepth: this.parseMetric(metricsText, 'ab_mcts_average_depth') || 0,
            searchTimeMs: this.parseMetric(metricsText, 'ab_mcts_search_time_ms') || 0,
            cacheHits: this.parseMetric(metricsText, 'ab_mcts_cache_hits_total') || 0,
            cacheMisses: this.parseMetric(metricsText, 'ab_mcts_cache_misses_total') || 0,
            thompsonSamples: this.parseMetric(metricsText, 'ab_mcts_thompson_samples_total') || 0,
            ucbSelections: this.parseMetric(metricsText, 'ab_mcts_ucb_selections_total') || 0,
            cacheHitRate: 0,
        };
    }
    validateContext(context) {
        return !!(context.task &&
            context.task.trim().length > 0 &&
            context.executionContext?.sessionId &&
            context.executionContext.sessionId.trim().length > 0);
    }
    getConfig() {
        return this.config || this.getDefaultConfig();
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('AB-MCTS bridge not initialized. Call initialize() first.');
        }
    }
    getDefaultConfig() {
        return {
            maxIterations: 1000,
            maxDepth: 10,
            explorationConstant: 1.414,
            discountFactor: 0.95,
            timeLimitMs: 10000,
            enableThompsonSampling: true,
            enableBayesianLearning: true,
            enableCaching: false,
            parallelSimulations: 4,
        };
    }
    parseMetric(metricsText, metricName) {
        const regex = new RegExp(`${metricName}\\s+(\\d+(?:\\.\\d+)?)`);
        const match = metricsText.match(regex);
        return match && match[1] ? parseFloat(match[1]) : 0;
    }
}
export async function createHttpMCTSBridge(baseUrl, config) {
    const bridge = new HttpMCTSBridge(baseUrl, config);
    await bridge.initialize();
    return bridge;
}
export class MCTSBridge extends HttpMCTSBridge {
    constructor(config) {
        const baseUrl = process.env.AB_MCTS_SERVICE_URL ||
            process.env.AB_MCTS_URL ||
            'http://ab-mcts-rust:8082';
        super(baseUrl, config);
        console.log('MCTSBridge using HTTP backend at:', baseUrl);
    }
    static createTestContext(task, sessionId) {
        return {
            task,
            requirements: ['test_requirement'],
            constraints: [],
            contextData: {},
            executionContext: {
                sessionId: sessionId || `test_session_${Date.now()}`,
                userId: 'test_user',
                timestamp: Date.now(),
                budget: 100.0,
                priority: 'normal',
            },
        };
    }
}
export { createHttpMCTSBridge as createMCTSBridge };
//# sourceMappingURL=http-bridge.js.map