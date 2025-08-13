import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';
import { config } from '@/config/environment';
import { a2aMesh } from '@/services/a2a-communication-mesh';
import { AgentCategory } from '@/types';
import { log, LogContext } from '@/utils/logger';
import { EnhancedPlannerAgent } from './cognitive/enhanced-planner-agent';
import { EnhancedRetrieverAgent } from './cognitive/enhanced-retriever-agent';
import { EnhancedSynthesizerAgent } from './cognitive/enhanced-synthesizer-agent';
import { EnhancedPersonalAssistantAgent } from './personal/enhanced-personal-assistant-agent';
import { EnhancedCodeAssistantAgent } from './specialized/enhanced-code-assistant-agent';
export class AgentRegistry extends EventEmitter {
    agentDefinitions = new Map();
    loadedAgents = new Map();
    agentUsage = new Map();
    loadingLocks = new Map();
    supabase;
    constructor() {
        super();
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseAnonKey) {
            throw new Error('SUPABASE_ANON_KEY environment variable is required');
        }
        this.supabase = createClient(config.database.url.includes('supabase')
            ? config.database.url
            : process.env.SUPABASE_URL || 'http://127.0.0.1:54321', supabaseAnonKey);
        this.registerBuiltInAgents();
        log.info(`Agent Registry initialized with ${this.agentDefinitions.size} agent definitions`, LogContext.AGENT);
    }
    registerBuiltInAgents() {
        this.registerAgent({
            name: 'planner',
            category: AgentCategory.CORE,
            description: 'Strategic task planning and decomposition with memory integration',
            priority: 1,
            className: 'PlannerAgent',
            modulePath: './cognitive/planner-agent',
            dependencies: [],
            capabilities: ['planning', 'task_decomposition', 'strategy'],
            memoryEnabled: true,
            maxLatencyMs: 10000,
            retryAttempts: 3,
        });
        this.registerAgent({
            name: 'synthesizer',
            category: AgentCategory.COGNITIVE,
            description: 'Advanced information synthesis and consensus building',
            priority: 2,
            className: 'SynthesizerAgent',
            modulePath: './cognitive/synthesizer-agent',
            dependencies: ['planner'],
            capabilities: ['synthesis', 'consensus', 'analysis'],
            memoryEnabled: true,
            maxLatencyMs: 8000,
            retryAttempts: 2,
        });
        this.registerAgent({
            name: 'retriever',
            category: AgentCategory.COGNITIVE,
            description: 'Intelligent information retrieval and context gathering',
            priority: 2,
            className: 'RetrieverAgent',
            modulePath: './cognitive/retriever-agent',
            dependencies: [],
            capabilities: ['information_retrieval', 'context_gathering', 'search'],
            memoryEnabled: true,
            maxLatencyMs: 5000,
            retryAttempts: 2,
        });
        this.registerAgent({
            name: 'personal_assistant',
            category: AgentCategory.PERSONAL,
            description: 'High-level personal AI assistant with vector memory',
            priority: 1,
            className: 'PersonalAssistantAgent',
            modulePath: './personal/personal-assistant-agent',
            dependencies: ['planner', 'retriever'],
            capabilities: ['assistance', 'coordination', 'task_management'],
            memoryEnabled: true,
            maxLatencyMs: 8000,
            retryAttempts: 2,
        });
        this.registerAgent({
            name: 'code_assistant',
            category: AgentCategory.SPECIALIZED,
            description: 'Advanced code generation, analysis, and refactoring',
            priority: 3,
            className: 'CodeAssistantAgent',
            modulePath: './specialized/code-assistant-agent',
            dependencies: ['planner'],
            capabilities: ['code_generation', 'code_analysis', 'refactoring'],
            memoryEnabled: true,
            maxLatencyMs: 15000,
            retryAttempts: 2,
        });
        log.info(`Registered ${this.agentDefinitions.size} built-in agents`, LogContext.AGENT);
    }
    registerAgent(definition) {
        this.agentDefinitions.set(definition.name, definition);
        this.emit('agent_registered', { agentName: definition.name, definition });
    }
    createEnhancedAgent(agentName, config) {
        switch (agentName) {
            case 'planner':
                return new EnhancedPlannerAgent(config);
            case 'retriever':
                return new EnhancedRetrieverAgent(config);
            case 'synthesizer':
                return new EnhancedSynthesizerAgent(config);
            case 'personal_assistant':
                return new EnhancedPersonalAssistantAgent(config);
            case 'code_assistant':
                return new EnhancedCodeAssistantAgent(config);
            default:
                return null;
        }
    }
    async getAgent(agentName) {
        if (this.loadedAgents.has(agentName)) {
            this.agentUsage.set(agentName, new Date());
            return this.loadedAgents.get(agentName);
        }
        if (this.loadingLocks.has(agentName)) {
            return this.loadingLocks.get(agentName);
        }
        const loadingPromise = this.loadAgent(agentName);
        this.loadingLocks.set(agentName, loadingPromise);
        try {
            const agent = await loadingPromise;
            if (agent) {
                this.loadedAgents.set(agentName, agent);
                this.agentUsage.set(agentName, new Date());
                log.info(`Lazy-loaded agent: ${agentName}`, LogContext.AGENT);
                this.emit('agent_loaded', { agentName, agent });
            }
            return agent;
        }
        finally {
            this.loadingLocks.delete(agentName);
        }
    }
    async loadAgent(agentName) {
        try {
            const definition = this.agentDefinitions.get(agentName);
            if (!definition) {
                log.warn(`Agent definition not found: ${agentName}`, LogContext.AGENT);
                return null;
            }
            for (const depName of definition.dependencies) {
                if (!this.loadedAgents.has(depName)) {
                    const depAgent = await this.getAgent(depName);
                    if (!depAgent) {
                        log.warn(`Failed to load dependency '${depName}' for '${agentName}'`, LogContext.AGENT);
                    }
                }
            }
            const config = {
                name: definition.name,
                description: definition.description,
                priority: definition.priority,
                capabilities: definition.capabilities.map((cap) => ({
                    name: cap,
                    description: `${cap} capability`,
                    inputSchema: {},
                    outputSchema: {},
                })),
                maxLatencyMs: definition.maxLatencyMs,
                retryAttempts: definition.retryAttempts,
                dependencies: definition.dependencies,
                memoryEnabled: definition.memoryEnabled,
                toolExecutionEnabled: true,
                allowedTools: [],
            };
            const agent = this.createEnhancedAgent(definition.name, config);
            if (agent) {
                await agent.initialize();
                return agent;
            }
            log.error(`No enhanced agent available for ${agentName}`, LogContext.AGENT);
            return null;
        }
        catch (error) {
            log.error(`Failed to load agent: ${agentName}`, LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    getAvailableAgents() {
        return Array.from(this.agentDefinitions.values());
    }
    getLoadedAgents() {
        return Array.from(this.loadedAgents.keys());
    }
    getCoreAgents() {
        return Array.from(this.agentDefinitions.values())
            .filter((def) => def.category === AgentCategory.CORE)
            .map((def) => def.name);
    }
    async processRequest(agentName, context) {
        const agent = await this.getAgent(agentName);
        if (!agent) {
            throw new Error(`Agent ${agentName} not found or failed to load`);
        }
        if (!a2aMesh.getAgentConnections().find((conn) => conn.agentName === agentName)) {
            const definition = this.agentDefinitions.get(agentName);
            const capabilities = definition?.capabilities || [];
            a2aMesh.registerAgent(agentName, capabilities);
        }
        this.agentUsage.set(agentName, new Date());
        const enhanced = agent;
        if (typeof enhanced.executeWithFeedback === 'function') {
            try {
                const { response, feedback } = await enhanced.executeWithFeedback(context);
                this.emit('agent_feedback', { agentName, feedback });
                return response;
            }
            catch {
                return await agent.execute(context);
            }
        }
        return await agent.execute(context);
    }
    async processParallelRequests(agentRequests) {
        log.info(`Processing ${agentRequests.length} parallel agent requests`, LogContext.AGENT);
        const promises = agentRequests.map(async ({ agentName, context }) => {
            try {
                const result = await this.processRequest(agentName, context);
                return { agentName, result };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                log.error(`Parallel agent execution failed: ${agentName}`, LogContext.AGENT, {
                    error: errorMessage,
                });
                return { agentName, result: null, error: errorMessage };
            }
        });
        const results = await Promise.all(promises);
        log.info(`Completed ${agentRequests.length} parallel agent requests`, LogContext.AGENT, {
            successful: results.filter((r) => !r.error).length,
            failed: results.filter((r) => r.error).length,
        });
        return results;
    }
    async createTaskRecord(taskId, primaryAgent, supportingAgents, context) {
        try {
            const { error } = await this.supabase.from('tasks').insert({
                id: taskId,
                agent_name: primaryAgent,
                supporting_agents: supportingAgents,
                user_request: context.userRequest || 'No request specified',
                context,
                status: 'running',
                priority: 'medium',
                created_at: new Date().toISOString(),
                started_at: new Date().toISOString(),
            });
            if (error) {
                log.warn('Failed to create task record in Supabase', LogContext.AGENT, {
                    error: error.message,
                    taskId,
                });
            }
            else {
                log.info('✅ Task record created in Supabase', LogContext.AGENT, { taskId, primaryAgent });
            }
        }
        catch (error) {
            log.error('Error creating task record', LogContext.AGENT, { error, taskId });
        }
    }
    async updateTaskRecord(taskId, results, status) {
        try {
            const { error } = await this.supabase
                .from('tasks')
                .update({
                status,
                result: results,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', taskId);
            if (error) {
                log.warn('Failed to update task record in Supabase', LogContext.AGENT, {
                    error: error.message,
                    taskId,
                });
            }
            else {
                log.info('✅ Task record updated in Supabase', LogContext.AGENT, { taskId, status });
            }
        }
        catch (error) {
            log.error('Error updating task record', LogContext.AGENT, { error, taskId });
        }
    }
    async orchestrateAgents(primaryAgent, supportingAgents, context) {
        log.info(`Orchestrating agents: primary=${primaryAgent}, supporting=[${supportingAgents.join(', ')}]`, LogContext.AGENT);
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await this.createTaskRecord(taskId, primaryAgent, supportingAgents, context);
        let dspyOptimization = null;
        try {
            const { dspyService } = await import('../services/dspy-service');
            if (dspyService.isReady()) {
                const userRequest = context?.userRequest || 'Agent orchestration task';
                dspyOptimization = await dspyService.orchestrate({
                    userRequest,
                    userId: context?.userId || 'system',
                    context: {
                        primaryAgent,
                        supportingAgents,
                        taskId,
                    }
                });
                log.info('✅ DSPy optimization applied to agent orchestration', LogContext.AGENT);
            }
        }
        catch (error) {
            log.debug('DSPy optimization not available for orchestration', LogContext.AGENT);
        }
        const [primaryResult, supportingResults] = await Promise.all([
            this.processRequest(primaryAgent, context).catch((error) => ({ error: error.message })),
            this.processParallelRequests(supportingAgents.map((name) => ({ agentName: name, context }))),
        ]);
        let synthesis;
        if (this.agentDefinitions.has('synthesizer')) {
            try {
                const synthesisContext = {
                    ...context,
                    userRequest: `Synthesize results from ${primaryAgent} and supporting agents`,
                    primaryResult,
                    supportingResults: supportingResults.filter((r) => !r.error).map((r) => r.result),
                };
                synthesis = await this.processRequest('synthesizer', synthesisContext);
            }
            catch (error) {
                log.warn('Failed to synthesize orchestrated results', LogContext.AGENT, {
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        const results = {
            primary: primaryResult,
            supporting: supportingResults,
            synthesis,
            optimization: dspyOptimization,
        };
        const hasErrors = primaryResult?.error || supportingResults.some((r) => r.error);
        await this.updateTaskRecord(taskId, results, hasErrors ? 'failed' : 'completed');
        return results;
    }
    async requestCollaboration(task, requiredCapabilities, teamSize = 3, initiator = 'system') {
        log.info(`🤝 Requesting agent collaboration for: ${task}`, LogContext.AGENT, {
            capabilities: requiredCapabilities,
            teamSize,
        });
        const team = a2aMesh.findAgentTeam(requiredCapabilities, teamSize);
        if (team.length === 0) {
            throw new Error('No agents available for collaboration');
        }
        for (const agentName of team) {
            await this.getAgent(agentName);
        }
        const sessionId = await a2aMesh.requestCollaboration({
            initiator,
            participants: team,
            task,
            context: { requiredCapabilities },
            expectedDuration: 30000,
            priority: 'high',
        });
        log.info(`✅ Collaboration session started: ${sessionId}`, LogContext.AGENT, {
            team: team.join(', '),
        });
        return sessionId;
    }
    async shareKnowledge(fromAgent, knowledgeType, data, relevantCapabilities, confidence = 0.8) {
        log.info(`🧠 Sharing knowledge from ${fromAgent}`, LogContext.AGENT, {
            type: knowledgeType,
            confidence,
        });
        await a2aMesh.shareKnowledge(fromAgent, {
            type: knowledgeType,
            data,
            relevantTo: relevantCapabilities,
            confidence,
        });
    }
    findOptimalAgent(requiredCapabilities) {
        return a2aMesh.findOptimalAgent(requiredCapabilities);
    }
    getMeshStatus() {
        return a2aMesh.getMeshStatus();
    }
    async unloadIdleAgents(maxIdleMinutes = 30) {
        const now = new Date();
        const toUnload = [];
        for (const [agentName, lastUsed] of this.agentUsage.entries()) {
            const idleTimeMs = now.getTime() - lastUsed.getTime();
            const idleMinutes = idleTimeMs / (1000 * 60);
            const definition = this.agentDefinitions.get(agentName);
            if (definition &&
                definition.category !== AgentCategory.CORE &&
                idleMinutes > maxIdleMinutes) {
                toUnload.push(agentName);
            }
        }
        for (const agentName of toUnload) {
            const agent = this.loadedAgents.get(agentName);
            if (agent) {
                await agent.shutdown();
                this.loadedAgents.delete(agentName);
                this.agentUsage.delete(agentName);
                log.info(`Unloaded idle agent: ${agentName}`, LogContext.AGENT);
                this.emit('agent_unloaded', { agentName });
            }
        }
    }
    async shutdown() {
        log.info('Shutting down Agent Registry...', LogContext.AGENT);
        const shutdownPromises = Array.from(this.loadedAgents.values()).map((agent) => agent
            .shutdown()
            .catch((error) => log.error('Error shutting down agent', LogContext.AGENT, { error })));
        await Promise.all(shutdownPromises);
        this.loadedAgents.clear();
        this.agentUsage.clear();
        this.loadingLocks.clear();
        log.info('Agent Registry shutdown completed', LogContext.AGENT);
    }
}
export default AgentRegistry;
//# sourceMappingURL=agent-registry.js.map