import { v4 as uuidv4 } from 'uuid';
import AgentRegistry from '@/agents/agent-registry';
import { EnhancedBaseAgent } from '@/agents/enhanced-base-agent';
import { createCircuitBreaker } from '@/utils/circuit-breaker';
import { TWO } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
import { abMCTSService } from './ab-mcts-service';
import { multiTierLLM } from './multi-tier-llm-service';
export class ABMCTSOrchestrator {
    config;
    circuitBreaker;
    activeSearches = new Map();
    executionCache = new Map();
    agentRegistry;
    constructor(config = {}) {
        this.config = {
            enableLearning: true,
            enableVisualization: true,
            fallbackToTraditional: true,
            parallelExecutions: 4,
            budgetAllocation: {
                exploration: 30,
                exploitation: 70,
            },
            maxIterations: 500,
            maxDepth: 8,
            explorationConstant: 1.414,
            discountFactor: 0.95,
            maxBudget: 5000,
            timeLimit: 20000,
            ...config,
        };
        this.circuitBreaker = createCircuitBreaker('ab-mcts-orchestrator', {
            failureThreshold: 3,
            timeout: this.config.timeLimit,
            successThreshold: 2,
        });
        this.agentRegistry = new AgentRegistry();
    }
    async orchestrate(context, options = {
        useCache: true,
        enableParallelism: true,
        collectFeedback: true,
        saveCheckpoints: false,
        visualize: false,
        verboseLogging: false,
        fallbackStrategy: 'greedy',
    }) {
        const startTime = Date.now();
        const orchestrationId = uuidv4();
        log.info('🎯 Starting AB-MCTS orchestration', LogContext.AI, {
            orchestrationId,
            request: context.userRequest.substring(0, 100),
            enableLearning: this.config.enableLearning,
        });
        try {
            return await this.circuitBreaker.execute(async () => this.executeOrchestration(context, orchestrationId, options), async () => this.fallbackOrchestration(context));
        }
        catch (error) {
            log.error('❌ AB-MCTS orchestration failed', LogContext.AI, {
                orchestrationId,
                error: error instanceof Error ? error.message : String(error),
                timeElapsed: Date.now() - startTime,
            });
            throw error;
        }
    }
    async executeOrchestration(context, orchestrationId, options) {
        const startTime = Date.now();
        const cacheKey = this.getCacheKey(context);
        if (options.useCache && this.executionCache.has(cacheKey)) {
            log.info('💾 Using cached orchestration result', LogContext.AI);
            return this.executionCache.get(cacheKey);
        }
        const availableAgents = await this.getAvailableAgents(context);
        if (availableAgents.length === 0) {
            throw new Error('No available agents for orchestration');
        }
        const searchResult = await abMCTSService.search({
            ...context,
            metadata: {
                ...context.metadata,
                orchestrationId,
                nodeId: 'root',
            },
        }, availableAgents.map((a) => a.getName()), options);
        this.activeSearches.set(orchestrationId, searchResult);
        const executionResult = await this.executeBestPath(searchResult, context, availableAgents);
        const totalTime = Date.now() - startTime;
        const resourcesUsed = this.calculateResourcesUsed(searchResult, executionResult);
        const result = {
            response: executionResult.response,
            searchResult,
            executionPath: executionResult.path,
            totalTime,
            resourcesUsed,
            feedback: executionResult.feedback,
        };
        if (options.useCache) {
            this.executionCache.set(cacheKey, result);
            if (this.executionCache.size > 100) {
                const firstKey = this.executionCache.keys().next().value;
                if (firstKey) {
                    this.executionCache.delete(firstKey);
                }
            }
        }
        if (this.config.enableLearning && executionResult.feedback) {
            await abMCTSService.processFeedback(executionResult.feedback);
        }
        log.info('✅ AB-MCTS orchestration completed', LogContext.AI, {
            orchestrationId,
            bestAgent: searchResult.bestAction.agentName,
            confidence: searchResult.confidence,
            pathLength: searchResult.bestPath.length,
            totalTime,
            nodesExplored: searchResult.searchMetrics.nodesExplored,
        });
        return result;
    }
    async executeBestPath(searchResult, context, availableAgents) {
        const { bestPath } = searchResult;
        if (bestPath.length < TWO) {
            throw new Error('No valid execution path found');
        }
        const selectedAgentName = searchResult.bestAction.agentName;
        const selectedAgent = availableAgents.find((a) => a.getName() === selectedAgentName);
        if (!selectedAgent) {
            throw new Error(`Agent ${selectedAgentName} not found`);
        }
        const nodeContext = {
            ...context,
            metadata: {
                ...(context.metadata || {}),
                nodeId: bestPath[1]?.id || 'unknown',
                orchestrationPath: bestPath.map((n) => n.id),
            },
        };
        const { response, feedback } = await selectedAgent.executeWithFeedback(nodeContext);
        return {
            response,
            path: bestPath.map((n) => n.metadata.agent || 'root'),
            feedback,
        };
    }
    async fallbackOrchestration(context) {
        log.warn('⚠️ Falling back to traditional orchestration', LogContext.AI);
        const startTime = Date.now();
        const { classification, plan } = await multiTierLLM.classifyAndPlan(context.userRequest, context.metadata || {});
        const result = await multiTierLLM.execute(context.userRequest, context.metadata || {});
        return {
            response: {
                success: true,
                data: result.response,
                confidence: 0.7,
                message: 'Executed via fallback orchestration',
                reasoning: plan.reasoning,
                metadata: result.metadata,
            },
            searchResult: {
                bestPath: [],
                bestAction: {
                    agentName: result.metadata.modelUsed,
                    agentType: 'cognitive',
                    estimatedCost: 100,
                    estimatedTime: result.metadata.executionTime,
                    requiredCapabilities: [],
                },
                confidence: 0.7,
                alternativePaths: [],
                searchMetrics: {
                    nodesExplored: 1,
                    iterations: 1,
                    timeElapsed: Date.now() - startTime,
                    averageDepth: 1,
                    branchingFactor: 0,
                },
                recommendations: ['Fallback orchestration used due to AB-MCTS failure'],
            },
            executionPath: ['fallback', result.metadata.modelUsed],
            totalTime: Date.now() - startTime,
            resourcesUsed: {
                agents: 1,
                llmCalls: 1,
                tokensUsed: result.metadata.tokensUsed,
            },
        };
    }
    async getAvailableAgents(context) {
        const agentDefinitions = this.agentRegistry.getAvailableAgents();
        const agents = [];
        for (const definition of agentDefinitions) {
            if (context.metadata?.requiredCapabilities) {
                const hasRequired = context.metadata.requiredCapabilities.every((req) => definition.capabilities.includes(req));
                if (!hasRequired)
                    continue;
            }
            const agent = await this.agentRegistry.getAgent(definition.name);
            if (agent && agent instanceof EnhancedBaseAgent) {
                const score = agent.getProbabilisticScore(context);
                if (score > 0.1) {
                    agents.push(agent);
                }
            }
        }
        return agents.sort((a, b) => {
            const scoreA = a.getProbabilisticScore(context);
            const scoreB = b.getProbabilisticScore(context);
            return scoreB - scoreA;
        });
    }
    calculateResourcesUsed(searchResult, executionResult) {
        const agentsUsed = new Set(searchResult.bestPath.map((n) => n.metadata.agent).filter(Boolean))
            .size;
        return {
            agents: agentsUsed,
            llmCalls: searchResult.searchMetrics.nodesExplored,
            tokensUsed: executionResult?.response?.metadata?.tokens?.total_tokens || 0,
        };
    }
    async getVisualization(orchestrationId) {
        const searchResult = this.activeSearches.get(orchestrationId);
        if (!searchResult)
            return null;
        return abMCTSService.getVisualizationData();
    }
    async processUserFeedback(orchestrationId, rating, comment) {
        const searchResult = this.activeSearches.get(orchestrationId);
        if (!searchResult || searchResult.bestPath.length < TWO)
            return;
        const leafNode = searchResult.bestPath[searchResult.bestPath.length - 1];
        if (!leafNode) {
            throw new Error('No leaf node found in search result');
        }
        const feedback = {
            nodeId: leafNode.id,
            reward: {
                value: rating / 5,
                components: {
                    quality: rating / 5,
                    speed: 0.7,
                    cost: 0.7,
                    user_satisfaction: rating / 5,
                },
                metadata: {
                    executionTime: 0,
                    tokensUsed: 0,
                    memoryUsed: 0,
                    errors: 0,
                },
            },
            userRating: rating,
            errorOccurred: false,
            timestamp: Date.now(),
            context: {
                taskType: 'user_feedback',
                sessionId: orchestrationId,
            },
        };
        await abMCTSService.processFeedback(feedback);
        log.info('👍 User feedback processed', LogContext.AI, {
            orchestrationId,
            rating,
            comment,
        });
    }
    getStatistics() {
        const cbMetrics = this.circuitBreaker.getMetrics();
        return {
            activeSearches: this.activeSearches.size,
            cachedResults: this.executionCache.size,
            circuitBreakerState: cbMetrics.state,
            averageSearchTime: 0,
            successRate: cbMetrics.totalRequests > 0 ? cbMetrics.successfulRequests / cbMetrics.totalRequests : 0,
        };
    }
    reset() {
        this.activeSearches.clear();
        this.executionCache.clear();
        this.circuitBreaker.reset();
        log.info('🔄 AB-MCTS orchestrator reset', LogContext.AI);
    }
    getCacheKey(context) {
        return `${context.userRequest}_${JSON.stringify(context.metadata || {})}`;
    }
    async orchestrateParallel(contexts, options = {
        useCache: true,
        enableParallelism: true,
        collectFeedback: true,
        saveCheckpoints: false,
        visualize: false,
        verboseLogging: false,
        fallbackStrategy: 'greedy',
    }) {
        log.info('🚀 Starting parallel AB-MCTS orchestration', LogContext.AI, {
            requests: contexts.length,
            parallelism: this.config.parallelExecutions,
        });
        const results = [];
        for (let i = 0; i < contexts.length; i += this.config.parallelExecutions) {
            const batch = contexts.slice(i, i + this.config.parallelExecutions);
            const batchResults = await Promise.allSettled(batch.map((ctx) => this.orchestrate(ctx, options)));
            for (const result of batchResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                }
                else {
                    results.push({
                        response: {
                            success: false,
                            data: null,
                            confidence: 0,
                            message: 'Orchestration failed',
                            reasoning: result.reason.message,
                            metadata: { error: result.reason },
                        },
                        searchResult: {},
                        executionPath: [],
                        totalTime: 0,
                        resourcesUsed: { agents: 0, llmCalls: 0, tokensUsed: 0 },
                    });
                }
            }
        }
        return results;
    }
    async getRecommendations() {
        const recommendations = [];
        const stats = this.getStatistics();
        if (stats.successRate < 0.8) {
            recommendations.push('Consider increasing exploration budget to find better agent paths');
        }
        if (stats.circuitBreakerState === 'OPEN') {
            recommendations.push('Circuit breaker is open - check system health and agent availability');
        }
        if (this.executionCache.size > 80) {
            recommendations.push('Cache is nearly full - consider increasing cache size or TTL');
        }
        const agentMetrics = await this.getAgentPerformanceMetrics();
        for (const [agent, metrics] of Object.entries(agentMetrics)) {
            if (metrics.successRate < 0.5) {
                recommendations.push(`Agent ${agent} has low success rate - consider retraining or replacement`);
            }
        }
        return recommendations;
    }
    async getAgentPerformanceMetrics() {
        const metrics = {};
        const loadedAgents = this.agentRegistry.getLoadedAgents();
        for (const agentName of loadedAgents) {
            const agent = await this.agentRegistry.getAgent(agentName);
            if (agent && agent instanceof EnhancedBaseAgent) {
                metrics[agentName] = agent.getPerformanceMetrics();
            }
        }
        return metrics;
    }
}
export const abMCTSOrchestrator = new ABMCTSOrchestrator();
export default abMCTSOrchestrator;
//# sourceMappingURL=ab-mcts-orchestrator.js.map