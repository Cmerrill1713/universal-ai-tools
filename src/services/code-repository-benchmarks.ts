/**
 * Code Repository Benchmarks - ToolTrain-inspired Evaluation Framework
 * 
 * Implements comprehensive benchmarking for code search, repository navigation,
 * and multi-hop reasoning performance, following academic standards
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

import type { AgentContext, AgentResponse } from '@/types';
import { log, LogContext } from '@/utils/logger';

import { mcpIntegrationService } from './mcp-integration-service';
import { multiHopReasoningEngine } from './multi-hop-reasoning-engine';

// Benchmark suite types
interface BenchmarkTask {
  id: string;
  name: string;
  description: string;
  type: 'function_search' | 'class_search' | 'usage_finding' | 'dependency_tracing' | 'issue_localization';
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  repository: {
    name: string;
    language: string;
    size: 'small' | 'medium' | 'large' | 'enterprise';
    complexity: number; // 1-10 scale
  };
  query: string;
  expectedResults: Array<{
    file: string;
    line?: number;
    type: 'function' | 'class' | 'interface' | 'variable' | 'import' | 'usage';
    name: string;
    relevance: number; // 0-1 score
    isCorrect: boolean;
  }>;
  metadata: {
    maxDepth: number;
    timeLimit: number;
    multiHopRequired: boolean;
    toolsAllowed: string[];
    createdBy: string;
    validatedBy: string[];
  };
}

interface BenchmarkResult {
  taskId: string;
  agentName: string;
  startTime: number;
  endTime: number;
  success: boolean;
  foundResults: Array<{
    file: string;
    line?: number;
    type: string;
    name: string;
    confidence: number;
    relevance: number;
  }>;
  metrics: {
    precision: number;      // TP / (TP + FP)
    recall: number;         // TP / (TP + FN)
    f1Score: number;        // 2 * (precision * recall) / (precision + recall)
    accuracy: number;       // (TP + TN) / (TP + TN + FP + FN)
    mrr: number;           // Mean Reciprocal Rank
    recall_at_5: number;   // Recall@5 (ToolTrain's primary metric)
    recall_at_10: number;  // Recall@10
    search_efficiency: number; // Results found / search depth
    time_to_first_result: number; // ms
  };
  searchPath: Array<{
    step: number;
    action: string;
    tool: string;
    server: string;
    executionTime: number;
    resultsFound: number;
    reasoning: string;
  }>;
  toolsUsed: Array<{
    tool: string;
    server: string;
    usageCount: number;
    totalTime: number;
    successRate: number;
  }>;
  errors: string[];
  reasoning: string;
}

interface BenchmarkSuite {
  id: string;
  name: string;
  version: string;
  description: string;
  tasks: BenchmarkTask[];
  categories: Record<string, string[]>; // category -> task IDs
  metadata: {
    totalTasks: number;
    averageDifficulty: number;
    languageDistribution: Record<string, number>;
    sizeDistribution: Record<string, number>;
    createdAt: string;
    lastUpdated: string;
  };
}

interface BenchmarkReport {
  suiteId: string;
  agentName: string;
  runId: string;
  startTime: number;
  endTime: number;
  totalTasks: number;
  completedTasks: number;
  overallMetrics: {
    averagePrecision: number;
    averageRecall: number;
    averageF1: number;
    averageRecall_at_5: number;
    averageRecall_at_10: number;
    averageEfficiency: number;
    averageTimePerTask: number;
    successRate: number;
  };
  categoryPerformance: Record<string, {
    taskCount: number;
    avgPrecision: number;
    avgRecall: number;
    avgF1: number;
    avgRecall_at_5: number;
    successRate: number;
  }>;
  difficultyPerformance: Record<string, {
    taskCount: number;
    avgRecall_at_5: number;
    successRate: number;
    avgEfficiency: number;
  }>;
  toolPerformance: Record<string, {
    usageCount: number;
    avgSuccessRate: number;
    avgExecutionTime: number;
    contribution: number; // How much this tool contributed to overall success
  }>;
  results: BenchmarkResult[];
  recommendations: string[];
}

const BenchmarkTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['function_search', 'class_search', 'usage_finding', 'dependency_tracing', 'issue_localization']),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  repository: z.object({
    name: z.string(),
    language: z.string(),
    size: z.enum(['small', 'medium', 'large', 'enterprise']),
    complexity: z.number().min(1).max(10),
  }),
  query: z.string(),
  expectedResults: z.array(z.object({
    file: z.string(),
    line: z.number().optional(),
    type: z.enum(['function', 'class', 'interface', 'variable', 'import', 'usage']),
    name: z.string(),
    relevance: z.number().min(0).max(1),
    isCorrect: z.boolean(),
  })),
  metadata: z.object({
    maxDepth: z.number().min(1).max(20),
    timeLimit: z.number().min(1000).max(300000),
    multiHopRequired: z.boolean(),
    toolsAllowed: z.array(z.string()),
    createdBy: z.string(),
    validatedBy: z.array(z.string()),
  }),
});

/**
 * Code Repository Benchmarking Service
 */
