import { dspyBridge } from './dspy-orchestrator/bridge';
import { LogContext, logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import { TIME_1000MS } from "../utils/common-constants";
import { EnhancedMemorySystem } from '../memory/enhanced_memory_system';
import { agentCollaborationWS } from './agent-collaboration-websocket';
export class DSPyService {
    bridge;
    isInitialized = false;
    memorySystem = null;
    constructor(supabase) {
        this.bridge = dspyBridge;
        // Initialize memory system if supabase is provided
        if (supabase) {
            this.memorySystem = new EnhancedMemorySystem(supabase, logger);
        }
        // Don't block on initialization - let it happen in the background
        this.initialize().catch((error) => {
            logger.error('DSPy service initialization failed:', LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error)
            });
        });
    }
    async initialize() {
        try {
            logger.info('🚀 Initializing DSPy service...');
            // Wait for bridge to connect (with short timeout to not block server startup)
            if (process.env.ENABLE_DSPY_MOCK === 'true') {
                await this.waitForConnection(5000);
            }
            else {
                logger.info('DSPy mock disabled - skipping connection wait');
            }
            this.isInitialized = true;
            logger.info('✅ DSPy service initialized successfully');
        }
        catch (error) {
            logger.warn('DSPy service initialization failed (will retry on first use)', LogContext.SYSTEM, { error: error instanceof Error ? error.message : String(error) });
            // Don't throw - let server continue without DSPy
            this.isInitialized = false;
        }
    }
    async waitForConnection(timeout = 30000) {
        const startTime = Date.now();
        while (!this.bridge.getStatus().connected) {
            if (Date.now() - startTime > timeout) {
                throw new Error('DSPy connection timeout');
            }
            await new Promise((resolve) => setTimeout(resolve, TIME_1000MS));
        }
    }
    /**
     * Main orchestration method that replaces the old enhanced orchestrator
     */
    async orchestrate(request) {
        const startTime = Date.now();
        try {
            if (!this.isInitialized) {
                await this.waitForConnection();
            }
            logger.info(`🎯 DSPy orchestration for request ${request.requestId}`);
            // Notify UI about orchestration start
            agentCollaborationWS.updateAgentStatus({
                agentId: 'orchestrator',
                agentName: 'Orchestrator',
                status: 'thinking',
                currentTask: 'Analyzing user request',
                timestamp: new Date(),
                metadata: {
                    participatingIn: request.requestId,
                },
            });
            // Call DSPy orchestrator
            const result = await this.bridge.orchestrate(request.userRequest, {
                userId: request.userId,
                mode: request.orchestrationMode,
                ...request.context,
            });
            const executionTime = Date.now() - startTime;
            // Extract relevant information from DSPy result
            const response = {
                requestId: request.requestId,
                success: true,
                mode: result.orchestration_mode || 'standard',
                result: result.consensus || result,
                complexity: result.complexity,
                confidence: result.confidence,
                reasoning: result.coordination_plan || result.reasoning,
                participatingAgents: result.selected_agents
                    ? result.selected_agents.split(',').map((a) => a.trim())
                    : [],
                executionTime,
            };
            logger.info(`✅ DSPy orchestration completed in ${executionTime}ms`);
            // Update orchestrator status and notify about participating agents
            if (response.participatingAgents && response.participatingAgents.length > 0) {
                agentCollaborationWS.startCollaboration(request.requestId, response.participatingAgents);
                // Update orchestrator to working status
                agentCollaborationWS.updateAgentStatus({
                    agentId: 'orchestrator',
                    agentName: 'Orchestrator',
                    status: 'working',
                    currentTask: 'Coordinating agents',
                    progress: 50,
                    timestamp: new Date(),
                    metadata: {
                        participatingIn: request.requestId,
                        confidence: response.confidence,
                    },
                });
            }
            // Store orchestration details in memory if available
            if (this.memorySystem && response.success) {
                try {
                    await this.memorySystem.storeMemory('dspy-orchestrator', 'orchestration', `Orchestration: ${request.userRequest} -> ${JSON.stringify(response.result)}`, {
                        requestId: request.requestId,
                        userId: request.userId,
                        orchestrationMode: response.mode,
                        confidence: response.confidence,
                        participatingAgents: response.participatingAgents,
                        complexity: response.complexity,
                        executionTime: response.executionTime,
                        timestamp: request.timestamp,
                    }, [] // Keywords extracted automatically
                    );
                    logger.debug('DSPy orchestration stored in memory system');
                }
                catch (memoryError) {
                    // Don't fail orchestration if memory storage fails
                    logger.warn('Failed to store DSPy orchestration in memory:', memoryError);
                }
            }
            // Complete orchestration and notify UI
            agentCollaborationWS.completeAgentTask('orchestrator', response.result);
            agentCollaborationWS.endCollaboration(request.requestId, response.result);
            return response;
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            logger.error('DSPy orchestration failed:', LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error)
            });
            return {
                requestId: request.requestId,
                success: false,
                mode: 'fallback',
                result: null,
                executionTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Coordinate multiple agents for a specific task
     */
    async coordinateAgents(task, availableAgents, context = {}) {
        try {
            const result = await this.bridge.coordinateAgents(task, availableAgents, context);
            return {
                success: true,
                selectedAgents: result.selected_agents,
                coordinationPlan: result.coordination_plan,
                assignments: result.agent_assignments || [],
            };
        }
        catch (error) {
            logger.error('Agent coordination failed:', LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Generic request method for DSPy operations
     */
    async request(operation, params = {}) {
        try {
            switch (operation) {
                case 'manage_knowledge':
                case 'optimize_knowledge_modules':
                case 'get_optimization_metrics':
                    return await this.manageKnowledge(operation, params);
                case 'orchestrate':
                    return await this.orchestrate({
                        requestId: params.requestId || uuidv4(),
                        userRequest: params.userRequest || '',
                        userId: params.userId || 'system',
                        orchestrationMode: params.mode,
                        context: params,
                        timestamp: new Date(),
                    });
                case 'coordinate_agents':
                    return await this.coordinateAgents(params.task || '', params.availableAgents || [], params.context || {});
                default:
                    // For unknown operations, try to pass through to DSPy bridge
                    if (this.bridge && typeof this.bridge[operation] === 'function') {
                        return await this.bridge[operation](params);
                    }
                    throw new Error(`Unknown DSPy operation: ${operation}`);
            }
        }
        catch (error) {
            logger.error(`DSPy request failed for operation ${operation}:`, LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error)
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Manage knowledge operations through DSPy
     */
    async manageKnowledge(operation, data) {
        try {
            const result = await this.bridge.manageKnowledge(operation, data);
            return {
                success: true,
                operation,
                result,
            };
        }
        catch (error) {
            logger.error('Knowledge management failed:', LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Search knowledge using DSPy's optimized search
     */
    async searchKnowledge(query, options = {}) {
        return this.manageKnowledge('search', { query, ...options });
    }
    /**
     * Extract structured knowledge from content
     */
    async extractKnowledge(content, context = {}) {
        return this.manageKnowledge('extract', { content: context });
    }
    /**
     * Evolve existing knowledge with new information
     */
    async evolveKnowledge(existingKnowledge, newInfo) {
        return this.manageKnowledge('evolve', {
            existing_knowledge: existingKnowledge,
            new_information: newInfo,
        });
    }
    /**
     * Optimize prompts for better performance
     */
    async optimizePrompts(examples) {
        try {
            const result = await this.bridge.optimizePrompts(examples);
            return {
                success: true,
                optimized: result.optimized,
                improvements: result.improvements,
                performanceGain: result.performance_gain,
            };
        }
        catch (error) {
            logger.error('Prompt optimization failed:', LogContext.DSPY, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    /**
     * Get service status
     */
    getStatus() {
        const bridgeStatus = this.bridge.getStatus();
        return {
            initialized: this.isInitialized,
            connected: bridgeStatus.connected,
            queueSize: bridgeStatus.queueSize,
        };
    }
    /**
     * Shutdown the service gracefully
     */
    async shutdown() {
        logger.info('Shutting down DSPy service...');
        await this.bridge.shutdown();
        this.isInitialized = false;
    }
}
// Lazy initialization to prevent blocking during import
let _dspyService = null;
export function getDSPyService() {
    if (!_dspyService) {
        _dspyService = new DSPyService();
    }
    return _dspyService;
}
// For backward compatibility (but prefer using getDSPyService())
export const dspyService = {
    orchestrate: async (request) => getDSPyService().orchestrate(request),
    coordinateAgents: async (task, availableAgents, context = {}) => getDSPyService().coordinateAgents(task, availableAgents, context),
    searchKnowledge: async (query, options = {}) => getDSPyService().searchKnowledge(query, options),
    extractKnowledge: async (content, context = {}) => getDSPyService().extractKnowledge(content, context),
    evolveKnowledge: async (existingKnowledge, newInfo) => getDSPyService().evolveKnowledge(existingKnowledge, newInfo),
    optimizePrompts: async (examples) => getDSPyService().optimizePrompts(examples),
    request: async (operation, params = {}) => getDSPyService().request(operation, params),
    manageKnowledge: async (operation, data) => getDSPyService().manageKnowledge(operation, data),
    getStatus: () => getDSPyService().getStatus(),
    shutdown: async () => getDSPyService().shutdown(),
};
// Types are already exported above
