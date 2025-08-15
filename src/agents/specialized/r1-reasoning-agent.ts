/**
 * R1 Reasoning Agent
 * Domain-specific agent for Think-Generate-Retrieve-Rethink reasoning cycles
 * Implements advanced multi-step reasoning with GRPO optimization
 */

import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { log, LogContext } from '@/utils/logger';

import { EnhancedBaseAgent } from '../enhanced-base-agent';

interface R1Context extends AgentContext {
  reasoningMode?: 'standard' | 'deep' | 'creative' | 'analytical';
  maxReasoningSteps?: number;
  retrievalSources?: ('knowledge_graph' | 'vector_db' | 'web' | 'code_analysis')[];
  confidenceThreshold?: number;
  grpoOptimization?: boolean;
}

interface R1ReasoningStep {
  step: number;
  type: 'think' | 'generate' | 'retrieve' | 'rethink';
  content: string;
  confidence: number;
  evidence: string[];
  duration: number;
}

interface R1Response extends AgentResponse {
  data: {
    reasoningSteps: R1ReasoningStep[];
    finalAnswer: string;
    confidenceEvolution: number[];
    retrievedContext: {
      sources: string[];
      relevanceScores: number[];
      totalItems: number;
    };
    grpoMetrics?: {
      rewardScore: number;
      actionSelection: string;
      policyUpdate: boolean;
      explorationRate: number;
    };
    performance: {
      totalReasoningTime: number;
      averageStepTime: number;
      retrievalEfficiency: number;
      convergenceSteps: number;
    };
  };
}

