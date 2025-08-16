/**
 * Fitness Evaluator Service
 * Comprehensive fitness evaluation for evolutionary AI systems
 * Supports multiple task types and evaluation strategies
 */

import { log, LogContext } from '@/utils/logger';

import { multiTierLLM } from '../multi-tier-llm-service';
import type {
  Benchmark,
  EvaluationResult,
  FitnessFunction,
  Individual,
  ResourceUsage,
  Task,
  TaskMetrics} from './types';
import { TaskType } from './types';

export interface EvaluationConfig {
  timeoutMs: number;
  maxRetries: number;
  parallelEvaluations: number;
  useCache: boolean;
  benchmarkSuite: string[];
}

export class FitnessEvaluator {
  private evaluationCache: Map<string, EvaluationResult> = new Map();
  private benchmarks: Map<string, Benchmark> = new Map();
  private config: EvaluationConfig;

  constructor(config?: Partial<EvaluationConfig>) {
    this.config = {
      timeoutMs: 30000,
      maxRetries: 2,
      parallelEvaluations: 3,
      useCache: true,
      benchmarkSuite: ['reasoning', 'creativity', 'factual'],
      ...config
    };

    this.initializeBenchmarks();
  }

  /**
   * Evaluate an individual's fitness across multiple tasks
   */
  public async evaluateIndividual(
    individual: Individual,
    tasks: Task[],
    fitnessFunction: FitnessFunction
  ): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Evaluate on all tasks
      const evaluationResults = await this.evaluateOnTasks(individual, tasks);
      
      // Calculate composite fitness based on function type
      const fitness = this.calculateCompositeFitness(evaluationResults, fitnessFunction);
      
      // Update individual's evaluation history
      individual.evaluations = [...individual.evaluations, ...evaluationResults];
      individual.fitness = fitness;
      
      log.debug('Individual evaluation completed', LogContext.AI, {
        individualId: individual.id,
        fitness,
        tasksEvaluated: tasks.length,
        evaluationTime: Date.now() - startTime
      });
      
