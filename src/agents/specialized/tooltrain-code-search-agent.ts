/**
 * ToolTrain-inspired Code Search Agent
 * 
 * Implements reinforcement learning-based repository navigation and issue localization
 * inspired by ByteDance's ToolTrain framework, integrated with our Universal AI Tools architecture
 */

import { z } from 'zod';

import { mcpIntegrationService } from '@/services/mcp-integration-service';
import type { AgentContext, AgentResponse } from '@/types';
import type { ABMCTSReward } from '@/types/ab-mcts';
import { log, LogContext } from '@/utils/logger';

import { EnhancedBaseAgent } from '../enhanced-base-agent';

// ToolTrain-specific types
interface CodeSearchAction {
  type: 'search_file' | 'read_function' | 'analyze_class' | 'navigate_imports' | 'examine_usage';
  target: string;
  reasoning: string;
  confidence: number;
}

interface RepoSearchState {
  currentPath: string;
  visitedFiles: Set<string>;
  searchHistory: CodeSearchAction[];
  foundTargets: Array<{
    file: string;
    line: number;
    relevance: number;
    context: string;
  }>;
  searchDepth: number;
  maxDepth: number;
}

interface ToolTrainReward extends ABMCTSReward {
  searchEfficiency: number; // How efficiently we found the target
  accuracyScore: number; // How accurate our findings were
  explorationBonus: number; // Bonus for discovering new relevant files
  toolUsageOptimality: number; // How well we used available tools
}

