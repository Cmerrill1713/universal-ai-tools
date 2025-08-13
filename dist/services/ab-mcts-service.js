import { v4 as uuidv4 } from 'uuid';
import { isTerminalNode } from '../types/ab-mcts';
import { bayesianModelRegistry } from '../utils/bayesian-model';
import { THREE } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
import { AdaptiveExplorer, BetaSampler, ThompsonSelector, UCBCalculator, } from '../utils/thompson-sampling';
import { treeStorage } from './ab-mcts-tree-storage';
export class ABMCTSService {
    config;
    root = null;
    nodeCache = new Map();
    thompsonSelector;
    adaptiveExplorer;
    executionHistory = new Map();
    checkpointVersion = 0;
    constructor(config = {}) {
        this.config = {
            maxIterations: 1000,
            maxDepth: 10,
            explorationConstant: Math.sqrt(2),
            discountFactor: 0.95,
            priorAlpha: 1,
            priorBeta: 1,
            maxBudget: 10000,
            timeLimit: 30000,
            parallelism: 4,
            learningRate: 0.1,
            updateFrequency: 10,
            minSamplesForUpdate: 3,
            pruneThreshold: 0.1,
            cacheSize: 10000,
            checkpointInterval: 100,
            ...config,
        };
        this.thompsonSelector = new ThompsonSelector();
        this.adaptiveExplorer = new AdaptiveExplorer();
    }
    async search(initialContext, availableAgents, options = {}) {
        const fullOptions = {
            useCache: true,
            enableParallelism: true,
            collectFeedback: true,
            saveCheckpoints: false,
            visualize: false,
            verboseLogging: false,
            fallbackStrategy: 'greedy',
            ...options,
        };
        const startTime = Date.now();
        log.info('🌳 Starting AB-MCTS search', LogContext.AI, {
            maxIterations: this.config.maxIterations,
            availableAgents: availableAgents.length,
            options: fullOptions,
        });
        if (!this.root || !this.isSameContext(this.root.state, initialContext)) {
            if (fullOptions.useCache && treeStorage.isAvailable() && initialContext.requestId) {
                try {
                    const savedResult = await treeStorage.loadSearchResult(initialContext.requestId);
                    if (savedResult && savedResult.bestPath && savedResult.bestPath.length > 0) {
                        this.root = savedResult.bestPath[0] || null;
                        log.info('📂 Loaded AB-MCTS tree from storage', LogContext.AI, {
                            requestId: initialContext.requestId,
                        });
                    }
                    else {
                        this.root = this.createNode(initialContext, null);
                    }
                }
                catch (error) {
                    log.debug('No saved tree found, creating new root', LogContext.AI);
                    this.root = this.createNode(initialContext, null);
                }
            }
            else {
                this.root = this.createNode(initialContext, null);
            }
        }
        this.thompsonSelector.initializeArms(availableAgents, this.config.priorAlpha, this.config.priorBeta);
        let iterations = 0;
        let nodesExplored = 0;
        const startBudget = this.config.maxBudget;
        let remainingBudget = startBudget;
        while (iterations < this.config.maxIterations &&
            Date.now() - startTime < this.config.timeLimit &&
            remainingBudget > 0) {
            if (!this.root) {
                throw new Error('Root node is null during search');
            }
            const leaf = await this.select(this.root);
            nodesExplored++;
            if (!isTerminalNode(leaf) && leaf.visits > 0) {
                const expandedNode = await this.expand(leaf, availableAgents);
                if (expandedNode) {
                    nodesExplored++;
                    const reward = await this.simulate(expandedNode, availableAgents);
                    this.backpropagate(expandedNode, reward);
                    remainingBudget -= reward.metadata.tokensUsed * 0.001;
                }
            }
            if (iterations % this.config.checkpointInterval === 0 && fullOptions.saveCheckpoints) {
                await this.saveCheckpoint();
            }
            iterations++;
        }
        const result = this.getBestResult(nodesExplored, iterations, Date.now() - startTime);
        log.info('✅ AB-MCTS search completed', LogContext.AI, {
            iterations,
            nodesExplored,
            timeElapsed: Date.now() - startTime,
            bestScore: result.confidence,
            pathLength: result.bestPath.length,
        });
        if (fullOptions.saveCheckpoints && treeStorage.isAvailable() && this.root) {
            const searchId = initialContext.requestId || uuidv4();
            try {
                await treeStorage.saveNode(this.root, {
                    ttl: 3600,
                    compress: true,
                });
                await treeStorage.saveSearchResult(searchId, result, {
                    ttl: 3600,
                    compress: true,
                });
                log.info('💾 Saved AB-MCTS tree to Redis storage', LogContext.AI, { searchId });
            }
            catch (error) {
                log.warn('Failed to save tree to storage', LogContext.AI, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return result;
    }
    async select(node) {
        let current = node;
        while (!isTerminalNode(current) && current.children.size > 0) {
            const children = Array.from(current.children.values());
            const ucbScores = new Map();
            const thompsonScores = new Map();
            for (const child of children) {
                const ucb = UCBCalculator.ucb1(child.averageReward, current.visits, child.visits, this.config.explorationConstant);
                ucbScores.set(child.id, ucb);
                const thompson = BetaSampler.sample(child.priorAlpha + child.totalReward, child.priorBeta + (child.visits - child.totalReward));
                thompsonScores.set(child.id, thompson);
            }
            const selectedId = this.adaptiveExplorer.selectAction(thompsonScores, ucbScores, 1.0);
            current = children.find((c) => c.id === selectedId);
        }
        return current;
    }
    async expand(node, availableAgents) {
        const triedAgents = Array.from(node.children.values())
            .map((child) => child.metadata.agent)
            .filter(Boolean);
        const untriedAgents = availableAgents.filter((agent) => !triedAgents.includes(agent));
        if (untriedAgents.length === 0) {
            return null;
        }
        const selectedAgent = this.thompsonSelector.selectArm();
        const action = {
            agentName: selectedAgent,
            agentType: this.getAgentType(selectedAgent),
            estimatedCost: 100,
            estimatedTime: 1000,
            requiredCapabilities: [],
        };
        const childContext = {
            ...node.state,
            metadata: {
                ...node.state.metadata,
                selectedAgent,
                parentNodeId: node.id,
            },
        };
        const child = this.createNode(childContext, node, action);
        node.children.set(child.id, child);
        return child;
    }
    async simulate(node, availableAgents) {
        const startTime = Date.now();
        const agentName = node.metadata.agent || this.selectRandomAgent(availableAgents);
        try {
            const simulatedResponse = await this.simulateAgentExecution(agentName, node.state);
            const executionTime = Date.now() - startTime;
            const reward = this.calculateReward(simulatedResponse, executionTime);
            bayesianModelRegistry.updateModel(agentName, this.getTaskType(node.state), reward, executionTime, node.state.metadata || {});
            return reward;
        }
        catch (error) {
            log.error('❌ Simulation failed', LogContext.AI, {
                nodeId: node.id,
                agent: agentName,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                value: 0,
                components: {
                    quality: 0,
                    speed: 0,
                    cost: 1,
                },
                metadata: {
                    executionTime: Date.now() - startTime,
                    tokensUsed: 0,
                    memoryUsed: 0,
                    errors: 1,
                },
            };
        }
    }
    backpropagate(node, reward) {
        let current = node;
        let depth = 0;
        while (current) {
            current.visits++;
            const discountedReward = reward.value * Math.pow(this.config.discountFactor, depth);
            current.totalReward += discountedReward;
            current.averageReward = current.totalReward / current.visits;
            if (current.parent) {
                current.ucbScore = UCBCalculator.ucb1(current.averageReward, current.parent.visits, current.visits, this.config.explorationConstant);
            }
            if (discountedReward > 0.5) {
                current.priorAlpha += this.config.learningRate;
            }
            else {
                current.priorBeta += this.config.learningRate;
            }
            current.thompsonSample = BetaSampler.sample(current.priorAlpha, current.priorBeta);
            current.metadata.timestamp = Date.now();
            if (!current.metadata.confidenceInterval) {
                current.metadata.confidenceInterval = [0, 1];
            }
            current.metadata.confidenceInterval = BetaSampler.confidenceInterval({
                alpha: current.priorAlpha,
                beta: current.priorBeta,
                mean: current.averageReward,
                variance: 0,
            });
            current = current.parent;
            depth++;
        }
        if (node.metadata.agent) {
            this.thompsonSelector.updateArm(node.metadata.agent, reward.value > 0.5);
        }
    }
    getBestResult(nodesExplored, iterations, timeElapsed) {
        const bestPath = this.getBestPath(this.root);
        const bestAction = bestPath.length > 1
            ? {
                agentName: bestPath[1]?.metadata?.agent || 'unknown',
                agentType: 'cognitive',
                estimatedCost: 100,
                estimatedTime: 1000,
                requiredCapabilities: [],
            }
            : {
                agentName: 'fallback',
                agentType: 'cognitive',
                estimatedCost: 100,
                estimatedTime: 1000,
                requiredCapabilities: [],
            };
        const alternativePaths = this.getAlternativePaths(this.root, THREE);
        const avgDepth = this.calculateAverageDepth();
        const branchingFactor = this.calculateBranchingFactor();
        return {
            bestPath,
            bestAction,
            confidence: bestPath[bestPath.length - 1]?.averageReward || 0,
            alternativePaths,
            searchMetrics: {
                nodesExplored,
                iterations,
                timeElapsed,
                averageDepth: avgDepth,
                branchingFactor,
            },
            recommendations: this.generateRecommendations(bestPath),
        };
    }
    getBestPath(node) {
        const path = [node];
        let current = node;
        while (current.children.size > 0) {
            let bestChild = null;
            let bestReward = -Infinity;
            for (const child of current.children.values()) {
                if (child.averageReward > bestReward) {
                    bestReward = child.averageReward;
                    bestChild = child;
                }
            }
            if (!bestChild)
                break;
            path.push(bestChild);
            current = bestChild;
        }
        return path;
    }
    getAlternativePaths(node, count) {
        const paths = [];
        const visited = new Set();
        const findPaths = (current, path) => {
            if (paths.length >= count)
                return;
            if (current.children.size === 0 || path.length >= this.config.maxDepth) {
                paths.push([...path]);
                return;
            }
            const sortedChildren = Array.from(current.children.values()).sort((a, b) => b.averageReward - a.averageReward);
            for (const child of sortedChildren) {
                if (!visited.has(child.id)) {
                    visited.add(child.id);
                    findPaths(child, [...path, child]);
                }
            }
        };
        findPaths(node, [node]);
        return paths.slice(0, count);
    }
    generateRecommendations(bestPath) {
        const recommendations = [];
        if (bestPath.length > 1) {
            const leafNode = bestPath[bestPath.length - 1];
            if (leafNode) {
                if (leafNode.averageReward > 0.8) {
                    recommendations.push(`High confidence path found with ${leafNode.metadata.agent} agent`);
                }
                else if (leafNode.averageReward < 0.5) {
                    recommendations.push('Consider expanding search with more iterations');
                }
                if (leafNode.visits < 10) {
                    recommendations.push('Path has low sample size - results may be uncertain');
                }
            }
        }
        const rankings = this.thompsonSelector.getRankedArms();
        if (rankings.length > 0 && rankings[0] && rankings[0].mean > 0.7) {
            recommendations.push(`${rankings[0].name} shows consistent high performance`);
        }
        return recommendations;
    }
    createNode(state, parent, action) {
        const node = {
            id: uuidv4(),
            state,
            visits: 0,
            totalReward: 0,
            averageReward: 0,
            ucbScore: Infinity,
            thompsonSample: 0,
            priorAlpha: this.config.priorAlpha,
            priorBeta: this.config.priorBeta,
            children: new Map(),
            parent: parent || undefined,
            depth: parent ? parent.depth + 1 : 0,
            isTerminal: false,
            isExpanded: false,
            metadata: {
                agent: action?.agentName,
                action: action?.agentName,
                timestamp: Date.now(),
            },
        };
        this.nodeCache.set(node.id, node);
        if (this.nodeCache.size > this.config.cacheSize) {
            this.pruneCache();
        }
        return node;
    }
    async simulateAgentExecution(agentName, context) {
        const model = bayesianModelRegistry.getModel(agentName, this.getTaskType(context));
        const prediction = model.predict(context.metadata || {});
        await new Promise((resolve) => setTimeout(resolve, prediction.expectedTime));
        return {
            success: Math.random() < prediction.expectedReward,
            data: { simulated: true },
            confidence: prediction.confidence,
            message: `Simulated response from ${agentName}`,
            reasoning: 'AB-MCTS simulation',
            metadata: {
                agentName,
                executionTime: prediction.expectedTime,
                tokens: prediction.expectedResources,
            },
        };
    }
    calculateReward(response, executionTime) {
        const quality = response.success ? response.confidence : 0;
        const speedScore = Math.max(0, 1 - executionTime / 10000);
        const tokens = response.metadata?.tokens || 100;
        const costScore = Math.max(0, 1 - tokens / 1000);
        const value = 0.5 * quality + 0.3 * speedScore + 0.2 * costScore;
        return {
            value,
            components: {
                quality,
                speed: speedScore,
                cost: costScore,
            },
            metadata: {
                executionTime,
                tokensUsed: tokens,
                memoryUsed: 0,
                errors: response.success ? 0 : 1,
            },
        };
    }
    async processFeedback(feedback) {
        const node = this.nodeCache.get(feedback.nodeId);
        if (!node) {
            log.warn('Node not found for feedback', LogContext.AI, { nodeId: feedback.nodeId });
            return;
        }
        if (!this.executionHistory.has(feedback.nodeId)) {
            this.executionHistory.set(feedback.nodeId, []);
        }
        this.executionHistory.get(feedback.nodeId).push(feedback);
        this.backpropagate(node, feedback.reward);
        if (node.metadata.agent) {
            bayesianModelRegistry.updateModel(node.metadata.agent, feedback.context.taskType, feedback.reward, feedback.reward.metadata.executionTime, feedback.context);
        }
        log.info('📊 Feedback processed', LogContext.AI, {
            nodeId: feedback.nodeId,
            reward: feedback.reward.value,
            userRating: feedback.userRating,
        });
    }
    isSameContext(a, b) {
        return a.userRequest === b.userRequest && a.requestId === b.requestId;
    }
    getAgentType(agentName) {
        if (agentName.includes('evolved'))
            return 'evolved';
        if (agentName.includes('personal'))
            return 'personal';
        if (agentName.includes('generated'))
            return 'generated';
        return 'cognitive';
    }
    getTaskType(context) {
        return context.metadata?.taskType || 'general';
    }
    selectRandomAgent(agents) {
        if (agents.length === 0) {
            return 'fallback';
        }
        return agents[Math.floor(Math.random() * agents.length)] || 'fallback';
    }
    calculateAverageDepth() {
        let totalDepth = 0;
        let nodeCount = 0;
        const traverse = (node) => {
            totalDepth += node.depth;
            nodeCount++;
            for (const child of node.children.values()) {
                traverse(child);
            }
        };
        if (this.root)
            traverse(this.root);
        return nodeCount > 0 ? totalDepth / nodeCount : 0;
    }
    calculateBranchingFactor() {
        let totalChildren = 0;
        let nodesWithChildren = 0;
        const traverse = (node) => {
            if (node.children.size > 0) {
                totalChildren += node.children.size;
                nodesWithChildren++;
            }
            for (const child of node.children.values()) {
                traverse(child);
            }
        };
        if (this.root)
            traverse(this.root);
        return nodesWithChildren > 0 ? totalChildren / nodesWithChildren : 0;
    }
    pruneCache() {
        const sortedNodes = Array.from(this.nodeCache.values()).sort((a, b) => a.metadata.timestamp - b.metadata.timestamp);
        const toRemove = sortedNodes.slice(0, this.nodeCache.size - this.config.cacheSize * 0.8);
        for (const node of toRemove) {
            this.nodeCache.delete(node.id);
        }
    }
    async saveCheckpoint() {
        this.checkpointVersion++;
        log.debug('Checkpoint saved', LogContext.AI, { version: this.checkpointVersion });
    }
    getVisualizationData() {
        if (!this.root)
            return null;
        const nodes = [];
        const edges = [];
        const traverse = (node, isBestPath = false) => {
            nodes.push({
                id: node.id,
                label: node.metadata.agent || 'root',
                score: node.averageReward,
                visits: node.visits,
                depth: node.depth,
                isLeaf: node.children.size === 0,
                isBest: isBestPath,
            });
            for (const child of node.children.values()) {
                edges.push({
                    source: node.id,
                    target: child.id,
                    weight: child.visits / node.visits,
                    label: child.metadata.action,
                });
                traverse(child, false);
            }
        };
        const bestPath = this.getBestPath(this.root);
        bestPath.forEach((node) => traverse(node, true));
        return {
            nodes,
            edges,
            metrics: {
                totalNodes: nodes.length,
                maxDepth: Math.max(...nodes.map((n) => n.depth)),
                avgBranchingFactor: this.calculateBranchingFactor(),
                explorationRate: nodes.filter((n) => n.visits === 0).length / nodes.length,
            },
        };
    }
}
class ABMCTSOrchestrator {
    service;
    constructor() {
        this.service = new ABMCTSService();
    }
    async orchestrate(context, options) {
        const availableAgents = ['planner', 'retriever', 'synthesizer', 'orchestrator'];
        const result = await this.service.search(context, availableAgents, options);
        return {
            response: { success: true, data: 'Mock AB-MCTS response' },
            searchResult: {
                searchMetrics: result.searchMetrics,
                bestAction: result.bestAction.agentName,
                confidence: result.confidence,
                recommendations: result.recommendations,
            },
            executionPath: result.bestPath.map((n) => n.metadata.agent || 'unknown'),
            totalTime: result.searchMetrics.timeElapsed,
            resourcesUsed: ['cpu', 'memory'],
        };
    }
    async orchestrateParallel(contexts, options) {
        const promises = contexts.map((context) => this.orchestrate(context, options));
        return Promise.all(promises);
    }
    async processUserFeedback(id, rating, comment) {
        console.log(`Mock feedback processed: ${id}, rating: ${rating}`);
    }
    async getVisualization(id) {
        return this.service.getVisualizationData();
    }
    getStatistics() {
        return {
            circuitBreakerState: 'CLOSED',
            successRate: 0.95,
            activeSearches: 0,
        };
    }
    async getRecommendations() {
        return ['Mock recommendation 1', 'Mock recommendation 2'];
    }
    reset() {
        console.log('AB-MCTS orchestrator reset');
    }
}
export const abMCTSService = new ABMCTSService();
export const abMCTSOrchestrator = new ABMCTSOrchestrator();
export default abMCTSService;
//# sourceMappingURL=ab-mcts-service.js.map