      return fitness;
      
    } catch (error) {
      log.error('Individual evaluation failed', LogContext.AI, {
        individualId: individual.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }

  /**
   * Evaluate individual on a set of tasks
   */
  private async evaluateOnTasks(individual: Individual, tasks: Task[]): Promise<EvaluationResult[]> {
    const results: EvaluationResult[] = [];
    
    // Process tasks in batches to respect parallelism limits
    for (let i = 0; i < tasks.length; i += this.config.parallelEvaluations) {
      const batch = tasks.slice(i, i + this.config.parallelEvaluations);
      const batchPromises = batch.map(task => this.evaluateOnTask(individual, task));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          log.warn('Task evaluation failed', LogContext.AI, {
            taskId: batch[index]?.id,
            error: result.reason
          });
          // Add default poor result for failed evaluations
          results.push(this.createFailedEvaluation(individual, batch[index]!));
        }
      });
    }
    
    return results;
  }

  /**
   * Evaluate individual on a single task
   */
  private async evaluateOnTask(individual: Individual, task: Task): Promise<EvaluationResult> {
    const cacheKey = `${individual.id}_${task.id}`;
    
    // Check cache first
    if (this.config.useCache && this.evaluationCache.has(cacheKey)) {
      const cached = this.evaluationCache.get(cacheKey)!;
      return { ...cached, timestamp: new Date() }; // Update timestamp
    }
    
    const startTime = Date.now();
    const resourceStart = this.measureResourceUsage();
    
    try {
      // Generate response using individual's genome
      const response = await this.generateResponse(individual, task);
      
      // Evaluate response quality
      const metrics = await this.evaluateResponse(task, response);
      
      // Calculate resource usage
      const resourceUsage = this.calculateResourceUsage(resourceStart, Date.now() - startTime);
      
      // Create evaluation result
      const result: EvaluationResult = {
        taskId: task.id,
        taskType: task.type,
        score: this.calculateTaskScore(metrics, task),
        metrics,
        executionTime: Date.now() - startTime,
        resourceUsage,
        errorRate: 0,
        timestamp: new Date()
      };
      
      // Cache result
      if (this.config.useCache) {
        this.evaluationCache.set(cacheKey, result);
      }
      
      return result;
      
    } catch (error) {
      log.error('Task evaluation error', LogContext.AI, {
        taskId: task.id,
        individualId: individual.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return this.createFailedEvaluation(individual, task);
    }
  }

  /**
   * Generate response using individual's genome
   */
  private async generateResponse(individual: Individual, task: Task): Promise<string> {
    const { genes } = individual;
    
    // Construct prompt from genome
    const {systemPrompt} = genes;
    const userPrompt = this.constructUserPrompt(genes.promptTemplate, task);
    
    // Apply reasoning strategy if specified
    const enhancedPrompt = this.applyReasoningStrategy(userPrompt, genes.reasoningStrategy);
    
    // Use multi-tier LLM with individual's parameters
    const response = await multiTierLLM.execute(enhancedPrompt, {
      systemPrompt,
      parameters: {
        temperature: genes.parameters.temperature,
        max_tokens: genes.parameters.maxTokens,
        top_p: genes.parameters.topP,
        frequency_penalty: genes.parameters.frequencyPenalty,
        presence_penalty: genes.parameters.presencePenalty
      },
      metadata: {
        domain: task.domain,
        complexity: task.difficulty,
        agentName: `evolution_individual_${individual.id}`,
        preferredModels: genes.modelPreferences
      },
      timeout: this.config.timeoutMs
    });
    
    return response.response;
  }

  /**
   * Construct user prompt from template and task
   */
  private constructUserPrompt(template: string, task: Task): string {
    return template
      .replace('{task_description}', task.description)
      .replace('{input}', task.input)
      .replace('{task_type}', task.type)
      .replace('{difficulty}', task.difficulty);
  }

  /**
   * Apply reasoning strategy to prompt
   */
  private applyReasoningStrategy(prompt: string, strategy: any): string {
    switch (strategy.type) {
      case 'cot':
        return `${prompt}\n\nLet's think through this step by step:`;
      
      case 'tree_of_thoughts':
        return `${prompt}\n\nLet's explore different approaches to this problem and evaluate each path:`;
      
      case 'react':
        return `${prompt}\n\nI'll use ReAct (Reasoning + Acting) to solve this:\nThought: `;
      
      case 'self_consistency':
        return `${prompt}\n\nI'll solve this problem multiple ways to ensure consistency:`;
      
      case 'debate':
        return `${prompt}\n\nLet me consider multiple perspectives on this problem:`;
      
      default:
        return prompt;
    }
  }

  /**
   * Evaluate response quality using LLM-as-a-judge
   */
  private async evaluateResponse(task: Task, response: string): Promise<TaskMetrics> {
    const evaluationPrompt = `Evaluate this AI response on multiple dimensions:

TASK: ${task.description}
INPUT: ${task.input}
RESPONSE: ${response}
EXPECTED OUTPUT: ${task.expectedOutput || 'Not specified'}

Rate each dimension on a scale of 0.0 to 1.0:

1. ACCURACY: How factually correct and precise is the response?
2. COHERENCE: How well-structured and logical is the response?
3. CREATIVITY: How original and innovative is the response?
4. EFFICIENCY: How concise yet complete is the response?
5. FACTUALNESS: How well does it stick to verifiable facts?
6. RELEVANCE: How well does it address the specific question?
7. DIVERSITY: How varied and comprehensive are the ideas presented?

Respond in JSON format:
{
  "accuracy": 0.0-1.0,
  "coherence": 0.0-1.0,
  "creativity": 0.0-1.0,
  "efficiency": 0.0-1.0,
  "factualness": 0.0-1.0,
  "relevance": 0.0-1.0,
  "diversity": 0.0-1.0,
  "reasoning": "Brief explanation of scores"
}`;

    try {
      const evaluation = await multiTierLLM.execute(evaluationPrompt, {
        metadata: {
          domain: 'evaluation',
          complexity: 'medium',
          agentName: 'fitness_evaluator'
        }
      });

      const parsed = JSON.parse(evaluation.response);
      
      // Validate and normalize scores
      return {
        accuracy: this.clampScore(parsed.accuracy),
        coherence: this.clampScore(parsed.coherence),
        creativity: this.clampScore(parsed.creativity),
        efficiency: this.clampScore(parsed.efficiency),
        factualness: this.clampScore(parsed.factualness),
        relevance: this.clampScore(parsed.relevance),
        diversity: this.clampScore(parsed.diversity)
      };
      
    } catch (error) {
      log.warn('LLM evaluation failed, using heuristics', LogContext.AI, { error });
      return this.heuristicEvaluation(task, response);
    }
  }

  /**
   * Heuristic evaluation fallback
   */
  private heuristicEvaluation(task: Task, response: string): TaskMetrics {
    const {length} = response;
    const wordCount = response.split(/\s+/).length;
    
    // Basic heuristics based on response characteristics
    return {
      accuracy: Math.min(1.0, wordCount / 100), // More words often means more detail
      coherence: response.includes('.') && response.includes(' ') ? 0.7 : 0.3,
      creativity: Math.min(1.0, new Set(response.toLowerCase().split(/\s+/)).size / wordCount), // Unique word ratio
      efficiency: Math.max(0.1, Math.min(1.0, 200 / length)), // Shorter is more efficient
      factualness: response.toLowerCase().includes('i think') || response.toLowerCase().includes('maybe') ? 0.5 : 0.7,
      relevance: this.calculateRelevance(task, response),
      diversity: Math.min(1.0, length / 500) // Longer responses often have more diversity
    };
  }

  /**
   * Calculate relevance using keyword matching
   */
  private calculateRelevance(task: Task, response: string): number {
    const taskWords = new Set(task.description.toLowerCase().split(/\s+/));
    const responseWords = new Set(response.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...taskWords].filter(x => responseWords.has(x)));
    return intersection.size / taskWords.size;
  }

  /**
   * Calculate composite fitness from multiple evaluations
   */
  private calculateCompositeFitness(results: EvaluationResult[], fitnessFunction: FitnessFunction): number {
    if (results.length === 0) return 0;

    switch (fitnessFunction.type) {
      case 'weighted_sum':
        return this.calculateWeightedSum(results, fitnessFunction.weights);
      
      case 'pareto':
        return this.calculateParetoFitness(results, fitnessFunction.objectives);
      
      case 'lexicographic':
        return this.calculateLexicographicFitness(results, fitnessFunction.objectives);
      
      case 'novelty_fitness':
        return this.calculateNoveltyFitness(results);
      
      default:
        return this.calculateWeightedSum(results, {});
    }
  }

  /**
   * Calculate weighted sum of metrics
   */
  private calculateWeightedSum(results: EvaluationResult[], weights: Record<string, number>): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const result of results) {
      const {metrics} = result;
      let resultScore = 0;
      let resultWeight = 0;

      // Weight each metric
      Object.entries(metrics).forEach(([metric, value]) => {
        const weight = weights[metric] || 1.0;
        resultScore += value * weight;
        resultWeight += weight;
      });

      if (resultWeight > 0) {
        totalScore += resultScore / resultWeight;
        totalWeight += 1;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate Pareto-based fitness
   */
  private calculateParetoFitness(results: EvaluationResult[], objectives: string[]): number {
    // Simplified Pareto fitness - average of objective values
    const objectiveScores = objectives.map(obj => {
      const scores = results.map(r => (r.metrics as any)[obj] || 0);
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    return objectiveScores.reduce((a, b) => a + b, 0) / objectiveScores.length;
  }

  /**
   * Calculate lexicographic fitness
   */
  private calculateLexicographicFitness(results: EvaluationResult[], objectives: string[]): number {
    // Primary objective dominates
    if (objectives.length === 0) return 0;

    const primaryObjective = objectives[0];
    const primaryScores = results.map(r => {
      if (!primaryObjective || typeof primaryObjective !== 'string') return 0;
      const metricValue = (r.metrics as any)[primaryObjective];
      return typeof metricValue === 'number' ? metricValue : 0;
    });
    return primaryScores.reduce((a, b) => a + b, 0) / primaryScores.length;
  }

  /**
   * Calculate novelty-based fitness
   */
  private calculateNoveltyFitness(results: EvaluationResult[]): number {
    // For now, use diversity metric as proxy for novelty
    const diversityScores = results.map(r => r.metrics.diversity);
    return diversityScores.reduce((a, b) => a + b, 0) / diversityScores.length;
  }

  /**
   * Calculate task-specific score
   */
  private calculateTaskScore(metrics: TaskMetrics, task: Task): number {
    // Weight metrics based on task type
    switch (task.type) {
      case TaskType.REASONING:
        return metrics.accuracy * 0.4 + metrics.coherence * 0.4 + metrics.relevance * 0.2;
      
      case TaskType.CREATIVE_WRITING:
        return metrics.creativity * 0.4 + metrics.coherence * 0.3 + metrics.diversity * 0.3;
      
      case TaskType.CODE_GENERATION:
        return metrics.accuracy * 0.5 + metrics.efficiency * 0.3 + metrics.coherence * 0.2;
      
      case TaskType.FACTUAL_QA:
        return metrics.accuracy * 0.5 + metrics.factualness * 0.3 + metrics.relevance * 0.2;
      
      default:
        return (metrics.accuracy + metrics.coherence + metrics.relevance) / 3;
    }
  }

  /**
   * Utility methods
   */
  private clampScore(score: number): number {
    return Math.max(0, Math.min(1, score));
  }

  private measureResourceUsage(): any {
    return {
      startTime: Date.now(),
      startMemory: process.memoryUsage().heapUsed
    };
  }

  private calculateResourceUsage(start: any, executionTime: number): ResourceUsage {
    return {
      tokensUsed: Math.floor(executionTime / 10), // Rough estimate
      apiCalls: 1,
      computeTime: executionTime,
      memoryUsed: process.memoryUsage().heapUsed - start.startMemory
    };
  }

  private createFailedEvaluation(individual: Individual, task: Task): EvaluationResult {
    return {
      taskId: task.id,
      taskType: task.type,
      score: 0,
      metrics: {
        accuracy: 0,
        coherence: 0,
        creativity: 0,
        efficiency: 0,
        factualness: 0,
        relevance: 0,
        diversity: 0
      },
      executionTime: this.config.timeoutMs,
      resourceUsage: {
        tokensUsed: 0,
        apiCalls: 1,
        computeTime: this.config.timeoutMs,
        memoryUsed: 0
      },
      errorRate: 1,
      timestamp: new Date()
    };
  }

  /**
   * Initialize benchmark suites
   */
  private initializeBenchmarks(): void {
    // Add reasoning benchmark
    this.benchmarks.set('reasoning', {
      id: 'reasoning',
      name: 'Reasoning Benchmark',
      description: 'Tests logical reasoning and problem-solving abilities',
      tasks: this.createReasoningTasks(),
      evaluationMetrics: ['accuracy', 'coherence', 'relevance'],
      baselineScores: { 'gpt-4': 0.85, 'claude-3': 0.82, 'gemini-pro': 0.80 }
    });

    // Add creativity benchmark  
    this.benchmarks.set('creativity', {
      id: 'creativity',
      name: 'Creativity Benchmark',
      description: 'Tests creative writing and idea generation',
      tasks: this.createCreativityTasks(),
      evaluationMetrics: ['creativity', 'diversity', 'coherence'],
      baselineScores: { 'gpt-4': 0.78, 'claude-3': 0.80, 'gemini-pro': 0.75 }
    });

    log.info('Fitness evaluator initialized', LogContext.AI, {
      benchmarks: this.benchmarks.size,
      cacheEnabled: this.config.useCache
    });
  }

  private createReasoningTasks(): Task[] {
    return [
      {
        id: 'logic_puzzle_1',
        type: TaskType.REASONING,
        description: 'Solve this logic puzzle',
        input: 'If all roses are flowers, and some flowers fade quickly, can we conclude that some roses fade quickly?',
        expectedOutput: 'No, we cannot conclude that some roses fade quickly from the given premises.',
        evaluationCriteria: ['logical_validity', 'clear_reasoning'],
        difficulty: 'medium',
        domain: 'logic'
      },
      {
        id: 'math_word_problem',
        type: TaskType.MATHEMATICS,
        description: 'Solve this word problem',
        input: 'A train travels 180 miles in 3 hours. At the same rate, how long will it take to travel 300 miles?',
        expectedOutput: '5 hours',
        evaluationCriteria: ['correct_answer', 'shown_work'],
        difficulty: 'easy',
        domain: 'mathematics'
      }
    ];
  }

  private createCreativityTasks(): Task[] {
    return [
      {
        id: 'creative_story',
        type: TaskType.CREATIVE_WRITING,
        description: 'Write a creative short story',
        input: 'Write a 200-word story about a time traveler who can only travel backwards in time by exactly 24 hours.',
        evaluationCriteria: ['originality', 'narrative_structure', 'creativity'],
        difficulty: 'medium',
        domain: 'creative_writing'
      },
      {
        id: 'invention_ideas',
        type: TaskType.PROBLEM_SOLVING,
        description: 'Generate innovative solutions',
        input: 'Come up with 3 creative solutions to reduce plastic waste in oceans.',
        evaluationCriteria: ['feasibility', 'creativity', 'impact'],
        difficulty: 'hard',
        domain: 'environmental'
      }
    ];
  }

  /**
   * Public methods for getting benchmarks and evaluation stats
   */
  public getBenchmark(id: string): Benchmark | undefined {
    return this.benchmarks.get(id);
  }

  public getEvaluationStats(): {
    cacheSize: number;
    benchmarksLoaded: number;
    totalEvaluations: number;
  } {
    return {
      cacheSize: this.evaluationCache.size,
      benchmarksLoaded: this.benchmarks.size,
      totalEvaluations: this.evaluationCache.size
    };
  }

  public clearCache(): void {
    this.evaluationCache.clear();
    log.info('Evaluation cache cleared', LogContext.AI);
  }
}

export const fitnessEvaluator = new FitnessEvaluator();
export default fitnessEvaluator;