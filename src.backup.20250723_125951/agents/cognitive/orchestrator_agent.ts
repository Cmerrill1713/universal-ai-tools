/**
 * Orchestrator Agent - Central coordination and decision making
 * Bridges the cognitive agent system with the enhanced orchestrator
 */

import type { AgentContext } from '../base_agent';
import { type CognitiveCapability, RealCognitiveAgent } from './real_cognitive_agent';
import {
  EnhancedOrchestrator,
  type EnhancedOrchestratorConfig,
  type EnhancedRequest,
} from '../enhanced_orchestrator';
import type { SupabaseClient } from '@supabase/supabase-js';

interface OrchestrationResult {
  id: string;
  task: string;
  approach: string;
  agentsInvolved: string[];
  executionPlan: {
    step: number;
    agent: string;
    action: string;
    dependencies: number[];
  }[];
  consensus: {
    reached: boolean;
    confidence: number;
    dissent: string[];
  };
  estimatedTime: number;
  resourceRequirements: any;
}

export class OrchestratorAgent extends RealCognitiveAgent {
  private enhancedOrchestrator?: EnhancedOrchestrator;

  constructor(config): any {
    super({
      ...config,
      name: 'orchestrator',
      description: 'Central coordination and decision making across all agents',
    });
    this.preferredModel = 'llama3.2:3b'; // Use smaller model for faster coordination
  }