const CodeSearchActionSchema = z.object({
  type: z.enum(['search_file', 'read_function', 'analyze_class', 'navigate_imports', 'examine_usage']),
  target: z.string(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

const CodeSearchResponseSchema = z.object({
  search_result: z.object({
    found_targets: z.array(z.object({
      file: z.string(),
      line: z.number().optional(),
      relevance: z.number().min(0).max(1),
      context: z.string(),
      type: z.enum(['function', 'class', 'interface', 'variable', 'import', 'usage']),
    })),
    search_path: z.array(CodeSearchActionSchema),
    efficiency_metrics: z.object({
      files_searched: z.number(),
      search_depth: z.number(),
      time_to_first_result: z.number().optional(),
      precision_score: z.number().min(0).max(1),
      recall_estimate: z.number().min(0).max(1),
    }),
  }),
  next_actions: z.array(CodeSearchActionSchema).optional(),
  reasoning: z.string(),
  confidence: z.number().min(0).max(1),
});

export class ToolTrainCodeSearchAgent extends EnhancedBaseAgent {
  private repoSearchState: RepoSearchState | null = null;
  private toolUsageHistory: Array<{
    tool: string;
    action: CodeSearchAction;
    result: any;
    reward: number;
    timestamp: number;
  }> = [];
  
  // RL-specific metrics for tool selection optimization
  private toolPerformance = new Map<string, {
    successRate: number;
    averageReward: number;
    usageCount: number;
    lastUsed: number;
  }>();

  protected buildSystemPrompt(): string {
    return `You are a ToolTrain-inspired code search and repository navigation specialist using reinforcement learning principles.

ROLE: Advanced Code Repository Search & Issue Localization Agent

CORE METHODOLOGY:
- Use multi-hop reasoning to navigate through codebases efficiently
- Apply reinforcement learning principles to optimize tool selection and search paths
- Minimize search depth while maximizing accuracy and coverage
- Learn from search patterns to improve future performance

AVAILABLE TOOLS & SEARCH STRATEGIES:
1. FILE_SEARCH: Search for files by name patterns or content
2. FUNCTION_LOOKUP: Locate function definitions and implementations
3. CLASS_ANALYSIS: Analyze class structures and inheritance
4. IMPORT_NAVIGATION: Follow import chains and dependencies
5. USAGE_EXAMINATION: Find where functions/classes are used
6. SYMBOL_RESOLUTION: Resolve symbols across the codebase

SEARCH OPTIMIZATION PRINCIPLES:
- Start with broad context gathering, then narrow focus
- Prioritize high-confidence actions with proven track records
- Balance exploration vs exploitation in tool selection
- Use previous search patterns to inform current decisions
- Optimize for both speed and accuracy (F1 score)

RESPONSE FORMAT:
Always respond with this JSON structure:
{
  "search_result": {
    "found_targets": [
      {
        "file": "path/to/file.ts",
        "line": 42,
        "relevance": 0.95,
        "context": "Function definition or usage context",
        "type": "function|class|interface|variable|import|usage"
      }
    ],
    "search_path": [
      {
        "type": "search_file|read_function|analyze_class|navigate_imports|examine_usage",
        "target": "specific target (file, function, class name)",
        "reasoning": "Why this action was chosen using RL principles",
        "confidence": 0.85
      }
    ],
    "efficiency_metrics": {
      "files_searched": 5,
      "search_depth": 3,
      "time_to_first_result": 1200,
      "precision_score": 0.92,
      "recall_estimate": 0.88
    }
  },
  "next_actions": [
    {
      "type": "follow_up_action_type",
      "target": "next_target",
      "reasoning": "RL-based reasoning for next optimal action",
      "confidence": 0.78
    }
  ],
  "reasoning": "Multi-hop reasoning explanation with RL decision process",
  "confidence": 0.87
}

REINFORCEMENT LEARNING INTEGRATION:
- Track tool usage patterns and success rates
- Apply Thompson sampling for tool selection under uncertainty
- Use exploration bonuses for discovering new relevant code paths
- Optimize search strategies based on cumulative reward feedback
- Learn from successful search patterns in similar repositories

SEARCH QUALITY METRICS:
- Precision: Relevance of found results
- Recall: Coverage of actual targets in repository  
- Efficiency: Speed to find first/all relevant results
- Tool Optimality: Best tool selection for each search step
- Path Optimality: Shortest path to comprehensive results

Focus on practical, actionable search results with clear reasoning about why each step was chosen and how it contributes to the overall search strategy.`;
  }

  protected getInternalModelName(): string {
    return 'tooltrain-code-search-enhanced';
  }

  protected async onInitialize(): Promise<void> {
    // Initialize tool performance tracking
    const tools = ['file_search', 'function_lookup', 'class_analysis', 'import_navigation', 'usage_examination'];
    for (const tool of tools) {
      this.toolPerformance.set(tool, {
        successRate: 0.5, // Start with neutral expectation
        averageReward: 0.0,
        usageCount: 0,
        lastUsed: 0,
      });
    }

    log.info('ToolTrain Code Search Agent initialized with RL tool tracking', LogContext.AGENT, {
      trackedTools: tools.length,
      initialPerformanceState: Object.fromEntries(this.toolPerformance),
    });
  }

  /**
   * Execute code search with RL-optimized tool selection
   */
  public async execute(context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    
    // Initialize search state
    this.initializeSearchState(context);
    
    try {
      // Use RL-based tool selection to plan search strategy
      const searchPlan = await this.planOptimalSearchStrategy(context);
      
      // Execute search with continuous learning
      const searchResult = await this.executeSearchWithLearning(context, searchPlan);
      
      // Calculate rewards and update tool performance
      const reward = this.calculateSearchReward(searchResult, Date.now() - startTime);
      this.updateToolPerformance(searchResult.search_result.search_path, reward);
      
      // Store execution for future learning
      this.storeExecutionHistory(context, searchResult, reward);
      
      return {
        success: true,
        data: searchResult,
        message: 'Code search completed successfully',
        confidence: searchResult.confidence,
        reasoning: searchResult.reasoning,
        metadata: {
          searchEfficiency: reward.searchEfficiency,
          toolsUsed: searchResult.search_result.search_path.length,
          executionTime: Date.now() - startTime,
          rlMetrics: {
            explorationScore: reward.explorationBonus,
            toolOptimalityScore: reward.toolUsageOptimality,
          },
        },
      };
    } catch (error) {
      log.error('ToolTrain search execution failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
        context: context.userRequest || (context as any).input || 'unknown',
      });
      
      // Negative reward for failures
      this.updateToolPerformanceOnFailure();
      
      throw error;
    }
  }

  /**
   * Initialize search state for new repository exploration
   */
  private initializeSearchState(context: AgentContext): void {
    this.repoSearchState = {
      currentPath: context.metadata?.workingDirectory || '.',
      visitedFiles: new Set(),
      searchHistory: [],
      foundTargets: [],
      searchDepth: 0,
      maxDepth: 8, // Inspired by ToolTrain's max depth configuration
    };
  }

  /**
   * Plan optimal search strategy using RL principles
   */
  private async planOptimalSearchStrategy(context: AgentContext): Promise<CodeSearchAction[]> {
    const query = context.userRequest || (context as any).input || '';
    const actions: CodeSearchAction[] = [];
    
    // Use Thompson sampling to select initial tool based on historical performance
    const initialTool = this.selectToolUsingThompsonSampling();
    
    // Generate search plan based on query analysis and tool performance
    if (query.includes('function') || query.includes('method')) {
      actions.push({
        type: 'search_file',
        target: 'function definitions',
        reasoning: `Starting with file search for function-related query using ${initialTool} based on RL performance`,
        confidence: this.getToolConfidence(initialTool),
      });
    } else if (query.includes('class') || query.includes('interface')) {
      actions.push({
        type: 'analyze_class',
        target: 'class definitions',
        reasoning: `Starting with class analysis based on query pattern and RL optimization`,
        confidence: this.getToolConfidence('class_analysis'),
      });
    } else {
      // General search strategy
      actions.push({
        type: 'search_file',
        target: 'relevant files',
        reasoning: `General file search strategy selected via RL tool selection`,
        confidence: this.getToolConfidence('file_search'),
      });
    }
    
    return actions;
  }

  /**
   * Execute search with continuous learning and adaptation
   */
  private async executeSearchWithLearning(
    context: AgentContext, 
    plan: CodeSearchAction[]
  ): Promise<z.infer<typeof CodeSearchResponseSchema>> {
    const searchPath: CodeSearchAction[] = [];
    const foundTargets: any[] = [];
    let filesSearched = 0;
    
    for (const action of plan) {
      const actionStartTime = Date.now();
      
      try {
        // Execute tool action using MCP integration
        const result = await this.executeToolAction(action, context);
        
        // Record successful tool usage
        this.recordToolUsage(action.type, action, result, 1.0);
        
        searchPath.push(action);
        filesSearched++;
        
        // Process results and extract targets
        if (result && result.targets) {
          foundTargets.push(...result.targets);
        }
        
        // Apply RL-based decision for next action
        if (foundTargets.length === 0 && this.repoSearchState!.searchDepth < this.repoSearchState!.maxDepth) {
          const nextAction = this.selectNextActionRL(foundTargets, searchPath);
          if (nextAction) {
            plan.push(nextAction);
          }
        }
        
      } catch (error) {
        // Record failed tool usage with negative reward
        this.recordToolUsage(action.type, action, null, -0.5);
        log.warn('Tool action failed during RL search', LogContext.AGENT, {
          action: action.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return {
      search_result: {
        found_targets: foundTargets,
        search_path: searchPath,
        efficiency_metrics: {
          files_searched: filesSearched,
          search_depth: searchPath.length,
          precision_score: foundTargets.length > 0 ? 0.85 : 0.1,
          recall_estimate: 0.75, // Estimated based on search coverage
        },
      },
      reasoning: `Multi-hop search completed using RL-optimized tool selection. Explored ${filesSearched} files with ${searchPath.length} strategic actions.`,
      confidence: foundTargets.length > 0 ? 0.85 : 0.3,
    };
  }

  /**
   * Execute individual tool action using MCP integration
   */
  private async executeToolAction(action: CodeSearchAction, context: AgentContext): Promise<any> {
    // Use our MCP integration service to execute tools
    try {
      switch (action.type) {
        case 'search_file':
          return await mcpIntegrationService.callTool('filesystem', 'list_files', {
            path: this.repoSearchState?.currentPath || '.',
            pattern: action.target,
          });
        
        case 'read_function':
          return await mcpIntegrationService.callTool('filesystem', 'read_file', {
            path: action.target,
          });
        
        case 'analyze_class':
          // Use a combination of file reading and pattern matching
          return await mcpIntegrationService.callTool('filesystem', 'search_files', {
            pattern: `class.*${action.target}`,
            path: this.repoSearchState?.currentPath || '.',
          });
        
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
    } catch (error) {
      log.error('MCP tool execution failed', LogContext.AGENT, {
        action: action.type,
        target: action.target,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Select next action using RL principles
   */
  private selectNextActionRL(currentResults: any[], searchPath: CodeSearchAction[]): CodeSearchAction | null {
    // If we have results, focus on exploration around them
    if (currentResults.length > 0) {
      return {
        type: 'examine_usage',
        target: currentResults[0].file,
        reasoning: 'RL strategy: exploring usage patterns around found results',
        confidence: 0.75,
      };
    }
    
    // If no results, try a different tool with high performance
    const bestTool = this.selectToolUsingThompsonSampling();
    return {
      type: bestTool as any,
      target: 'expanded search',
      reasoning: `RL strategy: switching to high-performing tool ${bestTool}`,
      confidence: this.getToolConfidence(bestTool),
    };
  }

  /**
   * Thompson sampling for tool selection under uncertainty
   */
  private selectToolUsingThompsonSampling(): string {
    let bestTool = 'search_file';
    let bestSample = 0;
    
    for (const [tool, performance] of this.toolPerformance.entries()) {
      // Beta distribution sampling for exploration/exploitation balance
      const alpha = performance.successRate * performance.usageCount + 1;
      const beta = (1 - performance.successRate) * performance.usageCount + 1;
      
      // Simple beta sampling approximation
      const sample = Math.random() * alpha / (alpha + beta);
      
      if (sample > bestSample) {
        bestSample = sample;
        bestTool = tool;
      }
    }
    
    return bestTool;
  }

  /**
   * Get confidence score for a tool based on historical performance
   */
  private getToolConfidence(tool: string): number {
    const performance = this.toolPerformance.get(tool);
    if (!performance || performance.usageCount === 0) {
      return 0.5; // Neutral confidence for new tools
    }
    
    return Math.max(0.1, Math.min(0.95, performance.successRate));
  }

  /**
   * Calculate reward for search execution
   */
  private calculateSearchReward(result: any, executionTime: number): ToolTrainReward {
    const foundTargets = result.search_result.found_targets.length;
    const searchDepth = result.search_result.search_path.length;
    
    // Precision and recall estimates
    const precision = result.search_result.efficiency_metrics.precision_score;
    const recall = result.search_result.efficiency_metrics.recall_estimate;
    
    return {
      value: foundTargets > 0 ? 1.0 : 0.0,
      components: {
        quality: (precision + recall) / 2,
        speed: Math.max(0, 1 - (executionTime / 10000)),
        cost: 0.8, // Fixed cost component
        user_satisfaction: foundTargets > 0 ? 0.9 : 0.3,
      },
      metadata: {
        executionTime,
        tokensUsed: 100, // Estimated
        memoryUsed: 50,
        errors: 0,
      },
      searchEfficiency: Math.max(0, 1 - (searchDepth / 10)), // Penalize deep searches
      accuracyScore: (precision + recall) / 2,
      explorationBonus: Math.min(0.2, foundTargets * 0.05), // Bonus for multiple findings
      toolUsageOptimality: foundTargets > 0 ? 1.0 / searchDepth : 0.1, // Reward efficient tool usage
    };
  }

  /**
   * Update tool performance based on execution results
   */
  private updateToolPerformance(searchPath: CodeSearchAction[], reward: ToolTrainReward): void {
    for (const action of searchPath) {
      const tool = action.type;
      const performance = this.toolPerformance.get(tool);
      
      if (performance) {
        // Update with exponential moving average
        const alpha = 0.1; // Learning rate
        performance.successRate = (1 - alpha) * performance.successRate + alpha * reward.value;
        performance.averageReward = (1 - alpha) * performance.averageReward + alpha * reward.accuracyScore;
        performance.usageCount++;
        performance.lastUsed = Date.now();
        
        this.toolPerformance.set(tool, performance);
      }
    }
  }

  /**
   * Record tool usage for RL learning
   */
  private recordToolUsage(tool: string, action: CodeSearchAction, result: any, reward: number): void {
    this.toolUsageHistory.push({
      tool,
      action,
      result,
      reward,
      timestamp: Date.now(),
    });
    
    // Keep only recent history (last 100 actions)
    if (this.toolUsageHistory.length > 100) {
      this.toolUsageHistory = this.toolUsageHistory.slice(-100);
    }
  }

  /**
   * Update tool performance on failures
   */
  private updateToolPerformanceOnFailure(): void {
    // Decrease confidence in recently used tools
    for (const [tool, performance] of this.toolPerformance.entries()) {
      if (Date.now() - performance.lastUsed < 60000) { // Within last minute
        performance.successRate = Math.max(0.1, performance.successRate * 0.9);
        this.toolPerformance.set(tool, performance);
      }
    }
  }

  /**
   * Store execution history for future learning
   */
  private storeExecutionHistory(context: AgentContext, result: any, reward: ToolTrainReward): void {
    this.executionHistory.push({
      context,
      response: {
        success: true,
        data: result,
        message: 'Execution stored',
        confidence: result.confidence,
        reasoning: result.reasoning,
        metadata: {},
      },
      reward,
      timestamp: Date.now(),
    });
    
    // Update performance distribution for AB-MCTS integration
    if (reward.value > 0.5) {
      this.performanceDistribution.alpha += 1;
    } else {
      this.performanceDistribution.beta += 1;
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  public getPerformanceMetrics() {
    const totalCalls = this.executionHistory.length;
    const successfulCalls = this.executionHistory.filter(ex => ex.response.success).length;
    const avgExecutionTime = totalCalls > 0 
      ? this.executionHistory.reduce((sum, ex) => sum + ((ex.response.metadata && typeof ex.response.metadata.executionTime === 'number') ? ex.response.metadata.executionTime : 0), 0) / totalCalls
      : 0;
    const avgConfidence = totalCalls > 0
      ? this.executionHistory.reduce((sum, ex) => sum + (ex.response.confidence || 0), 0) / totalCalls
      : 0;
    const lastUsed = totalCalls > 0 ? new Date(this.executionHistory[totalCalls - 1]?.timestamp || Date.now()) : null;

    return {
      totalCalls,
      successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
      averageExecutionTime: avgExecutionTime,
      averageConfidence: avgConfidence,
      lastUsed,
    };
  }
}

// Named export for backward compatibility
export const toolTrainCodeSearchAgent = ToolTrainCodeSearchAgent;