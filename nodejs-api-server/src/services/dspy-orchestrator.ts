/**
 * DSPy Orchestrator Service
 * 10-agent cognitive reasoning chains with internal LLM relay
 * Implements advanced cognitive orchestration for complex reasoning tasks
 */

import { createClient } from '@supabase/supabase-js';
import { OllamaIntegrationService } from './ollama-integration';

interface DSPyAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  promptTemplate: string;
  outputFormat: string;
  dependencies: string[];
  priority: number;
}

interface DSPyReasoningChain {
  id: string;
  name: string;
  description: string;
  agents: string[];
  flow: 'sequential' | 'parallel' | 'conditional' | 'iterative';
  maxIterations: number;
  convergenceCriteria: any;
  contextSharing: boolean;
}

interface DSPyRequest {
  task: string;
  context: any;
  reasoningChain?: string;
  maxIterations?: number;
  convergenceThreshold?: number;
  enableLearning?: boolean;
  userId: string;
  sessionId: string;
  model?: string; // Optional model specification
  modelProvider?: 'ollama' | 'mlx' | 'openai' | 'anthropic'; // Model provider
}

interface DSPyResponse {
  success: boolean;
  result: any;
  reasoningChain: string;
  agentsUsed: string[];
  iterations: number;
  convergenceReached: boolean;
  confidence: number;
  processingTime: number;
  insights: {
    keyFindings: string[];
    recommendations: string[];
    risks: string[];
    opportunities: string[];
  };
  learningData?: any;
  error?: string;
}

interface AgentOutput {
  agentId: string;
  output: any;
  confidence: number;
  reasoning: string;
  metadata: any;
  timestamp: Date;
}