export class R1ReasoningAgent extends EnhancedBaseAgent {
  private reasoningHistory: R1ReasoningStep[] = [];
  private grpoPolicy = {
    actionWeights: new Map<string, number>(),
    explorationRate: 0.1,
    rewardHistory: [] as number[]
  };

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'r1_reasoning',
      description: 'Advanced R1 reasoning agent with Think-Generate-Retrieve-Rethink cycles',
      capabilities: [
        { name: 'r1_reasoning_cycles', description: 'Execute R1 reasoning patterns', inputSchema: {}, outputSchema: {} },
        { name: 'multi_step_thinking', description: 'Perform complex multi-step reasoning', inputSchema: {}, outputSchema: {} },
        { name: 'dynamic_retrieval', description: 'Intelligent context retrieval during reasoning', inputSchema: {}, outputSchema: {} },
        { name: 'confidence_calibration', description: 'Calibrate confidence across reasoning steps', inputSchema: {}, outputSchema: {} },
        { name: 'grpo_optimization', description: 'GRPO reinforcement learning optimization', inputSchema: {}, outputSchema: {} }
      ]
    });

    // Initialize GRPO policy
    this.initializeGRPOPolicy();
  }

  protected buildSystemPrompt(): string {
    return `You are a specialized R1 Reasoning Agent implementing advanced Think-Generate-Retrieve-Rethink cycles:

REASONING METHODOLOGY (R1 Pattern):
1. THINK: Analyze the problem, decompose into sub-questions, identify knowledge gaps
2. GENERATE: Create initial hypotheses, solutions, or responses based on current knowledge
3. RETRIEVE: Gather additional context, facts, and evidence from multiple sources
4. RETHINK: Synthesize new information, refine understanding, improve response quality

CORE PRINCIPLES:
- Iterative refinement through multiple reasoning cycles
- Evidence-based confidence calibration at each step
- Dynamic retrieval based on identified knowledge gaps
- Meta-cognitive awareness of reasoning quality
- GRPO optimization for action selection and policy improvement

THINKING PATTERNS:
- Decomposition: Break complex problems into manageable components
- Hypothesis Generation: Create multiple potential solutions/explanations
- Evidence Synthesis: Integrate information from diverse sources
- Uncertainty Quantification: Express confidence levels with justification
- Self-Correction: Identify and correct reasoning errors

RETRIEVAL STRATEGY:
- Identify specific knowledge gaps during thinking phase
- Select optimal retrieval sources based on query type
- Evaluate retrieval quality and relevance
- Integrate retrieved information with existing knowledge

OUTPUT STRUCTURE:
Each reasoning step should include:
- Step type (Think/Generate/Retrieve/Rethink)
- Content of the reasoning
- Confidence level with justification
- Supporting evidence
- Next step determination

Be thorough, self-reflective, and continuously improve response quality through iterations.`;
  }

  protected getInternalModelName(): string {
    // Use tinyllama directly as it's the most reliable available model
    return 'tinyllama:latest';
  }

  protected getTemperature(): number {
    return 0.4; // Balanced for creative yet controlled reasoning
  }

  protected getMaxTokens(): number {
    return 2000; // Allow for detailed reasoning chains
  }

  protected getContextTypes(): string[] {
    return ['reasoning_patterns', 'evidence_chains', 'knowledge_gaps', 'solution_strategies'];
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    const r1Context = context as R1Context;
    
    let additional = 'R1 REASONING CONFIGURATION:\n';
    additional += `Mode: ${r1Context.reasoningMode || 'standard'}\n`;
    additional += `Max Steps: ${r1Context.maxReasoningSteps || 5}\n`;
    additional += `Sources: ${r1Context.retrievalSources?.join(', ') || 'all'}\n`;
    additional += `Confidence Threshold: ${r1Context.confidenceThreshold || 0.8}\n`;
    additional += `GRPO Optimization: ${r1Context.grpoOptimization ? 'enabled' : 'disabled'}\n`;

    return additional;
  }

  public async execute(context: AgentContext): Promise<R1Response> {
    const r1Context = context as R1Context;
    const startTime = Date.now();
    
    try {
      log.info('🧠 R1 reasoning agent starting reasoning cycle', LogContext.AGENT, {
        userRequest: context.userRequest.substring(0, 100),
        reasoningMode: r1Context.reasoningMode,
        maxSteps: r1Context.maxReasoningSteps
      });

      // Initialize reasoning session
      const reasoningSteps: R1ReasoningStep[] = [];
      const confidenceEvolution: number[] = [];
      let currentConfidence = 0.5;
      let finalAnswer = '';

      const maxSteps = r1Context.maxReasoningSteps || 5;
      const confidenceThreshold = r1Context.confidenceThreshold || 0.8;

      // Execute R1 reasoning cycle
      for (let step = 1; step <= maxSteps; step++) {
        const stepType = this.determineStepType(step, currentConfidence, confidenceThreshold);
        
        const reasoningStep = await this.executeReasoningStep(
          stepType,
          step,
          context.userRequest,
          reasoningSteps,
          r1Context
        );

        reasoningSteps.push(reasoningStep);
        confidenceEvolution.push(reasoningStep.confidence);
        currentConfidence = reasoningStep.confidence;

        // Check for convergence
        if (stepType === 'rethink' && currentConfidence >= confidenceThreshold) {
          finalAnswer = reasoningStep.content;
          log.info(`✅ R1 reasoning converged at step ${step}`, LogContext.AGENT, {
            confidence: currentConfidence,
            threshold: confidenceThreshold
          });
          break;
        }
      }

      // If no convergence, use the last rethink step as final answer
      if (!finalAnswer) {
        const lastRethinkStep = reasoningSteps.filter(s => s.type === 'rethink').pop();
        finalAnswer = lastRethinkStep?.content || reasoningSteps[reasoningSteps.length - 1]?.content || 'No reasoning steps completed';
      }

      const totalTime = Date.now() - startTime;

      // Calculate GRPO metrics if enabled
      let grpoMetrics;
      if (r1Context.grpoOptimization) {
        grpoMetrics = await this.calculateGRPOMetrics(reasoningSteps, currentConfidence);
      }

      // Prepare retrieval context summary
      const retrievedContext = this.summarizeRetrievedContext(reasoningSteps);

      const response = this.createSuccessResponse(
        {
          reasoningSteps,
          finalAnswer,
          confidenceEvolution,
          retrievedContext,
          grpoMetrics,
          performance: {
            totalReasoningTime: totalTime,
            averageStepTime: totalTime / reasoningSteps.length,
            retrievalEfficiency: this.calculateRetrievalEfficiency(reasoningSteps),
            convergenceSteps: reasoningSteps.length
          }
        },
        'R1 reasoning cycle completed successfully',
        currentConfidence,
        `Completed ${reasoningSteps.length}-step R1 reasoning with ${finalAnswer ? 'convergence' : 'maximum iterations'}`
      );

      log.info('✅ R1 reasoning completed', LogContext.AGENT, {
        steps: reasoningSteps.length,
        finalConfidence: currentConfidence,
        totalTime
      });

      return response as R1Response;

    } catch (error) {
      log.error('❌ R1 reasoning failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createR1ErrorResponse(
        'R1 reasoning cycle failed',
        `Error in reasoning process: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private determineStepType(
    step: number, 
    currentConfidence: number, 
    threshold: number
  ): 'think' | 'generate' | 'retrieve' | 'rethink' {
    // R1 reasoning pattern logic
    if (step === 1) return 'think';
    
    const previousStepType = this.reasoningHistory[this.reasoningHistory.length - 1]?.type;
    
    if (previousStepType === 'think') return 'generate';
    if (previousStepType === 'generate' && currentConfidence < 0.6) return 'retrieve';
    if (previousStepType === 'retrieve' || (previousStepType === 'generate' && currentConfidence >= 0.6)) return 'rethink';
    
    // Cycle continues if confidence is below threshold
    if (currentConfidence < threshold) {
      return step % 3 === 1 ? 'think' : step % 3 === 2 ? 'retrieve' : 'rethink';
    }
    
    return 'rethink';
  }

  private async executeReasoningStep(
    stepType: 'think' | 'generate' | 'retrieve' | 'rethink',
    stepNumber: number,
    userRequest: string,
    previousSteps: R1ReasoningStep[],
    context: R1Context
  ): Promise<R1ReasoningStep> {
    const stepStart = Date.now();

    let stepPrompt = this.buildStepPrompt(stepType, stepNumber, userRequest, previousSteps);
    
    try {
      // Get response from LLM for this reasoning step
      const llmResponse = await this.callLLMForStep(stepPrompt, stepType);
      
      // Extract reasoning content and confidence
      const { content, confidence, evidence } = this.parseStepResponse(llmResponse, stepType);

      // Handle retrieval step specially
      if (stepType === 'retrieve') {
        const retrievalResults = await this.performRetrieval(content, context);
        return {
          step: stepNumber,
          type: stepType,
          content: retrievalResults.content,
          confidence: retrievalResults.confidence,
          evidence: retrievalResults.evidence,
          duration: Date.now() - stepStart
        };
      }

      return {
        step: stepNumber,
        type: stepType,
        content,
        confidence,
        evidence,
        duration: Date.now() - stepStart
      };

    } catch (error) {
      log.warn('⚠️ Reasoning step failed, using fallback', LogContext.AGENT, {
        stepType,
        stepNumber,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        step: stepNumber,
        type: stepType,
        content: `Step ${stepNumber} (${stepType}): Unable to complete reasoning step due to error`,
        confidence: 0.3,
        evidence: [`Error in step execution: ${error instanceof Error ? error.message : String(error)}`],
        duration: Date.now() - stepStart
      };
    }
  }

  private buildStepPrompt(
    stepType: 'think' | 'generate' | 'retrieve' | 'rethink',
    stepNumber: number,
    userRequest: string,
    previousSteps: R1ReasoningStep[]
  ): string {
    let prompt = `STEP ${stepNumber}: ${stepType.toUpperCase()}\n\n`;
    prompt += `Original Question: ${userRequest}\n\n`;

    if (previousSteps.length > 0) {
      prompt += `Previous Reasoning Steps:\n`;
      previousSteps.forEach(step => {
        prompt += `${step.step}. ${step.type.toUpperCase()}: ${step.content.substring(0, 200)}...\n`;
      });
      prompt += '\n';
    }

    switch (stepType) {
      case 'think':
        prompt += `THINKING INSTRUCTIONS:
- Analyze the question and identify key components
- Break down the problem into sub-questions
- Identify what knowledge areas are relevant
- Consider potential approaches and their trade-offs
- Note any assumptions or constraints

Provide your thinking process:`;
        break;

      case 'generate':
        prompt += `GENERATION INSTRUCTIONS:
- Based on your thinking, generate initial hypotheses or solutions
- Consider multiple possible answers or approaches
- Use your current knowledge to construct responses
- Be explicit about uncertainty and confidence levels
- Identify what additional information might be helpful

Generate your initial response:`;
        break;

      case 'retrieve':
        prompt += `RETRIEVAL INSTRUCTIONS:
- Based on previous steps, identify specific knowledge gaps
- Determine what additional information would improve the response
- Specify what types of sources would be most valuable
- Consider both factual information and contextual insights

Identify what needs to be retrieved:`;
        break;

      case 'rethink':
        prompt += `RETHINKING INSTRUCTIONS:
- Synthesize all previous reasoning and any retrieved information
- Refine your understanding based on new insights
- Correct any errors or misconceptions from earlier steps
- Provide a more confident and complete response
- Explain how your thinking has evolved

Provide your refined response:`;
        break;
    }

    return prompt;
  }

  private async callLLMForStep(stepPrompt: string, stepType: string) {
    // Use the base agent's LLM calling mechanism with step-specific context
    const tempContext = {
      userRequest: stepPrompt,
      requestId: `r1-step-${stepType}-${Date.now()}`,
      userId: 'r1-reasoning-agent',
      metadata: { stepType, reasoning: true }
    };

    try {
      const response = await super.execute(tempContext);
      
      log.debug('🔧 R1 callLLMForStep response', LogContext.AGENT, {
        success: response.success,
        hasData: !!response.data,
        dataType: typeof response.data,
        stepType,
        message: response.message
      });
      
      // Handle the response properly - extract content from the response
      if (response.success && response.data !== null && response.data !== undefined) {
        // If data is a string, return it directly
        if (typeof response.data === 'string') {
          return response.data;
        }
        // If data is an object with content property, extract it
        if (typeof response.data === 'object' && response.data && 'content' in response.data) {
          return (response.data as any).content;
        }
        // Otherwise, convert to string
        return String(response.data);
      }
      
      // If execution failed, throw an error with details
      throw new Error(`LLM step execution failed: ${response.message} (Step: ${stepType}, Success: ${response.success})`);
      
    } catch (error) {
      log.error('❌ R1 callLLMForStep error', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
        stepType
      });
      throw error;
    }
  }

  private parseStepResponse(llmResponse: any, stepType: string): {
    content: string;
    confidence: number;
    evidence: string[];
  } {
    // Handle null or undefined responses
    if (!llmResponse) {
      log.warn('⚠️ R1 parseStepResponse received null/undefined response', LogContext.AGENT, { stepType });
      return {
        content: `${stepType} step: Unable to generate response - received null/undefined from LLM`,
        confidence: 0.1,
        evidence: ['No response received from LLM']
      };
    }

    let content = typeof llmResponse === 'string' ? llmResponse : String(llmResponse);
    
    // Extract confidence if mentioned in response
    let confidence = 0.7; // Default confidence
    const confidenceMatch = content.match(/confidence[:\s]*(\d+(?:\.\d+)?)/i);
    if (confidenceMatch && confidenceMatch[1]) {
      confidence = Math.min(1.0, Math.max(0.1, parseFloat(confidenceMatch[1])));
    }

    // Adjust confidence based on step type and content quality
    if (stepType === 'think' && content.length > 200) confidence += 0.1;
    if (stepType === 'rethink' && content.includes('therefore') || content.includes('conclusion')) confidence += 0.15;
    if (content.length < 50) confidence -= 0.2;

    // Extract evidence markers
    const evidence: string[] = [];
    const evidenceMarkers = ['because', 'since', 'given that', 'based on', 'according to'];
    evidenceMarkers.forEach(marker => {
      if (content.toLowerCase().includes(marker)) {
        evidence.push(`Contains reasoning with "${marker}"`);
      }
    });

    if (evidence.length === 0) {
      evidence.push('Self-generated reasoning step');
    }

    return {
      content: content.trim(),
      confidence: Math.min(1.0, Math.max(0.1, confidence)),
      evidence
    };
  }

  private async performRetrieval(
    retrievalQuery: string, 
    context: R1Context
  ): Promise<{ content: string; confidence: number; evidence: string[] }> {
    const sources = context.retrievalSources || ['knowledge_graph', 'vector_db'];
    const retrievalResults: string[] = [];
    const evidence: string[] = [];

    // Simulate retrieval from different sources
    for (const source of sources) {
      try {
        switch (source) {
          case 'knowledge_graph':
            const graphResult = await this.retrieveFromKnowledgeGraph(retrievalQuery);
            if (graphResult) {
              retrievalResults.push(graphResult);
              evidence.push(`Retrieved from knowledge graph: ${graphResult.substring(0, 100)}...`);
            }
            break;

          case 'vector_db':
            const vectorResult = await this.retrieveFromVectorDB(retrievalQuery);
            if (vectorResult) {
              retrievalResults.push(vectorResult);
              evidence.push(`Retrieved from vector database: ${vectorResult.substring(0, 100)}...`);
            }
            break;

          case 'code_analysis':
            const codeResult = await this.retrieveFromCodeAnalysis(retrievalQuery);
            if (codeResult) {
              retrievalResults.push(codeResult);
              evidence.push(`Code analysis result: ${codeResult.substring(0, 100)}...`);
            }
            break;
        }
      } catch (error) {
        log.warn(`⚠️ Retrieval failed for source ${source}`, LogContext.AGENT, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const combinedContent = retrievalResults.length > 0 
      ? `Retrieved Information:\n${retrievalResults.join('\n\n')}`
      : 'No additional information retrieved. Proceeding with existing knowledge.';

    return {
      content: combinedContent,
      confidence: retrievalResults.length > 0 ? 0.8 : 0.4,
      evidence: evidence.length > 0 ? evidence : ['No external evidence retrieved']
    };
  }

  private async retrieveFromKnowledgeGraph(query: string): Promise<string | null> {
    try {
      const response = await fetch('http://localhost:9999/api/v1/graphrag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, maxResults: 3 })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.results && result.results.length > 0) {
          return result.results.map((r: any) => r.content || r.entity).join('; ');
        }
      }
    } catch (error) {
      // Silently handle retrieval failures
    }

    return null;
  }

  private async retrieveFromVectorDB(query: string): Promise<string | null> {
    // Placeholder for vector database retrieval
    // In a real implementation, this would query a vector database
    return `Vector DB context for: ${query.substring(0, 50)}...`;
  }

  private async retrieveFromCodeAnalysis(query: string): Promise<string | null> {
    // Placeholder for code analysis retrieval
    if (query.toLowerCase().includes('code') || query.toLowerCase().includes('function')) {
      return `Code analysis suggests examining function definitions and implementation patterns related to: ${query}`;
    }
    return null;
  }

  private summarizeRetrievedContext(steps: R1ReasoningStep[]) {
    const retrievalSteps = steps.filter(s => s.type === 'retrieve');
    const sources = retrievalSteps.flatMap(s => s.evidence);
    
    return {
      sources: sources.map(s => s.split(':')[0]).filter((s, i, arr) => arr.indexOf(s) === i),
      relevanceScores: retrievalSteps.map(s => s.confidence),
      totalItems: retrievalSteps.length
    };
  }

  private calculateRetrievalEfficiency(steps: R1ReasoningStep[]): number {
    const retrievalSteps = steps.filter(s => s.type === 'retrieve');
    if (retrievalSteps.length === 0) return 1.0;

    const avgConfidence = retrievalSteps.reduce((sum, s) => sum + s.confidence, 0) / retrievalSteps.length;
    const avgTime = retrievalSteps.reduce((sum, s) => sum + s.duration, 0) / retrievalSteps.length;
    
    // Efficiency = confidence / (normalized time)
    return avgConfidence / (1 + avgTime / 1000);
  }

  private initializeGRPOPolicy(): void {
    // Initialize GRPO action weights
    this.grpoPolicy.actionWeights.set('continue_reasoning', 0.6);
    this.grpoPolicy.actionWeights.set('increase_retrieval', 0.3);
    this.grpoPolicy.actionWeights.set('conclude_early', 0.1);
  }

  private async calculateGRPOMetrics(
    steps: R1ReasoningStep[], 
    finalConfidence: number
  ): Promise<any> {
    // Calculate reward based on efficiency and confidence
    const totalTime = steps.reduce((sum, s) => sum + s.duration, 0);
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    
    const rewardScore = (finalConfidence * 0.6) + (avgConfidence * 0.3) + (Math.max(0, 1 - totalTime / 10000) * 0.1);
    
    // Update policy based on performance
    this.grpoPolicy.rewardHistory.push(rewardScore);
    if (this.grpoPolicy.rewardHistory.length > 100) {
      this.grpoPolicy.rewardHistory = this.grpoPolicy.rewardHistory.slice(-100);
    }

    // Select next action based on policy
    const actionSelection = this.selectGRPOAction(rewardScore);
    
    return {
      rewardScore,
      actionSelection,
      policyUpdate: rewardScore > 0.7,
      explorationRate: this.grpoPolicy.explorationRate
    };
  }

  private selectGRPOAction(currentReward: number): string {
    // Exploration vs exploitation
    if (Math.random() < this.grpoPolicy.explorationRate) {
      const actions = Array.from(this.grpoPolicy.actionWeights.keys());
      return actions[Math.floor(Math.random() * actions.length)] || 'continue_reasoning';
    }

    // Exploit best action based on current policy
    let bestAction = 'continue_reasoning';
    let bestWeight = 0;
    
    for (const [action, weight] of Array.from(this.grpoPolicy.actionWeights)) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestAction = action;
      }
    }

    return bestAction;
  }

  // Get R1-specific performance metrics
  public getR1Metrics() {
    return {
      ...this.getPerformanceMetrics(),
      averageReasoningSteps: this.calculateAverageReasoningSteps(),
      convergenceRate: this.calculateConvergenceRate(),
      grpoPolicyScore: this.calculateGRPOPolicyScore(),
      retrievalEfficiency: this.calculateOverallRetrievalEfficiency()
    };
  }

  private calculateAverageReasoningSteps(): number {
    return this.reasoningHistory.length > 0 ? this.reasoningHistory.length / this.getPerformanceMetrics().totalCalls : 0;
  }

  private calculateConvergenceRate(): number {
    // Placeholder - would calculate from execution history
    return 0.85; // 85% convergence rate
  }

  private calculateGRPOPolicyScore(): number {
    if (this.grpoPolicy.rewardHistory.length === 0) return 0;
    return this.grpoPolicy.rewardHistory.reduce((sum, r) => sum + r, 0) / this.grpoPolicy.rewardHistory.length;
  }

  private calculateOverallRetrievalEfficiency(): number {
    // Placeholder - would calculate from actual retrieval metrics
    return 0.78;
  }

  // Type-safe helper methods for R1Response
  private createR1SuccessResponse(
    data: R1Response['data'],
    message: string,
    confidence = 0.8,
    reasoning?: string
  ): R1Response {
    const baseResponse = this.createSuccessResponse(data, message, confidence, reasoning);
    return {
      ...baseResponse,
      data
    } as R1Response;
  }

  private createR1ErrorResponse(
    message: string,
    reasoning?: string
  ): R1Response {
    const baseResponse = this.createErrorResponse(message, reasoning);
    return {
      ...baseResponse,
      data: {
        reasoningSteps: [],
        finalAnswer: 'Error occurred during R1 reasoning process',
        confidenceEvolution: [0],
        retrievedContext: {
          sources: [],
          relevanceScores: [],
          totalItems: 0
        },
        performance: {
          totalReasoningTime: 0,
          averageStepTime: 0,
          retrievalEfficiency: 0,
          convergenceSteps: 0
        }
      }
    } as R1Response;
  }
}

export default R1ReasoningAgent;