  protected async onInitialize())): Promise<void> {
    await super.onInitialize();

    // Initialize enhanced orchestrator if we have supabase
    if (this.memoryCoordinator?.supabase) {
      // EnhancedOrchestrator expects a config object, not just SupabaseClient
      const config: EnhancedOrchestratorConfig = {
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
        enableCognitiveOrchestration: true,
        enableAdaptiveTools: true,
        enableCaching: true,
        targetLatencyMs: 5000,
      };
      this.enhancedOrchestrator = new EnhancedOrchestrator(config);
      await this.enhancedOrchestrator.initialize();
      this.logger.info('🎭 Enhanced orchestrator initialized for cognitive orchestrator');
    }
  }

  protected setupCognitiveCapabilities()): void {
    // Coordination capability
    this.cognitiveCapabilities.set('coordinate', {
      name: 'coordinate',
      execute: async (_input: any, _context: AgentContext => {
        return this.coordinateAgents(_input, _context;
      },
    });

    // Decision making capability
    this.cognitiveCapabilities.set('decide', {
      name: 'decide',
      execute: async (_input: any, _context: AgentContext => {
        return this.makeDecision(_input, _context;
      },
    });

    // Consensus building capability
    this.cognitiveCapabilities.set('consensus', {
      name: 'consensus',
      execute: async (_input: any, _context: AgentContext => {
        return this.buildConsensus(_input, _context;
      },
    });
  }

  protected async selectCapability(context: AgentContext: Promise<CognitiveCapability | null> {
    const request = _context.userRequest.toLowerCase();

    if (request.includes('coordinate') || request.includes('orchestrate')) {
      return this.cognitiveCapabilities.get('coordinate') || null;
    } else if (request.includes('decide') || request.includes('decision')) {
      return this.cognitiveCapabilities.get('decide') || null;
    } else if (request.includes('consensus') || request.includes('agree')) {
      return this.cognitiveCapabilities.get('consensus') || null;
    }

    // Default to coordination
    return this.cognitiveCapabilities.get('coordinate') || null;
  }

  protected async generateReasoning(
    _context: AgentContext,
    capability: CognitiveCapability,
    result: any
  ): Promise<string> {
    const prompt = `As the orchestrator agent, explain the coordination approach for:;`

Request: "${_context.userRequest}"
Capability used: ${capability.name}
Agents involved: ${result.agentsInvolved?.join(', ') || 'None'}
Execution steps: ${result.executionPlan?.length || 0}

Provide a clear explanation of:
1. Why this coordination approach was chosen
2. How the agents will work together
3. Expected outcomes and timeline
4. Any potential coordination challenges`;

    return this.generateOllamaResponse(prompt, _context;
  }

  private async coordinateAgents(_input: any, _context: AgentContext: Promise<OrchestrationResult> {
    // Use enhanced orchestrator if available
    if (this.enhancedOrchestrator) {
      try {
        const enhancedRequest: EnhancedRequest = {
          requestId: `req-${Date.now()}`,
          userRequest: _context.userRequest,
          userId: _context.userId || 'anonymous',
          context: _context.previousContext,
          orchestrationMode: 'cognitive',
          timestamp: new Date(),
        };

        const result = await this.enhancedOrchestrator.processRequest(enhancedRequest);

        return this.formatOrchestrationResult(result);
      } catch (error) {
        this.logger.warn('Enhanced orchestration failed, using fallback', error);
      }
    }

    // Fallback coordination logic
    return this.performFallbackCoordination(_input, _context;
  }

  private async makeDecision(_input: any, _context: AgentContext): Promise<unknown> {
    const prompt = `As the orchestrator, make a decision about:;`

Request: "${_context.userRequest}"
Context: ${JSON.stringify(_context.previousContext || {})}

Consider:
1. Available agents and their capabilities
2. Resource constraints
3. Task complexity and dependencies
4. Optimal execution order

Provide a structured decision including:
- Chosen approach
- Rationale
- Risk assessment
- Success criteria`;

    const response = await this.generateOllamaResponse(prompt, _context;

    return {
      decision: response,
      timestamp: new Date(),
      confidence: 0.8,
    };
  }

  private async buildConsensus(_input: any, _context: AgentContext): Promise<unknown> {
    // In a real implementation, this would gather opinions from multiple agents
    const mockOpinions = [
      { agent: 'planner', opinion: 'Feasible with proper decomposition', confidence: 0.9 },
      { agent: 'ethics', opinion: 'No safety concerns identified', confidence: 0.95 },
      { agent: 'resource_manager', opinion: 'Resources available', confidence: 0.85 },
    ];

    const consensus = {
      reached: true,
      confidence: 0.9,
      opinions: mockOpinions,
      summary: 'All agents agree on the proposed approach',
      dissent: [],
    };

    return consensus;
  }

  private formatOrchestrationResult(enhancedResult: any: OrchestrationResult {
    return {
      id: enhancedResult.requestId || `orch-${Date.now()}`,
      task: enhancedResult.data?.task || 'Unknown task',
      approach: enhancedResult.orchestrationMode || 'Standard coordination',
      agentsInvolved: enhancedResult.participatingAgents || ['planner', 'executor'],
      executionPlan: enhancedResult.data?.executionPlan || [
        {
          step: 1,
          agent: 'planner',
          action: 'Analyze and decompose task',
          dependencies: [],
        },
        {
          step: 2,
          agent: 'executor',
          action: 'Execute planned steps',
          dependencies: [1],
        },
      ],
      consensus: {
        reached: true,
        confidence: 0.85,
        dissent: [],
      },
      estimatedTime: enhancedResult.estimatedTime || 5000,
      resourceRequirements: enhancedResult.resourceRequirements || {},
    };
  }

  private async performFallbackCoordination(
    input: any,
    _context: AgentContext
  ): Promise<OrchestrationResult> {
    // Simple fallback coordination logic
    const task = _context.userRequest;
    const complexity = this.assessComplexity(task);

    let agentsInvolved: string[];
    let executionPlan: any[];

    if (complexity === 'simple') {
      agentsInvolved = ['planner', 'executor'];
      executionPlan = [
        { step: 1, agent: 'planner', action: 'Create simple plan', dependencies: [] },
        { step: 2, agent: 'executor', action: 'Execute plan', dependencies: [1] },
      ];
    } else if (complexity === 'moderate') {
      agentsInvolved = ['user_intent', 'planner', 'retriever', 'synthesizer'];
      executionPlan = [
        { step: 1, agent: 'user_intent', action: 'Analyze user goals', dependencies: [] },
        { step: 2, agent: 'retriever', action: 'Gather relevant information', dependencies: [1] },
        { step: 3, agent: 'planner', action: 'Create detailed plan', dependencies: [1, 2] },
        { step: 4, agent: 'synthesizer', action: 'Combine and execute', dependencies: [3] },
      ];
    } else {
      agentsInvolved = [
        'user_intent',
        'planner',
        'retriever',
        'devils_advocate',
        'synthesizer',
        'reflector',
      ];
      executionPlan = [
        {
          step: 1,
          agent: 'user_intent',
          action: 'Deep analysis of requirements',
          dependencies: [],
        },
        {
          step: 2,
          agent: 'retriever',
          action: 'Comprehensive information gathering',
          dependencies: [1],
        },
        { step: 3, agent: 'planner', action: 'Create multi-phase plan', dependencies: [1, 2] },
        { step: 4, agent: 'devils_advocate', action: 'Risk assessment', dependencies: [3] },
        { step: 5, agent: 'synthesizer', action: 'Integrate and execute', dependencies: [3, 4] },
        { step: 6, agent: 'reflector', action: 'Monitor and optimize', dependencies: [5] },
      ];
    }

    return {
      id: `orch-${Date.now()}`,
      task,
      approach: `${complexity} task coordination`,
      agentsInvolved,
      executionPlan,
      consensus: {
        reached: true,
        confidence: 0.75,
        dissent: [],
      },
      estimatedTime: complexity === 'simple' ? 1000 : complexity === 'moderate' ? 5000 : 10000,
      resourceRequirements: {
        memory: complexity === 'simple' ? 'low' : complexity === 'moderate' ? 'medium' : 'high',
        compute: complexity === 'simple' ? 'low' : complexity === 'moderate' ? 'medium' : 'high',
      },
    };
  }

  private assessComplexity(task: string: 'simple' | 'moderate' | 'complex' {
    const words = task.split(' ').length;
    const hasMultipleParts =;
      task.includes(' and ') || task.includes(' then ') || task.includes(' also ');

    if (words < 10 && !hasMultipleParts) {
      return 'simple';
    } else if (words < 25) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  protected async onShutdown())): Promise<void> {
    if (this.enhancedOrchestrator) {
      await this.enhancedOrchestrator.shutdown();
    }
    await super.onShutdown();
  }
}

export default OrchestratorAgent;