class DSPyOrchestrator {
  private agents: Map<string, DSPyAgent> = new Map();
  private reasoningChains: Map<string, DSPyReasoningChain> = new Map();
  private ollamaService: OllamaIntegrationService;
  private supabase: any;
  private learningData: any[] = [];

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.ollamaService = new OllamaIntegrationService();
    this.initializeAgents();
    this.initializeReasoningChains();
  }

  /**
   * Initialize the 10 specialized reasoning agents
   */
  private initializeAgents(): void {
    const agents: DSPyAgent[] = [
      {
        id: 'user_intent_analyzer',
        name: 'User Intent Analyzer',
        role: 'Analyze user intent and requirements',
        description: 'Deeply analyzes user requests to understand underlying needs, goals, and constraints',
        capabilities: ['intent_analysis', 'requirement_extraction', 'goal_identification'],
        promptTemplate: `You are a User Intent Analyzer. Analyze the following request to understand the user's true intent, underlying needs, and requirements.

Request: {task}
Context: {context}

Provide a structured analysis including:
- Primary Intent: The main goal or objective
- Underlying Needs: What the user really needs
- Requirements: Specific requirements and constraints
- Assumptions: What assumptions are being made
- Success Criteria: How to measure success

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: [],
        priority: 1
      },
      {
        id: 'devils_advocate',
        name: 'Devil\'s Advocate',
        role: 'Challenge assumptions and identify risks',
        description: 'Systematically challenges proposals, identifies potential problems, and highlights risks',
        capabilities: ['risk_analysis', 'assumption_challenging', 'critical_thinking'],
        promptTemplate: `You are a Devil's Advocate. Challenge the following proposal or analysis by identifying potential problems, risks, and alternative perspectives.

Proposal: {input}
Context: {context}

Provide a critical analysis including:
- Potential Problems: What could go wrong
- Risks: Identified risks and their likelihood
- Alternative Perspectives: Different ways to view this
- Assumptions to Question: What assumptions need validation
- Mitigation Strategies: How to address identified issues

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['user_intent_analyzer'],
        priority: 2
      },
      {
        id: 'ethics_validator',
        name: 'Ethics Validator',
        role: 'Ensure ethical considerations and compliance',
        description: 'Validates proposals against ethical frameworks and compliance requirements',
        capabilities: ['ethics_analysis', 'compliance_checking', 'bias_detection'],
        promptTemplate: `You are an Ethics Validator. Evaluate the following proposal for ethical implications, bias, and compliance issues.

Proposal: {input}
Context: {context}

Provide an ethics analysis including:
- Ethical Implications: What ethical considerations apply
- Bias Detection: Potential biases or unfairness
- Compliance Issues: Regulatory or policy concerns
- Stakeholder Impact: Who is affected and how
- Recommendations: How to address ethical concerns

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['user_intent_analyzer', 'devils_advocate'],
        priority: 3
      },
      {
        id: 'strategic_planner',
        name: 'Strategic Planner',
        role: 'Develop comprehensive strategies and plans',
        description: 'Creates detailed, actionable strategies and implementation plans',
        capabilities: ['strategic_planning', 'roadmap_creation', 'resource_planning'],
        promptTemplate: `You are a Strategic Planner. Develop a comprehensive strategy and implementation plan for the following request.

Request: {input}
Context: {context}

Create a strategic plan including:
- Strategic Objectives: Clear, measurable goals
- Implementation Phases: Step-by-step approach
- Resource Requirements: What resources are needed
- Timeline: Realistic timeline with milestones
- Success Metrics: How to measure progress
- Risk Mitigation: How to handle potential issues

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['user_intent_analyzer', 'devils_advocate', 'ethics_validator'],
        priority: 4
      },
      {
        id: 'resource_manager',
        name: 'Resource Manager',
        role: 'Optimize resource allocation and constraints',
        description: 'Manages and optimizes resource allocation, budget, and constraints',
        capabilities: ['resource_optimization', 'budget_planning', 'constraint_management'],
        promptTemplate: `You are a Resource Manager. Optimize resource allocation and manage constraints for the following plan.

Plan: {input}
Context: {context}

Provide resource optimization including:
- Resource Allocation: Optimal distribution of resources
- Budget Analysis: Cost breakdown and optimization
- Constraint Management: How to work within limits
- Efficiency Improvements: Ways to improve efficiency
- Alternative Resources: Backup or alternative options

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['strategic_planner'],
        priority: 5
      },
      {
        id: 'synthesizer',
        name: 'Synthesizer',
        role: 'Synthesize information and build consensus',
        description: 'Combines insights from multiple agents to build consensus and synthesize information',
        capabilities: ['information_synthesis', 'consensus_building', 'pattern_recognition'],
        promptTemplate: `You are a Synthesizer. Combine and synthesize insights from multiple perspectives to build consensus.

Inputs: {input}
Context: {context}

Synthesize the information including:
- Key Insights: Most important findings
- Consensus Points: Where all perspectives agree
- Divergent Views: Where perspectives differ
- Integrated Solution: Combined approach
- Confidence Level: How confident in the synthesis

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['user_intent_analyzer', 'devils_advocate', 'ethics_validator', 'strategic_planner', 'resource_manager'],
        priority: 6
      },
      {
        id: 'executor',
        name: 'Executor',
        role: 'Execute plans and manage implementation',
        description: 'Handles the actual execution of plans and manages implementation details',
        capabilities: ['plan_execution', 'implementation_management', 'progress_tracking'],
        promptTemplate: `You are an Executor. Create detailed implementation steps and execution plan for the following strategy.

Strategy: {input}
Context: {context}

Create execution plan including:
- Implementation Steps: Detailed action items
- Dependencies: What needs to happen first
- Timeline: Specific deadlines and milestones
- Responsibilities: Who does what
- Progress Tracking: How to monitor progress
- Quality Gates: Checkpoints for quality

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['synthesizer'],
        priority: 7
      },
      {
        id: 'reflector',
        name: 'Reflector',
        role: 'Reflect on outcomes and learn from experience',
        description: 'Analyzes outcomes, identifies lessons learned, and suggests improvements',
        capabilities: ['outcome_analysis', 'lesson_extraction', 'improvement_suggestions'],
        promptTemplate: `You are a Reflector. Analyze the outcomes and extract lessons learned from the following execution.

Execution Results: {input}
Context: {context}

Provide reflection including:
- Outcome Analysis: What actually happened vs. expected
- Success Factors: What contributed to success
- Failure Points: What didn't work and why
- Lessons Learned: Key insights for future
- Improvement Suggestions: How to do better next time

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['executor'],
        priority: 8
      },
      {
        id: 'validator',
        name: 'Validator',
        role: 'Validate results and ensure quality',
        description: 'Validates results against requirements and ensures quality standards',
        capabilities: ['result_validation', 'quality_assurance', 'requirement_verification'],
        promptTemplate: `You are a Validator. Validate the results against requirements and ensure quality standards.

Results: {input}
Original Requirements: {context}

Provide validation including:
- Requirement Compliance: How well results meet requirements
- Quality Assessment: Overall quality evaluation
- Gap Analysis: What's missing or needs improvement
- Validation Criteria: Standards used for validation
- Recommendations: How to improve results

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['reflector'],
        priority: 9
      },
      {
        id: 'reporter',
        name: 'Reporter',
        role: 'Generate comprehensive reports and documentation',
        description: 'Creates comprehensive reports, documentation, and summaries',
        capabilities: ['report_generation', 'documentation', 'summary_creation'],
        promptTemplate: `You are a Reporter. Generate a comprehensive report summarizing the entire process and results.

Process Summary: {input}
Context: {context}

Create a comprehensive report including:
- Executive Summary: High-level overview
- Detailed Analysis: In-depth findings
- Recommendations: Actionable next steps
- Risk Assessment: Identified risks and mitigation
- Success Metrics: How to measure success
- Next Steps: Immediate actions required

Format your response as JSON.`,
        outputFormat: 'json',
        dependencies: ['validator'],
        priority: 10
      }
    ];

    agents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
  }

  /**
   * Initialize reasoning chains
   */
  private initializeReasoningChains(): void {
    const chains: DSPyReasoningChain[] = [
      {
        id: 'comprehensive_analysis',
        name: 'Comprehensive Analysis Chain',
        description: 'Full 10-agent analysis for complex problems',
        agents: [
          'user_intent_analyzer',
          'devils_advocate',
          'ethics_validator',
          'strategic_planner',
          'resource_manager',
          'synthesizer',
          'executor',
          'reflector',
          'validator',
          'reporter'
        ],
        flow: 'sequential',
        maxIterations: 1,
        convergenceCriteria: { confidence: 0.8 },
        contextSharing: true
      },
      {
        id: 'rapid_prototyping',
        name: 'Rapid Prototyping Chain',
        description: 'Fast iteration for quick solutions',
        agents: [
          'user_intent_analyzer',
          'strategic_planner',
          'executor',
          'validator'
        ],
        flow: 'iterative',
        maxIterations: 3,
        convergenceCriteria: { confidence: 0.7 },
        contextSharing: true
      },
      {
        id: 'ethical_review',
        name: 'Ethical Review Chain',
        description: 'Focused on ethics and compliance',
        agents: [
          'user_intent_analyzer',
          'devils_advocate',
          'ethics_validator',
          'synthesizer',
          'reporter'
        ],
        flow: 'sequential',
        maxIterations: 1,
        convergenceCriteria: { confidence: 0.9 },
        contextSharing: true
      },
      {
        id: 'strategic_planning',
        name: 'Strategic Planning Chain',
        description: 'Focused on strategic planning and resource management',
        agents: [
          'user_intent_analyzer',
          'strategic_planner',
          'resource_manager',
          'synthesizer',
          'executor',
          'reporter'
        ],
        flow: 'sequential',
        maxIterations: 1,
        convergenceCriteria: { confidence: 0.8 },
        contextSharing: true
      }
    ];

    chains.forEach(chain => {
      this.reasoningChains.set(chain.id, chain);
    });
  }

  /**
   * Initialize DSPy Orchestrator
   */
  async initialize(): Promise<void> {
    try {
      console.log('🧠 Initializing DSPy Orchestrator...');
      
      // Initialize Ollama service
      await this.ollamaService.initialize();
      
      console.log(`✅ DSPy Orchestrator initialized with ${this.agents.size} agents and ${this.reasoningChains.size} reasoning chains`);
    } catch (error) {
      console.error('❌ DSPy Orchestrator initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute reasoning chain
   */
  async executeReasoningChain(request: DSPyRequest): Promise<DSPyResponse> {
    const startTime = Date.now();
    
    try {
      console.log(`🧠 Executing DSPy reasoning chain: ${request.reasoningChain || 'comprehensive_analysis'}`);

      const chainId = request.reasoningChain || 'comprehensive_analysis';
      const chain = this.reasoningChains.get(chainId);
      
      if (!chain) {
        throw new Error(`Reasoning chain not found: ${chainId}`);
      }

      const agentOutputs: AgentOutput[] = [];
      let context = { ...request.context, originalTask: request.task };
      let convergenceReached = false;
      let iterations = 0;

      // Execute agents based on chain flow
      while (iterations < chain.maxIterations && !convergenceReached) {
        console.log(`🔄 Iteration ${iterations + 1}/${chain.maxIterations}`);

        for (const agentId of chain.agents) {
          const agent = this.agents.get(agentId);
          if (!agent) {
            console.warn(`Agent not found: ${agentId}`);
            continue;
          }

          // Check dependencies
          if (!this.checkDependencies(agent, agentOutputs)) {
            console.warn(`Dependencies not met for agent: ${agentId}`);
            continue;
          }

          console.log(`🤖 Executing agent: ${agent.name}`);
          const output = await this.executeAgent(agent, context, agentOutputs, request);
          agentOutputs.push(output);

          // Update context for next agents
          if (chain.contextSharing) {
            context = { ...context, [agentId]: output.output };
          }
        }

        iterations++;

        // Check convergence
        if (this.checkConvergence(agentOutputs, chain.convergenceCriteria)) {
          convergenceReached = true;
          console.log('✅ Convergence reached');
        }
      }

      // Synthesize final result
      const finalResult = await this.synthesizeResults(agentOutputs, request);
      const processingTime = Date.now() - startTime;

      // Store learning data if enabled
      if (request.enableLearning) {
        await this.storeLearningData(request, agentOutputs, finalResult);
      }

      return {
        success: true,
        result: finalResult,
        reasoningChain: chainId,
        agentsUsed: chain.agents,
        iterations,
        convergenceReached,
        confidence: this.calculateOverallConfidence(agentOutputs),
        processingTime,
        insights: this.extractInsights(agentOutputs),
        learningData: request.enableLearning ? this.learningData.slice(-1)[0] : undefined
      };

    } catch (error) {
      console.error('Error executing reasoning chain:', error);
      return {
        success: false,
        result: null,
        reasoningChain: request.reasoningChain || 'comprehensive_analysis',
        agentsUsed: [],
        iterations: 0,
        convergenceReached: false,
        confidence: 0,
        processingTime: Date.now() - startTime,
        insights: {
          keyFindings: [],
          recommendations: [],
          risks: [],
          opportunities: []
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute individual agent
   */
  private async executeAgent(agent: DSPyAgent, context: any, previousOutputs: AgentOutput[], request: DSPyRequest): Promise<AgentOutput> {
    try {
      // Build prompt from template
      const prompt = this.buildAgentPrompt(agent, context, previousOutputs);
      
      // Get model configuration
      const modelConfig = this.getModelConfig(request);
      
      // Execute with appropriate service
      const response = await this.executeWithModel(prompt, modelConfig, request);

      // Parse output based on expected format
      let parsedOutput;
      try {
        parsedOutput = JSON.parse(response.response);
      } catch (parseError) {
        parsedOutput = { raw_output: response.response };
      }

      return {
        agentId: agent.id,
        output: parsedOutput,
        confidence: this.calculateAgentConfidence(parsedOutput),
        reasoning: this.extractReasoning(parsedOutput),
        metadata: {
          agent: agent.name,
          role: agent.role,
          capabilities: agent.capabilities
        },
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`Error executing agent ${agent.id}:`, error);
      return {
        agentId: agent.id,
        output: { error: error instanceof Error ? error.message : 'Unknown error' },
        confidence: 0,
        reasoning: 'Agent execution failed',
        metadata: {
          agent: agent.name,
          role: agent.role,
          error: true
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get model configuration based on request
   */
  private getModelConfig(request: DSPyRequest): any {
    const defaultModel = process.env.DEFAULT_LLM_MODEL || 'llama3.2:3b';
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER || 'ollama';
    
    return {
      model: request.model || defaultModel,
      provider: request.modelProvider || defaultProvider,
      temperature: 0.7,
      num_predict: 2000,
      top_p: 0.9,
      top_k: 40
    };
  }

  /**
   * Execute with appropriate model provider
   */
  private async executeWithModel(prompt: string, modelConfig: any, request: DSPyRequest): Promise<any> {
    switch (modelConfig.provider) {
      case 'ollama':
        return await this.ollamaService.generateText({
          model: modelConfig.model,
          prompt: prompt,
          options: {
            temperature: modelConfig.temperature,
            num_predict: modelConfig.num_predict,
            top_p: modelConfig.top_p,
            top_k: modelConfig.top_k
          }
        });
      
      case 'mlx':
        // Use MLX service for inference
        const { MLXIntegrationService } = require('./mlx-integration');
        const mlxService = new MLXIntegrationService();
        await mlxService.initialize();
        
        return await mlxService.runInference({
          modelName: modelConfig.model,
          prompt: prompt,
          maxTokens: modelConfig.num_predict,
          temperature: modelConfig.temperature,
          topP: modelConfig.top_p,
          topK: modelConfig.top_k
        });
      
      case 'openai':
      case 'anthropic':
        // For external API providers, we'd implement API calls here
        // For now, fall back to Ollama
        console.warn(`Provider ${modelConfig.provider} not implemented, falling back to Ollama`);
        return await this.ollamaService.generateText({
          model: modelConfig.model,
          prompt: prompt,
          options: {
            temperature: modelConfig.temperature,
            num_predict: modelConfig.num_predict
          }
        });
      
      default:
        throw new Error(`Unsupported model provider: ${modelConfig.provider}`);
    }
  }

  /**
   * Build agent prompt from template
   */
  private buildAgentPrompt(agent: DSPyAgent, context: any, previousOutputs: AgentOutput[]): string {
    let prompt = agent.promptTemplate;
    
    // Replace placeholders
    prompt = prompt.replace('{task}', context.originalTask || '');
    prompt = prompt.replace('{context}', JSON.stringify(context, null, 2));
    
    // Add previous outputs as input
    const input = previousOutputs.length > 0 ? 
      previousOutputs.map(o => `${o.metadata.agent}: ${JSON.stringify(o.output)}`).join('\n') : 
      context.originalTask || '';
    prompt = prompt.replace('{input}', input);

    return prompt;
  }

  /**
   * Check agent dependencies
   */
  private checkDependencies(agent: DSPyAgent, previousOutputs: AgentOutput[]): boolean {
    if (agent.dependencies.length === 0) return true;
    
    return agent.dependencies.every(depId => 
      previousOutputs.some(output => output.agentId === depId)
    );
  }

  /**
   * Check convergence criteria
   */
  private checkConvergence(outputs: AgentOutput[], criteria: any): boolean {
    if (criteria.confidence) {
      const avgConfidence = outputs.reduce((sum, o) => sum + o.confidence, 0) / outputs.length;
      return avgConfidence >= criteria.confidence;
    }
    return false;
  }

  /**
   * Synthesize results from all agents
   */
  private async synthesizeResults(outputs: AgentOutput[], request: DSPyRequest): Promise<any> {
    const synthesis = {
      task: request.task,
      agents: outputs.map(o => ({
        agent: o.metadata.agent,
        role: o.metadata.role,
        output: o.output,
        confidence: o.confidence
      })),
      summary: this.generateSummary(outputs),
      recommendations: this.extractRecommendations(outputs),
      risks: this.extractRisks(outputs),
      nextSteps: this.extractNextSteps(outputs)
    };

    return synthesis;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(outputs: AgentOutput[]): number {
    if (outputs.length === 0) return 0;
    return outputs.reduce((sum, o) => sum + o.confidence, 0) / outputs.length;
  }

  /**
   * Calculate agent confidence
   */
  private calculateAgentConfidence(output: any): number {
    if (output.error) return 0;
    if (output.confidence) return output.confidence;
    if (output.raw_output) return 0.5; // Default for raw output
    return 0.8; // Default confidence
  }

  /**
   * Extract reasoning from agent output
   */
  private extractReasoning(output: any): string {
    if (output.reasoning) return output.reasoning;
    if (output.explanation) return output.explanation;
    if (output.analysis) return output.analysis;
    return 'No reasoning provided';
  }

  /**
   * Generate summary from outputs
   */
  private generateSummary(outputs: AgentOutput[]): string {
    const keyInsights = outputs
      .filter(o => o.output.keyInsights || o.output.insights)
      .map(o => o.output.keyInsights || o.output.insights)
      .join('; ');
    
    return keyInsights || 'Analysis completed with multiple perspectives';
  }

  /**
   * Extract recommendations from outputs
   */
  private extractRecommendations(outputs: AgentOutput[]): string[] {
    const recommendations = outputs
      .filter(o => o.output.recommendations)
      .flatMap(o => Array.isArray(o.output.recommendations) ? o.output.recommendations : [o.output.recommendations]);
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Extract risks from outputs
   */
  private extractRisks(outputs: AgentOutput[]): string[] {
    const risks = outputs
      .filter(o => o.output.risks || o.output.potentialProblems)
      .flatMap(o => {
        const riskSource = o.output.risks || o.output.potentialProblems;
        return Array.isArray(riskSource) ? riskSource : [riskSource];
      });
    
    return [...new Set(risks)]; // Remove duplicates
  }

  /**
   * Extract next steps from outputs
   */
  private extractNextSteps(outputs: AgentOutput[]): string[] {
    const nextSteps = outputs
      .filter(o => o.output.nextSteps || o.output.implementationSteps)
      .flatMap(o => {
        const stepsSource = o.output.nextSteps || o.output.implementationSteps;
        return Array.isArray(stepsSource) ? stepsSource : [stepsSource];
      });
    
    return [...new Set(nextSteps)]; // Remove duplicates
  }

  /**
   * Extract insights from outputs
   */
  private extractInsights(outputs: AgentOutput[]): any {
    return {
      keyFindings: this.extractKeyFindings(outputs),
      recommendations: this.extractRecommendations(outputs),
      risks: this.extractRisks(outputs),
      opportunities: this.extractOpportunities(outputs)
    };
  }

  /**
   * Extract key findings
   */
  private extractKeyFindings(outputs: AgentOutput[]): string[] {
    const findings = outputs
      .filter(o => o.output.keyFindings || o.output.findings)
      .flatMap(o => {
        const findingsSource = o.output.keyFindings || o.output.findings;
        return Array.isArray(findingsSource) ? findingsSource : [findingsSource];
      });
    
    return [...new Set(findings)];
  }

  /**
   * Extract opportunities
   */
  private extractOpportunities(outputs: AgentOutput[]): string[] {
    const opportunities = outputs
      .filter(o => o.output.opportunities)
      .flatMap(o => Array.isArray(o.output.opportunities) ? o.output.opportunities : [o.output.opportunities]);
    
    return [...new Set(opportunities)];
  }

  /**
   * Store learning data
   */
  private async storeLearningData(request: DSPyRequest, outputs: AgentOutput[], result: any): Promise<void> {
    const learningData = {
      task: request.task,
      context: request.context,
      reasoningChain: request.reasoningChain,
      agentOutputs: outputs,
      result: result,
      timestamp: new Date(),
      userId: request.userId,
      sessionId: request.sessionId
    };

    this.learningData.push(learningData);

    // Store in database
    try {
      await this.supabase
        .from('dspy_learning_data')
        .insert([learningData]);
    } catch (error) {
      console.warn('Could not store learning data:', error);
    }
  }

  /**
   * Get available reasoning chains
   */
  getAvailableChains(): DSPyReasoningChain[] {
    return Array.from(this.reasoningChains.values());
  }

  /**
   * Get available agents
   */
  getAvailableAgents(): DSPyAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    const ollamaStatus = await this.ollamaService.getStatus();
    
    return {
      initialized: true,
      agents: this.agents.size,
      reasoningChains: this.reasoningChains.size,
      learningDataCount: this.learningData.length,
      ollamaStatus,
      availableChains: this.getAvailableChains().map(c => ({
        id: c.id,
        name: c.name,
        agents: c.agents.length
      })),
      availableAgents: this.getAvailableAgents().map(a => ({
        id: a.id,
        name: a.name,
        role: a.role
      }))
    };
  }

  /**
   * Shutdown DSPy Orchestrator
   */
  async shutdown(): Promise<void> {
    console.log('🛑 DSPy Orchestrator shutdown');
  }
}

export { DSPyOrchestrator, DSPyRequest, DSPyResponse, DSPyAgent, DSPyReasoningChain, AgentOutput };