export class CodeRepositoryBenchmarks extends EventEmitter {
  private benchmarkSuites: Map<string, BenchmarkSuite> = new Map();
  private benchmarkHistory: Map<string, BenchmarkReport[]> = new Map();
  private defaultSuites: BenchmarkSuite[] = [];

  constructor() {
    super();
    this.initializeDefaultBenchmarks();
    log.info('Code repository benchmarks initialized', LogContext.AI);
  }

  /**
   * Run a complete benchmark suite against an agent
   */
  async runBenchmarkSuite(
    suiteId: string,
    agentName: string,
    options: {
      sampleSize?: number; // Run subset of tasks for quick evaluation
      categories?: string[]; // Only run specific categories
      difficulties?: string[]; // Only run specific difficulties
      timeoutMultiplier?: number; // Adjust timeouts
      enableParallelExecution?: boolean;
    } = {}
  ): Promise<BenchmarkReport> {
    const suite = this.benchmarkSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Benchmark suite ${suiteId} not found`);
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    log.info('🏁 Starting benchmark suite execution', LogContext.AI, {
      suiteId,
      agentName,
      runId,
      totalTasks: suite.tasks.length,
      options,
    });

    // Filter tasks based on options
    let tasksToRun = [...suite.tasks];

    if (options.categories) {
      const categoryTaskIds = new Set();
      for (const category of options.categories) {
        if (suite.categories[category]) {
          suite.categories[category].forEach(id => categoryTaskIds.add(id));
        }
      }
      tasksToRun = tasksToRun.filter(task => categoryTaskIds.has(task.id));
    }

    if (options.difficulties) {
      tasksToRun = tasksToRun.filter(task => options.difficulties!.includes(task.difficulty));
    }

    if (options.sampleSize && options.sampleSize < tasksToRun.length) {
      // Stratified sampling to maintain difficulty distribution
      tasksToRun = this.stratifiedSample(tasksToRun, options.sampleSize);
    }

    // Execute tasks
    const results: BenchmarkResult[] = [];
    let completedTasks = 0;

    if (options.enableParallelExecution) {
      // Parallel execution for faster benchmarking
      const batches = this.createTaskBatches(tasksToRun, 3); // 3 concurrent tasks
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(task => this.executeBenchmarkTask(task, agentName, options))
        );
        results.push(...batchResults);
        completedTasks += batchResults.length;
        
        this.emit('progress', {
          runId,
          completed: completedTasks,
          total: tasksToRun.length,
          currentBatch: batchResults,
        });
      }
    } else {
      // Sequential execution for more controlled testing
      for (const task of tasksToRun) {
        try {
          const result = await this.executeBenchmarkTask(task, agentName, options);
          results.push(result);
          completedTasks++;
          
          this.emit('progress', {
            runId,
            completed: completedTasks,
            total: tasksToRun.length,
            currentResult: result,
          });
        } catch (error) {
          log.error('Benchmark task execution failed', LogContext.AI, {
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Generate comprehensive report
    const report = this.generateBenchmarkReport(
      suite,
      agentName,
      runId,
      startTime,
      Date.now(),
      results
    );

    // Store results
    const agentHistory = this.benchmarkHistory.get(agentName) || [];
    agentHistory.push(report);
    this.benchmarkHistory.set(agentName, agentHistory);

    // Keep only recent history (last 20 runs)
    if (agentHistory.length > 20) {
      this.benchmarkHistory.set(agentName, agentHistory.slice(-20));
    }

    log.info('✅ Benchmark suite completed', LogContext.AI, {
      runId,
      completedTasks: results.length,
      successRate: report.overallMetrics.successRate,
      avgRecall_at_5: report.overallMetrics.averageRecall_at_5,
      totalTime: report.endTime - report.startTime,
    });

    this.emit('completed', report);
    return report;
  }

  /**
   * Execute a single benchmark task
   */
  private async executeBenchmarkTask(
    task: BenchmarkTask,
    agentName: string,
    options: any
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    const timeLimit = (task.metadata.timeLimit || 30000) * (options.timeoutMultiplier || 1);
    
    log.debug('Executing benchmark task', LogContext.AI, {
      taskId: task.id,
      agentName,
      timeLimit,
    });

    try {
      // Create agent context
      const context: AgentContext = {
        userRequest: task.query,
        requestId: `benchmark-${task.id}`,
        metadata: {
          benchmarkTask: true,
          taskId: task.id,
          repository: task.repository,
          maxDepth: task.metadata.maxDepth,
          toolsAllowed: task.metadata.toolsAllowed,
        },
      };

      // Execute search using multi-hop reasoning engine
      const searchResult = await Promise.race([
        multiHopReasoningEngine.explore(task.query, context),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), timeLimit)
        ),
      ]) as any;

      const endTime = Date.now();

      // Extract found results
      const foundResults = this.extractFoundResults(searchResult);

      // Calculate metrics
      const metrics = this.calculateBenchmarkMetrics(task.expectedResults, foundResults);

      // Build search path from reasoning trace
      const searchPath = this.buildSearchPath(searchResult.reasoningTrace || []);

      // Analyze tool usage
      const toolsUsed = this.analyzeToolUsage(searchResult);

      const result: BenchmarkResult = {
        taskId: task.id,
        agentName,
        startTime,
        endTime,
        success: metrics.recall_at_5 > 0.5, // Consider successful if Recall@5 > 0.5
        foundResults,
        metrics,
        searchPath,
        toolsUsed,
        errors: [],
        reasoning: searchResult.reasoningTrace?.map((trace: any) => trace.reasoning).join(' → ') || '',
      };

      return result;
    } catch (error) {
      const endTime = Date.now();
      
      return {
        taskId: task.id,
        agentName,
        startTime,
        endTime,
        success: false,
        foundResults: [],
        metrics: {
          precision: 0,
          recall: 0,
          f1Score: 0,
          accuracy: 0,
          mrr: 0,
          recall_at_5: 0,
          recall_at_10: 0,
          search_efficiency: 0,
          time_to_first_result: endTime - startTime,
        },
        searchPath: [],
        toolsUsed: [],
        errors: [error instanceof Error ? error.message : String(error)],
        reasoning: 'Task failed due to error',
      };
    }
  }

  /**
   * Calculate comprehensive benchmark metrics
   */
  private calculateBenchmarkMetrics(
    expectedResults: BenchmarkTask['expectedResults'],
    foundResults: BenchmarkResult['foundResults']
  ): BenchmarkResult['metrics'] {
    const expectedCorrect = expectedResults.filter(r => r.isCorrect);
    const foundRelevant = foundResults.filter(f => f.relevance >= 0.5);
    
    // True Positives: Found results that match expected correct results
    const truePositives = foundResults.filter(found =>
      expectedCorrect.some(expected =>
        expected.file === found.file &&
        expected.name === found.name &&
        Math.abs((expected.line || 0) - (found.line || 0)) <= 2 // Allow 2 line difference
      )
    );

    const tp = truePositives.length;
    const fp = foundResults.length - tp;
    const fn = expectedCorrect.length - tp;
    const tn = Math.max(0, 100 - tp - fp - fn); // Assume 100 total possible results

    // Basic metrics
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const accuracy = (tp + tn) / (tp + tn + fp + fn);

    // Ranking metrics
    const mrr = this.calculateMRR(expectedCorrect, foundResults);
    const recall_at_5 = this.calculateRecallAtK(expectedCorrect, foundResults, 5);
    const recall_at_10 = this.calculateRecallAtK(expectedCorrect, foundResults, 10);

    // Efficiency metrics
    const search_efficiency = foundResults.length > 0 ? tp / foundResults.length : 0;
    const time_to_first_result = foundResults.length > 0 ? 500 : 0; // Mock - would be actual timing

    return {
      precision,
      recall,
      f1Score,
      accuracy,
      mrr,
      recall_at_5,
      recall_at_10,
      search_efficiency,
      time_to_first_result,
    };
  }

  /**
   * Calculate Mean Reciprocal Rank (MRR)
   */
  private calculateMRR(
    expectedResults: BenchmarkTask['expectedResults'],
    foundResults: BenchmarkResult['foundResults']
  ): number {
    const expectedCorrect = expectedResults.filter(r => r.isCorrect);
    let totalReciprocalRank = 0;
    let queryCount = 0;

    for (const expected of expectedCorrect) {
      const rank = foundResults.findIndex(found =>
        expected.file === found.file &&
        expected.name === found.name &&
        Math.abs((expected.line || 0) - (found.line || 0)) <= 2
      );

      if (rank >= 0) {
        totalReciprocalRank += 1 / (rank + 1);
      }
      queryCount++;
    }

    return queryCount > 0 ? totalReciprocalRank / queryCount : 0;
  }

  /**
   * Calculate Recall@K (primary ToolTrain metric)
   */
  private calculateRecallAtK(
    expectedResults: BenchmarkTask['expectedResults'],
    foundResults: BenchmarkResult['foundResults'],
    k: number
  ): number {
    const expectedCorrect = expectedResults.filter(r => r.isCorrect);
    const topKFound = foundResults.slice(0, k);
    
    const foundInTopK = expectedCorrect.filter(expected =>
      topKFound.some(found =>
        expected.file === found.file &&
        expected.name === found.name &&
        Math.abs((expected.line || 0) - (found.line || 0)) <= 2
      )
    );

    return expectedCorrect.length > 0 ? foundInTopK.length / expectedCorrect.length : 0;
  }

  /**
   * Initialize default benchmark suites
   */
  private async initializeDefaultBenchmarks(): Promise<void> {
    // ToolTrain-inspired benchmark suite
    const toolTrainSuite: BenchmarkSuite = {
      id: 'tooltrain-inspired',
      name: 'ToolTrain-Inspired Code Search Benchmark',
      version: '1.0.0',
      description: 'Comprehensive code search and repository navigation benchmarks inspired by ByteDance ToolTrain',
      tasks: [
        {
          id: 'ts-func-search-1',
          name: 'TypeScript Function Search - Easy',
          description: 'Find a simple exported function by name',
          type: 'function_search',
          difficulty: 'easy',
          repository: {
            name: 'typescript-utils',
            language: 'typescript',
            size: 'small',
            complexity: 3,
          },
          query: 'find function calculateSum',
          expectedResults: [
            {
              file: 'src/math/calculator.ts',
              line: 15,
              type: 'function',
              name: 'calculateSum',
              relevance: 1.0,
              isCorrect: true,
            },
          ],
          metadata: {
            maxDepth: 3,
            timeLimit: 10000,
            multiHopRequired: false,
            toolsAllowed: ['search_code', 'read_file'],
            createdBy: 'benchmark-system',
            validatedBy: ['system'],
          },
        },
        {
          id: 'ts-class-search-1',
          name: 'TypeScript Class Search - Medium',
          description: 'Find a class and its inheritance hierarchy',
          type: 'class_search',
          difficulty: 'medium',
          repository: {
            name: 'typescript-framework',
            language: 'typescript',
            size: 'medium',
            complexity: 6,
          },
          query: 'find class BaseComponent and its inheritance',
          expectedResults: [
            {
              file: 'src/components/BaseComponent.ts',
              line: 8,
              type: 'class',
              name: 'BaseComponent',
              relevance: 1.0,
              isCorrect: true,
            },
            {
              file: 'src/components/Button.ts',
              line: 12,
              type: 'class',
              name: 'Button',
              relevance: 0.8,
              isCorrect: true,
            },
          ],
          metadata: {
            maxDepth: 5,
            timeLimit: 20000,
            multiHopRequired: true,
            toolsAllowed: ['search_code', 'analyze_class', 'trace_imports'],
            createdBy: 'benchmark-system',
            validatedBy: ['system'],
          },
        },
        {
          id: 'usage-finding-1',
          name: 'Function Usage Finding - Hard',
          description: 'Find all usages of a specific function across the codebase',
          type: 'usage_finding',
          difficulty: 'hard',
          repository: {
            name: 'large-enterprise-app',
            language: 'typescript',
            size: 'large',
            complexity: 8,
          },
          query: 'find all usages of function authenticateUser',
          expectedResults: [
            {
              file: 'src/auth/AuthService.ts',
              line: 45,
              type: 'usage',
              name: 'authenticateUser',
              relevance: 1.0,
              isCorrect: true,
            },
            {
              file: 'src/middleware/auth.ts',
              line: 23,
              type: 'usage',
              name: 'authenticateUser',
              relevance: 1.0,
              isCorrect: true,
            },
            {
              file: 'src/routes/api.ts',
              line: 67,
              type: 'usage',
              name: 'authenticateUser',
              relevance: 0.9,
              isCorrect: true,
            },
          ],
          metadata: {
            maxDepth: 8,
            timeLimit: 30000,
            multiHopRequired: true,
            toolsAllowed: ['search_code', 'find_usages', 'analyze_function'],
            createdBy: 'benchmark-system',
            validatedBy: ['system'],
          },
        },
      ],
      categories: {
        'function-search': ['ts-func-search-1'],
        'class-analysis': ['ts-class-search-1'],
        'usage-analysis': ['usage-finding-1'],
      },
      metadata: {
        totalTasks: 3,
        averageDifficulty: 2.3,
        languageDistribution: { typescript: 3 },
        sizeDistribution: { small: 1, medium: 1, large: 1 },
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      },
    };

    this.benchmarkSuites.set(toolTrainSuite.id, toolTrainSuite);
    this.defaultSuites.push(toolTrainSuite);

    log.info('Default benchmark suites initialized', LogContext.AI, {
      suiteCount: this.defaultSuites.length,
      totalTasks: this.defaultSuites.reduce((sum, suite) => sum + suite.tasks.length, 0),
    });
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateBenchmarkReport(
    suite: BenchmarkSuite,
    agentName: string,
    runId: string,
    startTime: number,
    endTime: number,
    results: BenchmarkResult[]
  ): BenchmarkReport {
    const successfulResults = results.filter(r => r.success);
    
    // Overall metrics
    const overallMetrics = {
      averagePrecision: this.average(results.map(r => r.metrics.precision)),
      averageRecall: this.average(results.map(r => r.metrics.recall)),
      averageF1: this.average(results.map(r => r.metrics.f1Score)),
      averageRecall_at_5: this.average(results.map(r => r.metrics.recall_at_5)),
      averageRecall_at_10: this.average(results.map(r => r.metrics.recall_at_10)),
      averageEfficiency: this.average(results.map(r => r.metrics.search_efficiency)),
      averageTimePerTask: this.average(results.map(r => r.endTime - r.startTime)),
      successRate: results.length > 0 ? successfulResults.length / results.length : 0,
    };

    // Category performance
    const categoryPerformance: Record<string, any> = {};
    for (const [category, taskIds] of Object.entries(suite.categories)) {
      const categoryResults = results.filter(r => taskIds.includes(r.taskId));
      if (categoryResults.length > 0) {
        categoryPerformance[category] = {
          taskCount: categoryResults.length,
          avgPrecision: this.average(categoryResults.map(r => r.metrics.precision)),
          avgRecall: this.average(categoryResults.map(r => r.metrics.recall)),
          avgF1: this.average(categoryResults.map(r => r.metrics.f1Score)),
          avgRecall_at_5: this.average(categoryResults.map(r => r.metrics.recall_at_5)),
          successRate: categoryResults.filter(r => r.success).length / categoryResults.length,
        };
      }
    }

    // Tool performance analysis
    const toolUsageMap = new Map<string, { usage: number; success: number; time: number }>();
    for (const result of results) {
      for (const tool of result.toolsUsed) {
        const key = `${tool.server}:${tool.tool}`;
        const current = toolUsageMap.get(key) || { usage: 0, success: 0, time: 0 };
        current.usage += tool.usageCount;
        current.success += tool.successRate * tool.usageCount;
        current.time += tool.totalTime;
        toolUsageMap.set(key, current);
      }
    }

    const toolPerformance: Record<string, any> = {};
    for (const [toolKey, stats] of toolUsageMap.entries()) {
      toolPerformance[toolKey] = {
        usageCount: stats.usage,
        avgSuccessRate: stats.usage > 0 ? stats.success / stats.usage : 0,
        avgExecutionTime: stats.usage > 0 ? stats.time / stats.usage : 0,
        contribution: this.calculateToolContribution(toolKey, results),
      };
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(overallMetrics, categoryPerformance, toolPerformance);

    return {
      suiteId: suite.id,
      agentName,
      runId,
      startTime,
      endTime,
      totalTasks: suite.tasks.length,
      completedTasks: results.length,
      overallMetrics,
      categoryPerformance,
      difficultyPerformance: {}, // TODO: Implement difficulty analysis
      toolPerformance,
      results,
      recommendations,
    };
  }

  // Helper methods
  private extractFoundResults(searchResult: any): BenchmarkResult['foundResults'] {
    const results = [];
    
    if (searchResult.paths) {
      for (const path of searchResult.paths) {
        for (const node of path.nodes) {
          results.push({
            file: node.location.file,
            line: node.location.line,
            type: node.type,
            name: node.name,
            confidence: path.confidence,
            relevance: node.relevanceScore,
          });
        }
      }
    }
    
    return results;
  }

  private buildSearchPath(reasoningTrace: any[]): BenchmarkResult['searchPath'] {
    return reasoningTrace.map((trace, index) => ({
      step: trace.step || index + 1,
      action: trace.action,
      tool: trace.action.split('_')[0] || 'unknown',
      server: 'code-search',
      executionTime: 1000, // Mock timing
      resultsFound: 0, // Would be extracted from trace
      reasoning: trace.reasoning,
    }));
  }

  private analyzeToolUsage(searchResult: any): BenchmarkResult['toolsUsed'] {
    const toolStats = new Map();
    
    // Analyze tools from search result (mock implementation)
    const tools = ['search_code', 'analyze_function', 'trace_imports'];
    
    return tools.map(tool => ({
      tool,
      server: 'code-search',
      usageCount: 1,
      totalTime: 1000,
      successRate: 0.8,
    }));
  }

  private stratifiedSample(tasks: BenchmarkTask[], sampleSize: number): BenchmarkTask[] {
    // Simple stratified sampling by difficulty
    const byDifficulty = tasks.reduce((acc, task) => {
      const difficulty = task.difficulty || 'unknown';
      if (!acc[difficulty]) {acc[difficulty] = [];}
      acc[difficulty].push(task);
      return acc;
    }, {} as Record<string, BenchmarkTask[]>);

    const sampled = [];
    const difficultiesCount = Object.keys(byDifficulty).length;
    const perDifficulty = Math.ceil(sampleSize / difficultiesCount);

    for (const [difficulty, difficultyTasks] of Object.entries(byDifficulty)) {
      const shuffled = difficultyTasks.sort(() => Math.random() - 0.5);
      sampled.push(...shuffled.slice(0, perDifficulty));
    }

    return sampled.slice(0, sampleSize);
  }

  private createTaskBatches(tasks: BenchmarkTask[], batchSize: number): BenchmarkTask[][] {
    const batches = [];
    for (let i = 0; i < tasks.length; i += batchSize) {
      batches.push(tasks.slice(i, i + batchSize));
    }
    return batches;
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length : 0;
  }

  private calculateToolContribution(toolKey: string, results: BenchmarkResult[]): number {
    // Calculate how much this tool contributed to successful results
    const toolResults = results.filter(r => 
      r.toolsUsed.some(t => `${t.server}:${t.tool}` === toolKey)
    );
    const successfulToolResults = toolResults.filter(r => r.success);
    
    return toolResults.length > 0 ? successfulToolResults.length / toolResults.length : 0;
  }

  private generateRecommendations(
    overallMetrics: any,
    categoryPerformance: any,
    toolPerformance: any
  ): string[] {
    const recommendations = [];

    if (overallMetrics.averageRecall_at_5 < 0.6) {
      recommendations.push('Consider improving search relevance - Recall@5 is below 60%');
    }

    if (overallMetrics.averageEfficiency < 0.4) {
      recommendations.push('Search efficiency is low - consider optimizing tool sequence selection');
    }

    if (overallMetrics.averageTimePerTask > 20000) {
      recommendations.push('Average task time is high - consider performance optimization');
    }

    // Tool-specific recommendations
    for (const [tool, performance] of Object.entries(toolPerformance)) {
      if ((performance as any).avgSuccessRate < 0.5) {
        recommendations.push(`Tool ${tool} has low success rate - consider retraining or replacement`);
      }
    }

    return recommendations;
  }

  /**
   * Public API methods
   */

  async loadBenchmarkSuite(suiteData: BenchmarkSuite): Promise<void> {
    // Validate suite data
    const validatedSuite = {
      ...suiteData,
      tasks: suiteData.tasks.map(task => BenchmarkTaskSchema.parse(task))
    };
    
    this.benchmarkSuites.set(validatedSuite.id, validatedSuite);
    log.info('Benchmark suite loaded', LogContext.AI, { suiteId: validatedSuite.id });
  }

  getBenchmarkSuite(suiteId: string): BenchmarkSuite | undefined {
    return this.benchmarkSuites.get(suiteId);
  }

  listBenchmarkSuites(): Array<{ id: string; name: string; taskCount: number }> {
    return Array.from(this.benchmarkSuites.values()).map(suite => ({
      id: suite.id,
      name: suite.name,
      taskCount: suite.tasks.length,
    }));
  }

  getAgentBenchmarkHistory(agentName: string): BenchmarkReport[] {
    return this.benchmarkHistory.get(agentName) || [];
  }

  getBenchmarkComparison(agentNames: string[]): Record<string, any> {
    const comparison: Record<string, any> = {};
    
    for (const agentName of agentNames) {
      const history = this.getAgentBenchmarkHistory(agentName);
      if (history.length > 0) {
        const latest = history[history.length - 1];
        if (latest && latest.overallMetrics) {
          comparison[agentName] = {
            latestRun: latest.runId,
            recall_at_5: latest.overallMetrics.averageRecall_at_5,
            successRate: latest.overallMetrics.successRate,
            averageTime: latest.overallMetrics.averageTimePerTask,
            runsCount: history.length,
          };
        }
      }
    }
    
    return comparison;
  }
}

// Export singleton instance
export const codeRepositoryBenchmarks = new CodeRepositoryBenchmarks();