/**
 * Claude Flow Integration Service
 * Integrates claude-flow hive-mind intelligence and swarm coordination
 * with Universal AI Tools' existing architecture
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import path from 'path';
import { LogContext, log } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { AgentRegistry } from '../agents/agent-registry';
import { ABMCTSOrchestrator } from './ab-mcts-orchestrator';
import { IntelligentParameterService } from './intelligent-parameter-service';

interface SwarmAgent {
  id: string;
  type: string;
  role: 'queen' | 'worker' | 'coordinator';
  status: 'idle' | 'active' | 'processing' | 'error';
  capabilities: string[];
  currentTask?: string;
  performance?: {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
  };
}

interface HiveMindState {
  active: boolean;
  topology: 'hierarchical' | 'mesh' | 'adaptive' | 'collective';
  agents: Map<string, SwarmAgent>;
  memory: Map<string, any>;
  consensusRequired: boolean;
  votingThreshold: number;
}

interface ClaudeFlowConfig {
  enableHiveMind: boolean;
  enableNeuralPatterns: boolean;
  mcpToolsCount: number;
  swarmSize: number;
  memoryPersistence: boolean;
  githubIntegration: boolean;
  performanceMode: 'speed' | 'quality' | 'balanced';
}

export class ClaudeFlowIntegrationService extends EventEmitter {
  private static instance: ClaudeFlowIntegrationService;
  private claudeFlowProcess: ChildProcess | null = null;
  private hiveMindState: HiveMindState;
  private config: ClaudeFlowConfig;
  private supabase: any;
  private agentRegistry: AgentRegistry;
  private abMctsOrchestrator: ABMCTSOrchestrator;
  private parameterService: IntelligentParameterService;
  private isInitialized = false;

  private constructor() {
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

    // Initialize Supabase for memory persistence
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Connect with existing services
    this.agentRegistry = new AgentRegistry();
    this.abMctsOrchestrator = new ABMCTSOrchestrator();
    this.parameterService = new IntelligentParameterService();
  }

  static getInstance(): ClaudeFlowIntegrationService {
    if (!ClaudeFlowIntegrationService.instance) {
      ClaudeFlowIntegrationService.instance = new ClaudeFlowIntegrationService();
    }
    return ClaudeFlowIntegrationService.instance;
  }

  /**
   * Initialize Claude Flow integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      log.info('Claude Flow integration already initialized', LogContext.SYSTEM);
      return;
    }

    try {
      log.info('🌊 Initializing Claude Flow integration', LogContext.SYSTEM);

      // Initialize Claude Flow via CLI
      await this.initializeClaudeFlow();

      // Set up hive-mind coordination
      await this.setupHiveMind();

      // Connect memory systems
      await this.connectMemorySystems();

      // Integrate with AB-MCTS orchestration
      await this.integrateWithABMCTS();

      // Set up MCP tools
      await this.setupMCPTools();

      this.isInitialized = true;
      log.info('✅ Claude Flow integration initialized successfully', LogContext.SYSTEM, {
        hiveMindActive: this.hiveMindState.active,
        agentCount: this.hiveMindState.agents.size,
        mcpToolsAvailable: this.config.mcpToolsCount
      });
    } catch (error) {
      log.error('Failed to initialize Claude Flow integration', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Initialize Claude Flow CLI
   */
  private async initializeClaudeFlow(): Promise<void> {
    return new Promise((resolve, reject) => {
      const claudeFlowPath = path.join(__dirname, '../../claude-flow');
      
      // Check if claude-flow is available
      const checkProcess = spawn('npx', ['claude-flow@alpha', '--version'], {
        cwd: claudeFlowPath,
        shell: true
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          log.info('Claude Flow CLI available', LogContext.SYSTEM);
          resolve();
        } else {
          // Try to install if not available
          const installProcess = spawn('npm', ['install', '-g', 'claude-flow@alpha'], {
            shell: true
          });

          installProcess.on('close', (installCode) => {
            if (installCode === 0) {
              log.info('Claude Flow installed successfully', LogContext.SYSTEM);
              resolve();
            } else {
              reject(new Error('Failed to install Claude Flow'));
            }
          });
        }
      });
    });
  }

  /**
   * Set up hive-mind coordination
   */
  private async setupHiveMind(): Promise<void> {
    // Create queen agent
    const queenAgent: SwarmAgent = {
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

    // Create specialized worker agents
    const workerTypes = [
      { type: 'coder', capabilities: ['implementation', 'debugging', 'refactoring'] },
      { type: 'reviewer', capabilities: ['code-review', 'quality-assurance', 'best-practices'] },
      { type: 'tester', capabilities: ['unit-testing', 'integration-testing', 'performance-testing'] },
      { type: 'researcher', capabilities: ['information-gathering', 'analysis', 'documentation'] },
      { type: 'architect', capabilities: ['system-design', 'architecture', 'scalability'] }
    ];

    for (let i = 0; i < workerTypes.length; i++) {
      const worker = workerTypes[i];
      if (!worker) continue; // Add undefined check
      
      const workerAgent: SwarmAgent = {
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

    // Store hive-mind agents info (registration would need to be done externally)
    // as registerAgent is private. We'll just track them internally for now.
    for (const [id, agent] of this.hiveMindState.agents) {
      // Store agent definition for later use
      const agentDef = {
        name: `claude-flow-${agent.type}`,
        description: `Claude Flow ${agent.role} agent with ${agent.capabilities.join(', ')} capabilities`,
        capabilities: agent.capabilities,
        systemPrompt: `You are a ${agent.role} agent in the Claude Flow hive-mind system.`
      };
      // Track internally - actual registration would happen during server initialization
      this.hiveMindState.memory.set(`agent-def-${id}`, agentDef);
    }

    this.hiveMindState.active = true;
    log.info('🐝 Hive-mind coordination established', LogContext.SYSTEM, {
      topology: this.hiveMindState.topology,
      agentCount: this.hiveMindState.agents.size
    });
  }

  /**
   * Connect memory systems between Claude Flow and Supabase
   */
  private async connectMemorySystems(): Promise<void> {
    if (!this.supabase) {
      log.warn('Supabase not configured, using local memory only', LogContext.SYSTEM);
      return;
    }

    try {
      // Create claude_flow_memory table if it doesn't exist
      const { error: createError } = await this.supabase.rpc('create_claude_flow_memory_table', {});
      
      if (createError && !createError.message.includes('already exists')) {
        log.error('Failed to create claude_flow_memory table', LogContext.DATABASE, {
          error: createError.message
        });
      }

      // Load existing memories
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
    } catch (error) {
      log.error('Failed to connect memory systems', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Integrate with AB-MCTS orchestration
   */
  private async integrateWithABMCTS(): Promise<void> {
    // Store integration info for AB-MCTS coordination
    // AB-MCTS doesn't have event emitter methods, so we'll handle coordination differently
    
    // Set up internal task distribution handler
    this.on('mcts-task', async (task) => {
      // Distribute tasks to swarm agents based on capabilities
      const bestAgent = await this.selectBestAgent(task);
      if (bestAgent) {
        await this.assignTaskToAgent(bestAgent.id, task);
      }
    });

    // Share performance metrics internally
    this.on('task-completed', (result) => {
      // Store metrics for later retrieval by AB-MCTS
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

  /**
   * Set up MCP tools integration
   */
  private async setupMCPTools(): Promise<void> {
    // Start MCP server
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

  /**
   * Execute a swarm task
   */
  async executeSwarmTask(task: string, options?: {
    urgency?: 'low' | 'medium' | 'high';
    consensusRequired?: boolean;
    maxAgents?: number;
  }): Promise<any> {
    log.info('🐝 Executing swarm task', LogContext.SYSTEM, { task, options });

    // Use intelligent parameters for optimization
    const parameters = await this.parameterService.getTaskParameters({
      type: 'swarm-coordination' as any, // TaskType enum value
      userInput: task,
      additionalContext: { urgency: options?.urgency }
    });

    // Execute via Claude Flow CLI
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
          // Store result in memory
          this.storeInMemory(task, output);
          resolve({ success: true, output });
        } else {
          reject(new Error(`Swarm task failed: ${errorOutput}`));
        }
      });
    });
  }

  /**
   * Select best agent for a task
   */
  private async selectBestAgent(task: any): Promise<SwarmAgent | null> {
    let bestAgent: SwarmAgent | null = null;
    let bestScore = 0;

    for (const [id, agent] of this.hiveMindState.agents) {
      if (agent.status !== 'idle') continue;

      // Calculate capability match score
      const score = this.calculateCapabilityScore(agent, task);
      
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * Calculate capability score for agent-task matching
   */
  private calculateCapabilityScore(agent: SwarmAgent, task: any): number {
    let score = 0;
    const taskKeywords = task.description?.toLowerCase().split(' ') || [];

    for (const capability of agent.capabilities) {
      for (const keyword of taskKeywords) {
        if (capability.includes(keyword) || keyword.includes(capability)) {
          score += 1;
        }
      }
    }

    // Factor in agent performance
    if (agent.performance) {
      score *= agent.performance.successRate;
    }

    return score;
  }

  /**
   * Assign task to specific agent
   */
  private async assignTaskToAgent(agentId: string, task: any): Promise<void> {
    const agent = this.hiveMindState.agents.get(agentId);
    if (!agent) return;

    agent.status = 'processing';
    agent.currentTask = task.id;

    log.info('📋 Task assigned to agent', LogContext.SYSTEM, {
      agentId,
      agentType: agent.type,
      taskId: task.id
    });

    // Emit event for monitoring
    this.emit('task-assigned', { agentId, task });
  }

  /**
   * Store result in memory
   */
  private async storeInMemory(task: string, result: any): Promise<void> {
    const memoryEntry = {
      id: `memory-${Date.now()}`,
      task,
      result,
      timestamp: new Date().toISOString(),
      agentIds: Array.from(this.hiveMindState.agents.keys())
    };

    this.hiveMindState.memory.set(memoryEntry.id, memoryEntry);

    // Persist to Supabase
    if (this.supabase) {
      try {
        await this.supabase.from('ai_memories').insert({
          agent_id: 'claude-flow',
          content: JSON.stringify({ task, result }),
          context: { type: 'swarm-task' },
          metadata: memoryEntry,
          importance: 0.8
        });
      } catch (error) {
        log.error('Failed to persist memory to Supabase', LogContext.DATABASE, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Get hive-mind status
   */
  getHiveMindStatus(): {
    active: boolean;
    topology: string;
    agentCount: number;
    activeAgents: number;
    memorySize: number;
  } {
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

  /**
   * Spawn new agent dynamically
   */
  async spawnAgent(type: string, capabilities: string[]): Promise<SwarmAgent> {
    const agentId = `dynamic-${Date.now()}`;
    const newAgent: SwarmAgent = {
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

  /**
   * Execute consensus decision
   */
  async executeConsensusDecision(question: string, options: string[]): Promise<string> {
    const votes = new Map<string, number>();
    
    // Initialize vote counts
    for (const option of options) {
      votes.set(option, 0);
    }

    // Collect votes from all active agents
    const votingAgents = Array.from(this.hiveMindState.agents.values())
      .filter(agent => agent.status !== 'error');

    for (const agent of votingAgents) {
      // Simulate agent voting (in real implementation, would call agent)
      const vote = options[Math.floor(Math.random() * options.length)];
      if (vote) {
        const currentVotes = votes.get(vote);
        if (currentVotes !== undefined) {
          votes.set(vote, currentVotes + 1);
        }
      }
    }

    // Find option with most votes
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

    return bestOption!; // bestOption is guaranteed to be a string from initialization at line 572
  }

  /**
   * Shutdown Claude Flow integration
   */
  async shutdown(): Promise<void> {
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

// Export singleton instance
export default ClaudeFlowIntegrationService.getInstance();