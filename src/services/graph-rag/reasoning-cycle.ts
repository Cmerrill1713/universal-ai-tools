/**
 * Graph-R1 Reasoning Cycle Implementation
 * 
 * Implements the Think-Generate-Retrieve-Rethink cycle
 * that enables iterative reasoning on graph-structured knowledge.
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '../../utils/logger';
import type { GRPOAction, GRPOState, GRPOTransition } from './grpo-optimizer';
import { grpoOptimizer } from './grpo-optimizer';
import type { GraphEntity, GraphPath } from './knowledge-graph-service';
import { knowledgeGraphService } from './knowledge-graph-service';
import { llmEntityExtractor } from './llm-entity-extractor';

export interface ReasoningStep {
  type: 'think' | 'generate' | 'retrieve' | 'rethink' | 'answer';
  content: string;
  confidence: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ReasoningResult {
  query: string;
  answer: string;
  confidence: number;
  steps: ReasoningStep[];
  retrievedPaths: GraphPath[];
  totalReward: number;
  reasoning: string[];
}

export interface ReasoningOptions {
  maxSteps?: number;
  useRL?: boolean;
  temperature?: number;
  model?: string;
  verbose?: boolean;
}

export class ReasoningCycle extends EventEmitter {
  private currentState: GRPOState | null = null;
  private transitions: GRPOTransition[] = [];
  private reasoningSteps: ReasoningStep[] = [];
  
  constructor() {
    super();
  }

  /**
   * Execute the complete reasoning cycle for a query
   */
  async executeReasoning(
    query: string,
    options: ReasoningOptions = {}
  ): Promise<ReasoningResult> {
    const maxSteps = options.maxSteps || 10;
    const useRL = options.useRL !== false;
    const verbose = options.verbose || false;

    // Initialize state
    this.currentState = {
      query,
      visitedNodes: new Set(),
      retrievedContext: [],
      thoughts: [],
      stepCount: 0,
      totalReward: 0
    };

    this.transitions = [];
    this.reasoningSteps = [];

    const retrievedPaths: GraphPath[] = [];
    let finalAnswer = '';
    let finalConfidence = 0;

    try {
      // Main reasoning loop
      while (this.currentState.stepCount < maxSteps) {
        // Select action using GRPO if enabled
        const action = useRL 
          ? await grpoOptimizer.selectAction(this.currentState)
          : await this.selectActionHeuristic(this.currentState);

        if (verbose) {
          log.info(`Reasoning step ${this.currentState.stepCount + 1}`, LogContext.AI, {
            action: action.type,
            confidence: action.confidence
          });
        }

        // Execute action and get next state
        const { nextState, stepResult } = await this.executeAction(
          this.currentState,
          action,
          options
        );

        // Record reasoning step
        this.reasoningSteps.push(stepResult);
        this.emit('reasoning_step', stepResult);

        // Calculate reward if using RL
        let reward = 0;
        if (useRL) {
          reward = grpoOptimizer.calculateReward(this.currentState, action, nextState);
        }

        // Check termination conditions
        const done = action.type === 'terminate' || 
                     nextState.stepCount >= maxSteps ||
                     this.shouldTerminate(nextState);

        // Record transition for RL training
        if (useRL) {
          this.transitions.push({
            state: this.currentState,
            action,
            reward,
            nextState,
            done
          });
        }

        // Update state
        this.currentState = nextState;
        this.currentState.totalReward += reward;

        // If done, generate final answer
        if (done) {
          const answerResult = await this.generateFinalAnswer(
            query,
            this.currentState,
            options
          );
          
          finalAnswer = answerResult.answer;
          finalConfidence = answerResult.confidence;
          
          this.reasoningSteps.push({
            type: 'answer',
            content: finalAnswer,
            confidence: finalConfidence,
            timestamp: Date.now()
          });

          break;
        }

        // Collect retrieved paths if action was retrieval
        if (action.type === 'retrieve' && stepResult.metadata?.paths) {
          retrievedPaths.push(...stepResult.metadata.paths);
        }
      }

      // Update GRPO policy if enabled
      if (useRL && this.transitions.length > 0) {
        const finalReward = this.evaluateFinalAnswer(
          query,
          finalAnswer,
          this.currentState
        );
        
        await grpoOptimizer.updatePolicy(this.transitions, finalReward);
      }

      return {
        query,
        answer: finalAnswer,
        confidence: finalConfidence,
        steps: this.reasoningSteps,
        retrievedPaths,
        totalReward: this.currentState.totalReward,
        reasoning: this.currentState.thoughts
      };

    } catch (error) {
      log.error('Reasoning cycle failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Execute a single action in the reasoning cycle
   */
  private async executeAction(
    state: GRPOState,
    action: GRPOAction,
    options: ReasoningOptions
  ): Promise<{ nextState: GRPOState; stepResult: ReasoningStep }> {
    const nextState: GRPOState = {
      ...state,
      stepCount: state.stepCount + 1,
      visitedNodes: new Set(state.visitedNodes),
      retrievedContext: [...state.retrievedContext],
      thoughts: [...state.thoughts],
      totalReward: state.totalReward
    };

    let stepResult: ReasoningStep;

    switch (action.type) {
      case 'think':
        stepResult = await this.executeThink(state, nextState, options);
        break;

      case 'generate_query':
        stepResult = await this.executeGenerateQuery(state, nextState, action, options);
        break;

      case 'retrieve':
        stepResult = await this.executeRetrieve(state, nextState, action, options);
        break;

      case 'rethink':
        stepResult = await this.executeRethink(state, nextState, options);
        break;

      case 'terminate':
      default:
        stepResult = {
          type: 'answer',
          content: 'Reasoning complete',
          confidence: action.confidence,
          timestamp: Date.now()
        };
        break;
    }

    return { nextState, stepResult };
  }

  /**
   * Execute THINK step: Analyze current state and formulate thoughts
   */
  private async executeThink(
    state: GRPOState,
    nextState: GRPOState,
    options: ReasoningOptions
  ): Promise<ReasoningStep> {
    const thought = await llmEntityExtractor.performReasoning(
      state.query,
      state.retrievedContext,
      state.thoughts,
      {
        model: options.model,
        temperature: options.temperature
      }
    );

    nextState.thoughts.push(thought.thought);

    return {
      type: 'think',
      content: thought.thought,
      confidence: thought.confidence,
      timestamp: Date.now(),
      metadata: {
        shouldRetrieve: thought.shouldRetrieve,
        nextQuery: thought.nextQuery
      }
    };
  }

  /**
   * Execute GENERATE QUERY step: Create retrieval query
   */
  private async executeGenerateQuery(
    state: GRPOState,
    nextState: GRPOState,
    action: GRPOAction,
    options: ReasoningOptions
  ): Promise<ReasoningStep> {
    // Generate query based on current thoughts
    const lastThought = state.thoughts[state.thoughts.length - 1] || state.query;
    
    const generatedQuery = action.query || 
      `Based on: ${lastThought}\nFind: relevant information`;

    return {
      type: 'generate',
      content: generatedQuery,
      confidence: action.confidence,
      timestamp: Date.now(),
      metadata: {
        originalQuery: state.query,
        thoughtCount: state.thoughts.length
      }
    };
  }

  /**
   * Execute RETRIEVE step: Fetch relevant graph paths
   */
  private async executeRetrieve(
    state: GRPOState,
    nextState: GRPOState,
    action: GRPOAction,
    options: ReasoningOptions
  ): Promise<ReasoningStep> {
    // Retrieve from knowledge graph
    const paths = await knowledgeGraphService.retrieveWithGraph({
      query: state.query,
      maxHops: 3,
      includeNeighbors: true,
      useRL: options.useRL
    });

    // Add retrieved context
    const newContext = paths.map(p => 
      p.nodes.map(n => n.name).join(' → ')
    );
    
    nextState.retrievedContext.push(...newContext);

    // Update visited nodes
    for (const path of paths) {
      for (const node of path.nodes) {
        nextState.visitedNodes.add(node.id);
        if (action.targetNodeId === node.id) {
          nextState.currentNodeId = node.id;
        }
      }
    }

    return {
      type: 'retrieve',
      content: `Retrieved ${paths.length} paths with ${nextState.visitedNodes.size} unique nodes`,
      confidence: action.confidence,
      timestamp: Date.now(),
      metadata: {
        paths,
        pathCount: paths.length,
        nodeCount: nextState.visitedNodes.size
      }
    };
  }

  /**
   * Execute RETHINK step: Re-evaluate approach based on retrieved information
   */
  private async executeRethink(
    state: GRPOState,
    nextState: GRPOState,
    options: ReasoningOptions
  ): Promise<ReasoningStep> {
    // Analyze if we have enough information
    const contextAnalysis = await this.analyzeContext(state.retrievedContext);
    
    // Determine if we need to change strategy
    const shouldPivot = contextAnalysis.coverage < 0.5 && state.stepCount > 3;
    
    let rethinkContent: string;
    if (shouldPivot) {
      rethinkContent = 'Current approach insufficient. Adjusting strategy...';
      // Clear some context to try new approach
      nextState.retrievedContext = nextState.retrievedContext.slice(-5);
    } else {
      rethinkContent = 'Consolidating retrieved information...';
    }

    nextState.thoughts.push(rethinkContent);

    return {
      type: 'rethink',
      content: rethinkContent,
      confidence: contextAnalysis.confidence,
      timestamp: Date.now(),
      metadata: {
        coverage: contextAnalysis.coverage,
        shouldPivot
      }
    };
  }

  /**
   * Generate final answer based on reasoning cycle
   */
  private async generateFinalAnswer(
    query: string,
    state: GRPOState,
    options: ReasoningOptions
  ): Promise<{ answer: string; confidence: number }> {
    // Synthesize answer from collected context and thoughts
    const context = state.retrievedContext.join('\n');
    const thoughts = state.thoughts.join('\n');

    const prompt = `Based on the following reasoning process and retrieved information, provide a comprehensive answer to the query.

Query: ${query}

Reasoning Steps:
${thoughts}

Retrieved Context:
${context}

Provide a clear, accurate answer:`;

    try {
      const response = await llmEntityExtractor.performReasoning(
        prompt,
        [],
        [],
        {
          model: options.model || 'gpt-oss:20b', // Use larger model for final answer
          temperature: 0.3
        }
      );

      return {
        answer: response.thought,
        confidence: response.confidence
      };
    } catch (error) {
      log.error('Failed to generate final answer', LogContext.AI, { error });
      return {
        answer: 'Unable to generate a comprehensive answer based on the reasoning process.',
        confidence: 0.2
      };
    }
  }

  /**
   * Heuristic action selection (when not using RL)
   */
  private async selectActionHeuristic(state: GRPOState): Promise<GRPOAction> {
    // Simple heuristic: Think → Generate → Retrieve → Rethink → Terminate
    const step = state.stepCount;

    if (step === 0) {
      return { type: 'think', confidence: 0.8 };
    } else if (step === 1) {
      return { type: 'generate_query', confidence: 0.7 };
    } else if (step % 3 === 2) {
      return { type: 'retrieve', confidence: 0.7 };
    } else if (step % 3 === 0 && step > 2) {
      return { type: 'rethink', confidence: 0.6 };
    } else if (state.retrievedContext.length > 5 || step >= 8) {
      return { type: 'terminate', confidence: 0.8 };
    } else {
      return { type: 'think', confidence: 0.6 };
    }
  }

  /**
   * Determine if reasoning should terminate
   */
  private shouldTerminate(state: GRPOState): boolean {
    // Terminate if we have enough context
    if (state.retrievedContext.length >= 10) {return true;}
    
    // Terminate if we're not making progress
    if (state.stepCount > 5 && state.visitedNodes.size < 2) {return true;}
    
    // Terminate if confidence is high
    const avgConfidence = state.thoughts.length > 0 ? 0.7 : 0;
    if (avgConfidence > 0.85) {return true;}

    return false;
  }

  /**
   * Analyze context coverage and quality
   */
  private async analyzeContext(
    context: string[]
  ): Promise<{ coverage: number; confidence: number }> {
    if (context.length === 0) {
      return { coverage: 0, confidence: 0.1 };
    }

    // Simple heuristic for context analysis
    const totalLength = context.reduce((sum, ctx) => sum + ctx.length, 0);
    const uniqueTerms = new Set(
      context.join(' ').toLowerCase().split(/\s+/)
    );

    const coverage = Math.min(1, uniqueTerms.size / 50); // Normalize
    const confidence = Math.min(1, totalLength / 1000); // Normalize

    return { coverage, confidence };
  }

  /**
   * Evaluate the quality of the final answer for reward calculation
   */
  private evaluateFinalAnswer(
    query: string,
    answer: string,
    state: GRPOState
  ): number {
    let reward = 0;

    // Reward for answer length (not too short, not too long)
    const answerLength = answer.length;
    if (answerLength > 50 && answerLength < 500) {
      reward += 0.3;
    }

    // Reward for using retrieved context
    if (state.retrievedContext.length > 0) {
      reward += 0.4;
    }

    // Reward for efficiency
    const efficiency = state.visitedNodes.size / Math.max(1, state.stepCount);
    reward += efficiency * 0.3;

    // Penalty for too many steps
    if (state.stepCount > 8) {
      reward -= 0.2;
    }

    // Bonus for high confidence
    const avgConfidence = state.totalReward / Math.max(1, state.stepCount);
    reward += avgConfidence * 0.2;

    return Math.max(0, Math.min(1, reward));
  }

  /**
   * Get current reasoning state
   */
  getCurrentState(): GRPOState | null {
    return this.currentState;
  }

  /**
   * Get reasoning history
   */
  getReasoningHistory(): ReasoningStep[] {
    return this.reasoningSteps;
  }
}

// Export singleton instance
export const reasoningCycle = new ReasoningCycle();