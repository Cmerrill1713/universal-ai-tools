import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { AgentRegistry } from '../agents/agent-registry';
import { log, LogContext } from '../utils/logger';
import { ABMCTSOrchestrator } from './ab-mcts-orchestrator';
import { IntelligentParameterService } from './intelligent-parameter-service';
export class ClaudeFlowIntegrationService extends EventEmitter {
    static instance;
    claudeFlowProcess = null;
    hiveMindState;
    config;
    supabase;
    agentRegistry;
    abMctsOrchestrator;
    parameterService;
    isInitialized = false;
    constructor() {
        super();
        this.config = {
            enableHiveMind: true,
            enableNeuralPatterns: true,
            mcpToolsCount: 87,
            swarmSize: 8,
            memoryPersistence: true,
            githubIntegration: true,
            performanceMode: 'balanced'
        };
        this.hiveMindState = {
            active: false,
            topology: 'adaptive',
            agents: new Map(),
            memory: new Map(),
            consensusRequired: true,
            votingThreshold: 0.7
        };
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        }
        this.agentRegistry = new AgentRegistry();
        this.abMctsOrchestrator = new ABMCTSOrchestrator();
        this.parameterService = new IntelligentParameterService();
    }
    static getInstance() {
        if (!ClaudeFlowIntegrationService.instance) {
            ClaudeFlowIntegrationService.instance = new ClaudeFlowIntegrationService();
        }
        return ClaudeFlowIntegrationService.instance;
    }
    async initialize() {
        if (this.isInitialized) {
            log.info('Claude Flow integration already initialized', LogContext.SYSTEM);
            return;
        }
        try {
            log.info('🌊 Initializing Claude Flow integration', LogContext.SYSTEM);
            await this.initializeClaudeFlow();
            await this.setupHiveMind();
            await this.connectMemorySystems();
            await this.integrateWithABMCTS();
            await this.setupMCPTools();
            this.isInitialized = true;
            log.info('✅ Claude Flow integration initialized successfully', LogContext.SYSTEM, {
                hiveMindActive: this.hiveMindState.active,
                agentCount: this.hiveMindState.agents.size,
                mcpToolsAvailable: this.config.mcpToolsCount
            });
        }
        catch (error) {
            log.error('Failed to initialize Claude Flow integration', LogContext.SYSTEM, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async initializeClaudeFlow() {
        return new Promise((resolve, reject) => {
            const claudeFlowPath = path.join(__dirname, '../../claude-flow');
            const checkProcess = spawn('npx', ['claude-flow@alpha', '--version'], {
                cwd: claudeFlowPath,
                shell: true
            });
            checkProcess.on('close', (code) => {
                if (code === 0) {
                    log.info('Claude Flow CLI available', LogContext.SYSTEM);
                    resolve();
                }
                else {
                    const installProcess = spawn('npm', ['install', '-g', 'claude-flow@alpha'], {
                        shell: true
                    });
                    installProcess.on('close', (installCode) => {
                        if (installCode === 0) {
                            log.info('Claude Flow installed successfully', LogContext.SYSTEM);
                            resolve();
                        }
                        else {
                            reject(new Error('Failed to install Claude Flow'));
                        }
                    });
                }
            });
        });
    }
    async setupHiveMind() {
        const queenAgent = {
            id: 'queen-001',
            type: 'strategic-planner',
            role: 'queen',
            status: 'idle',
            capabilities: ['planning', 'coordination', 'decision-making', 'resource-allocation'],
            performance: {
                tasksCompleted: 0,
                successRate: 1.0,
                averageResponseTime: 0
            }
        };
        this.hiveMindState.agents.set(queenAgent.id, queenAgent);
        const workerTypes = [
            { type: 'coder', capabilities: ['implementation', 'debugging', 'refactoring'] },
            { type: 'reviewer', capabilities: ['code-review', 'quality-assurance', 'best-practices'] },
            { type: 'tester', capabilities: ['unit-testing', 'integration-testing', 'performance-testing'] },
            { type: 'researcher', capabilities: ['information-gathering', 'analysis', 'documentation'] },
            { type: 'architect', capabilities: ['system-design', 'architecture', 'scalability'] }
        ];
        for (let i = 0; i < workerTypes.length; i++) {
            const worker = workerTypes[i];
            if (!worker)
                continue;
            const workerAgent = {
                id: `worker-${String(i + 1).padStart(3, '0')}`,
                type: worker.type,
                role: 'worker',
                status: 'idle',
                capabilities: worker.capabilities,
                performance: {
                    tasksCompleted: 0,
                    successRate: 1.0,
                    averageResponseTime: 0
                }
            };
            this.hiveMindState.agents.set(workerAgent.id, workerAgent);
        }
        for (const [id, agent] of this.hiveMindState.agents) {
            const agentDef = {
                name: `claude-flow-${agent.type}`,
                description: `Claude Flow ${agent.role} agent with ${agent.capabilities.join(', ')} capabilities`,
                capabilities: agent.capabilities,
                systemPrompt: `You are a ${agent.role} agent in the Claude Flow hive-mind system.`
            };
            this.hiveMindState.memory.set(`agent-def-${id}`, agentDef);
        }
        this.hiveMindState.active = true;
        log.info('🐝 Hive-mind coordination established', LogContext.SYSTEM, {
            topology: this.hiveMindState.topology,
            agentCount: this.hiveMindState.agents.size
        });
    }
    async connectMemorySystems() {
        if (!this.supabase) {
            log.warn('Supabase not configured, using local memory only', LogContext.SYSTEM);
            return;
        }
        try {
            const { error: createError } = await this.supabase.rpc('create_claude_flow_memory_table', {});
            if (createError && !createError.message.includes('already exists')) {
                log.error('Failed to create claude_flow_memory table', LogContext.DATABASE, {
                    error: createError.message
                });
            }
            const { data: memories, error: fetchError } = await this.supabase
                .from('ai_memories')
                .select('*')
                .eq('agent_id', 'claude-flow')
                .order('created_at', { ascending: false })
                .limit(100);
            if (!fetchError && memories) {
                for (const memory of memories) {
                    this.hiveMindState.memory.set(memory.id, memory);
                }
                log.info('📚 Loaded Claude Flow memories from Supabase', LogContext.SYSTEM, {
                    memoryCount: memories.length
                });
            }
        }
        catch (error) {
            log.error('Failed to connect memory systems', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async integrateWithABMCTS() {
        this.on('mcts-task', async (task) => {
            const bestAgent = await this.selectBestAgent(task);
            if (bestAgent) {
                await this.assignTaskToAgent(bestAgent.id, task);
            }
        });
        this.on('task-completed', (result) => {
            const metrics = {
                agentId: result.agentId,
                taskType: result.taskType,
                success: result.success,
                executionTime: result.executionTime,
                timestamp: Date.now()
            };
            this.hiveMindState.memory.set(`metrics-${Date.now()}`, metrics);
        });
        log.info('🔄 Integrated with AB-MCTS orchestration', LogContext.SYSTEM);
    }
    async setupMCPTools() {
        const mcpProcess = spawn('npx', ['claude-flow@alpha', 'mcp', 'start'], {
            cwd: path.join(__dirname, '../../claude-flow'),
            shell: true
        });
        mcpProcess.stdout?.on('data', (data) => {
            log.info('MCP Server:', LogContext.SYSTEM, { output: data.toString() });
        });
        mcpProcess.stderr?.on('data', (data) => {
            log.error('MCP Server Error:', LogContext.SYSTEM, { error: data.toString() });
        });
        log.info('🔧 MCP tools integration started', LogContext.SYSTEM, {
            toolCount: this.config.mcpToolsCount
        });
    }
    async executeSwarmTask(task, options) {
        log.info('🐝 Executing swarm task', LogContext.SYSTEM, { task, options });
        const parameters = await this.parameterService.getTaskParameters({
            type: 'swarm-coordination',
            userInput: task,
            additionalContext: { urgency: options?.urgency }
        });
        return new Promise((resolve, reject) => {
            const args = ['swarm', task];
            if (options?.maxAgents) {
                args.push('--agents', options.maxAgents.toString());
            }
            const swarmProcess = spawn('npx', ['claude-flow@alpha', ...args], {
                cwd: path.join(__dirname, '../../claude-flow'),
                shell: true
            });
            let output = '';
            let errorOutput = '';
            swarmProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            swarmProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            swarmProcess.on('close', (code) => {
                if (code === 0) {
                    this.storeInMemory(task, output);
                    resolve({ success: true, output });
                }
                else {
                    reject(new Error(`Swarm task failed: ${errorOutput}`));
                }
            });
        });
    }
    async selectBestAgent(task) {
        let bestAgent = null;
        let bestScore = 0;
        for (const [id, agent] of this.hiveMindState.agents) {
            if (agent.status !== 'idle')
                continue;
            const score = this.calculateCapabilityScore(agent, task);
            if (score > bestScore) {
                bestScore = score;
                bestAgent = agent;
            }
        }
        return bestAgent;
    }
    calculateCapabilityScore(agent, task) {
        let score = 0;
        const taskKeywords = task.description?.toLowerCase().split(' ') || [];
        for (const capability of agent.capabilities) {
            for (const keyword of taskKeywords) {
                if (capability.includes(keyword) || keyword.includes(capability)) {
                    score += 1;
                }
            }
        }
        if (agent.performance) {
            score *= agent.performance.successRate;
        }
        return score;
    }
    async assignTaskToAgent(agentId, task) {
        const agent = this.hiveMindState.agents.get(agentId);
        if (!agent)
            return;
        agent.status = 'processing';
        agent.currentTask = task.id;
        log.info('📋 Task assigned to agent', LogContext.SYSTEM, {
            agentId,
            agentType: agent.type,
            taskId: task.id
        });
        this.emit('task-assigned', { agentId, task });
    }
    async storeInMemory(task, result) {
        const memoryEntry = {
            id: `memory-${Date.now()}`,
            task,
            result,
            timestamp: new Date().toISOString(),
            agentIds: Array.from(this.hiveMindState.agents.keys())
        };
        this.hiveMindState.memory.set(memoryEntry.id, memoryEntry);
        if (this.supabase) {
            try {
                await this.supabase.from('ai_memories').insert({
                    agent_id: 'claude-flow',
                    content: JSON.stringify({ task, result }),
                    context: { type: 'swarm-task' },
                    metadata: memoryEntry,
                    importance: 0.8
                });
            }
            catch (error) {
                log.error('Failed to persist memory to Supabase', LogContext.DATABASE, {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
    getHiveMindStatus() {
        const activeAgents = Array.from(this.hiveMindState.agents.values())
            .filter(agent => agent.status === 'active' || agent.status === 'processing').length;
        return {
            active: this.hiveMindState.active,
            topology: this.hiveMindState.topology,
            agentCount: this.hiveMindState.agents.size,
            activeAgents,
            memorySize: this.hiveMindState.memory.size
        };
    }
    async spawnAgent(type, capabilities) {
        const agentId = `dynamic-${Date.now()}`;
        const newAgent = {
            id: agentId,
            type,
            role: 'worker',
            status: 'idle',
            capabilities,
            performance: {
                tasksCompleted: 0,
                successRate: 1.0,
                averageResponseTime: 0
            }
        };
        this.hiveMindState.agents.set(agentId, newAgent);
        log.info('🆕 New agent spawned', LogContext.SYSTEM, {
            agentId,
            type,
            capabilities
        });
        return newAgent;
    }
    async executeConsensusDecision(question, options) {
        const votes = new Map();
        for (const option of options) {
            votes.set(option, 0);
        }
        const votingAgents = Array.from(this.hiveMindState.agents.values())
            .filter(agent => agent.status !== 'error');
        for (const agent of votingAgents) {
            const vote = options[Math.floor(Math.random() * options.length)];
            if (vote) {
                const currentVotes = votes.get(vote);
                if (currentVotes !== undefined) {
                    votes.set(vote, currentVotes + 1);
                }
            }
        }
        let bestOption = options[0];
        let maxVotes = 0;
        for (const [option, voteCount] of votes) {
            if (voteCount > maxVotes) {
                maxVotes = voteCount;
                bestOption = option;
            }
        }
        const consensus = maxVotes / votingAgents.length >= this.hiveMindState.votingThreshold;
        log.info('🗳️ Consensus decision made', LogContext.SYSTEM, {
            question,
            selectedOption: bestOption,
            consensus,
            votePercentage: (maxVotes / votingAgents.length * 100).toFixed(1)
        });
        return bestOption;
    }
    async shutdown() {
        log.info('Shutting down Claude Flow integration', LogContext.SYSTEM);
        if (this.claudeFlowProcess) {
            this.claudeFlowProcess.kill();
            this.claudeFlowProcess = null;
        }
        this.hiveMindState.active = false;
        this.hiveMindState.agents.clear();
        this.isInitialized = false;
        log.info('Claude Flow integration shut down', LogContext.SYSTEM);
    }
}
export default ClaudeFlowIntegrationService.getInstance();
//# sourceMappingURL=claude-flow-integration-service.js.map