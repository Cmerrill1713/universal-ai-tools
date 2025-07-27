/**
 * Evaluation Agent - Comprehensive quality assessment and performance validation
 * Scores agent outputs, validates quality, and provides actionable metrics
 */

import { type AgentConfig, type AgentContext, type AgentResponse, BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

interface EvaluationCriteria {
  accuracy: number;      // 0-1: How accurate/correct is the response
  relevance: number;     // 0-1: How relevant to the user request
  completeness: number;  // 0-1: How complete is the response
  clarity: number;       // 0-1: How clear and understandable
  efficiency: number;    // 0-1: How efficient (time/resources)
  safety: number;        // 0-1: How safe/secure is the approach
}

interface QualityMetrics {
  overallScore: number;
  criteria: EvaluationCriteria;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  confidence: number;
}

interface PerformanceMetrics {
  latency: number;
  resourceUsage: {
    memory: number;
    cpu: number;
    apiCalls: number;
  };
  errorRate: number;
  successRate: number;
}

interface EvaluationReport {
  evaluationId: string;
  targetAgent: string;
  targetRequestId: string;
  timestamp: Date;
  qualityMetrics: QualityMetrics;
  performanceMetrics: PerformanceMetrics;
  comparisonBaseline?: QualityMetrics;
  recommendation: 'approve' | 'improve' | 'reject';
  detailedFeedback: string;
  suggestedActions: string[];
}

interface AgentBenchmark {
  agentId: string;
  averageQuality: number;
  performanceTrend: 'improving' | 'stable' | 'declining';
  historicalScores: number[];
  commonIssues: string[];
  bestPractices: string[];
}

export class EvaluationAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private benchmarks: Map<string, AgentBenchmark> = new Map();
  private evaluationHistory: EvaluationReport[] = [];
  
  // Evaluation weights for different use cases
  private weights = {
    default: {
      accuracy: 0.3,
      relevance: 0.25,
      completeness: 0.2,
      clarity: 0.15,
      efficiency: 0.05,
      safety: 0.05
    },
    critical: {
      accuracy: 0.35,
      relevance: 0.2,
      completeness: 0.15,
      clarity: 0.1,
      efficiency: 0.05,
      safety: 0.15
    },
    creative: {
      accuracy: 0.2,
      relevance: 0.3,
      completeness: 0.15,
      clarity: 0.2,
      efficiency: 0.05,
      safety: 0.1
    }
  };

  constructor(supabase: SupabaseClient) {
    const config: AgentConfig = {
      name: 'evaluation_agent',
      description: 'Comprehensive quality assessment and performance validation',
      priority: 9,
      capabilities: [
        {
          name: 'evaluate_response',
          description: 'Evaluate the quality of an agent response',
          inputSchema: {
            type: 'object',
            properties: {
              agentResponse: { type: 'object' },
              originalRequest: { type: 'string' },
              evaluationType: { type: 'string', enum: ['default', 'critical', 'creative'] },
              compareToBaseline: { type: 'boolean' }
            },
            required: ['agentResponse', 'originalRequest']
          },
          outputSchema: {
            type: 'object',
            properties: {
              evaluation: { type: 'object' },
              recommendation: { type: 'string' },
              improvements: { type: 'array' }
            }
          }
        },
        {
          name: 'benchmark_agent',
          description: 'Create performance benchmark for an agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string' },
              timeframe: { type: 'string', enum: ['day', 'week', 'month'] }
            },
            required: ['agentId']
          },
          outputSchema: {
            type: 'object',
            properties: {
              benchmark: { type: 'object' },
              trends: { type: 'object' }
            }
          }
        },
        {
          name: 'validate_output',
          description: 'Validate agent output for correctness and safety',
          inputSchema: {
            type: 'object',
            properties: {
              output: { type: 'any' },
              expectedFormat: { type: 'object' },
              safetyChecks: { type: 'array' }
            },
            required: ['output']
          },
          outputSchema: {
            type: 'object',
            properties: {
              isValid: { type: 'boolean' },
              issues: { type: 'array' },
              fixes: { type: 'array' }
            }
          }
        },
        {
          name: 'compare_agents',
          description: 'Compare performance of multiple agents',
          inputSchema: {
            type: 'object',
            properties: {
              agentIds: { type: 'array' },
              metric: { type: 'string' },
              timeframe: { type: 'string' }
            },
            required: ['agentIds']
          },
          outputSchema: {
            type: 'object',
            properties: {
              comparison: { type: 'object' },
              winner: { type: 'string' },
              insights: { type: 'array' }
            }
          }
        }
      ],
      maxLatencyMs: 5000,
      retryAttempts: 2,
      dependencies: ['ollama_assistant'],
      memoryEnabled: true
    };

    super(config);
    this.supabase = supabase;
  }

  protected async onInitialize(): Promise<void> {
    // Load historical benchmarks
    await this.loadBenchmarks();
    
    // Initialize evaluation models
    await this.initializeEvaluationModels();
    
    this.logger.info('✅ EvaluationAgent initialized');
  }

  protected async process(context: AgentContext): Promise<AgentResponse> {
    const { userRequest } = context;
    const startTime = Date.now();

    try {
      // Parse evaluation request
      const evaluationRequest = await this.parseEvaluationRequest(userRequest);
      
      let result: any;
      
      switch (evaluationRequest.type) {
        case 'evaluate_response':
          result = await this.evaluateAgentResponse(evaluationRequest);
          break;
          
        case 'benchmark_agent':
          result = await this.benchmarkAgent(evaluationRequest);
          break;
          
        case 'validate_output':
          result = await this.validateOutput(evaluationRequest);
          break;
          
        case 'compare_agents':
          result = await this.compareAgents(evaluationRequest);
          break;
          
        default:
          result = await this.performGeneralEvaluation(evaluationRequest);
      }

      return {
        success: true,
        data: result,
        reasoning: this.buildEvaluationReasoning(evaluationRequest, result),
        confidence: result.confidence || 0.9,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        nextActions: this.suggestNextActions(result)
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        reasoning: `Evaluation failed: ${(error as Error).message}`,
        confidence: 0.1,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        error: (error as Error).message
      };
    }
  }

  protected async onShutdown(): Promise<void> {
    // Save benchmarks and evaluation history
    await this.saveBenchmarks();
    this.logger.info('EvaluationAgent shutting down');
  }

  /**
   * Evaluate an agent's response quality
   */
  private async evaluateAgentResponse(request: any): Promise<EvaluationReport> {
    const { agentResponse, originalRequest, evaluationType = 'default' } = request;
    
    // Extract performance metrics
    const performanceMetrics = this.extractPerformanceMetrics(agentResponse);
    
    // Evaluate quality across criteria
    const qualityMetrics = await this.evaluateQuality(
      originalRequest,
      agentResponse,
      evaluationType
    );
    
    // Compare to baseline if requested
    let comparisonBaseline;
    if (request.compareToBaseline) {
      comparisonBaseline = await this.getBaselineMetrics(agentResponse.agentId);
    }
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(qualityMetrics, performanceMetrics);
    
    // Create detailed feedback
    const detailedFeedback = await this.generateDetailedFeedback(
      qualityMetrics,
      performanceMetrics,
      comparisonBaseline
    );
    
    // Suggest improvements
    const suggestedActions = this.generateSuggestedActions(qualityMetrics, performanceMetrics);
    
    const report: EvaluationReport = {
      evaluationId: `eval_${Date.now()}`,
      targetAgent: agentResponse.agentId,
      targetRequestId: agentResponse.requestId || 'unknown',
      timestamp: new Date(),
      qualityMetrics,
      performanceMetrics,
      comparisonBaseline,
      recommendation,
      detailedFeedback,
      suggestedActions
    };
    
    // Store evaluation
    await this.storeEvaluation(report);
    
    // Update agent benchmark
    await this.updateAgentBenchmark(agentResponse.agentId, qualityMetrics);
    
    return report;
  }

  /**
   * Evaluate quality across multiple criteria
   */
  private async evaluateQuality(
    originalRequest: string,
    agentResponse: AgentResponse,
    evaluationType: string
  ): Promise<QualityMetrics> {
    // Use LLM to evaluate each criterion
    const prompt = `Evaluate this agent response across multiple quality criteria.

Original Request: "${originalRequest}"

Agent Response:
- Success: ${agentResponse.success}
- Data: ${JSON.stringify(agentResponse.data, null, 2)}
- Reasoning: ${agentResponse.reasoning}
- Confidence: ${agentResponse.confidence}

Evaluate on a scale of 0.0 to 1.0:
1. Accuracy - How correct and factual is the response?
2. Relevance - How well does it address the original request?
3. Completeness - Does it fully answer all aspects?
4. Clarity - How clear and understandable is it?
5. Efficiency - How efficient was the approach?
6. Safety - Are there any security or safety concerns?

Also identify:
- Key strengths (2-3 items)
- Key weaknesses (2-3 items)
- Improvement suggestions (2-3 items)

Respond in JSON format.`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        format: 'json'
      });

      const evaluation = JSON.parse(response.data.response);
      
      const criteria: EvaluationCriteria = {
        accuracy: evaluation.accuracy || 0.7,
        relevance: evaluation.relevance || 0.7,
        completeness: evaluation.completeness || 0.7,
        clarity: evaluation.clarity || 0.7,
        efficiency: evaluation.efficiency || 0.7,
        safety: evaluation.safety || 0.9
      };
      
      // Calculate overall score using weights
      const weights = this.weights[evaluationType as keyof typeof this.weights] || this.weights.default;
      const overallScore = Object.entries(criteria).reduce(
        (sum, [key, value]) => sum + value * weights[key as keyof EvaluationCriteria],
        0
      );
      
      return {
        overallScore,
        criteria,
        strengths: evaluation.strengths || ['Completed successfully'],
        weaknesses: evaluation.weaknesses || ['Could be optimized'],
        improvements: evaluation.improvements || ['Add more context'],
        confidence: agentResponse.confidence
      };
    } catch (error) {
      // Fallback to heuristic evaluation
      return this.heuristicEvaluation(agentResponse);
    }
  }

  /**
   * Heuristic evaluation when LLM is unavailable
   */
  private heuristicEvaluation(agentResponse: AgentResponse): QualityMetrics {
    const criteria: EvaluationCriteria = {
      accuracy: agentResponse.success ? 0.8 : 0.3,
      relevance: agentResponse.confidence > 0.7 ? 0.8 : 0.5,
      completeness: agentResponse.data ? 0.7 : 0.4,
      clarity: agentResponse.reasoning ? 0.8 : 0.5,
      efficiency: agentResponse.latencyMs < 1000 ? 0.9 : 0.6,
      safety: 0.9 // Assume safe unless detected otherwise
    };
    
    const overallScore = Object.values(criteria).reduce((sum, val) => sum + val, 0) / 6;
    
    return {
      overallScore,
      criteria,
      strengths: ['Response provided', 'No errors detected'],
      weaknesses: ['Limited evaluation available'],
      improvements: ['Enable LLM for better evaluation'],
      confidence: 0.6
    };
  }

  /**
   * Extract performance metrics from agent response
   */
  private extractPerformanceMetrics(agentResponse: AgentResponse): PerformanceMetrics {
    return {
      latency: agentResponse.latencyMs || 0,
      resourceUsage: {
        memory: 0, // Would need actual monitoring
        cpu: 0,
        apiCalls: 1
      },
      errorRate: agentResponse.success ? 0 : 1,
      successRate: agentResponse.success ? 1 : 0
    };
  }

  /**
   * Generate recommendation based on evaluation
   */
  private generateRecommendation(
    quality: QualityMetrics,
    performance: PerformanceMetrics
  ): 'approve' | 'improve' | 'reject' {
    if (quality.overallScore >= 0.8 && performance.errorRate === 0) {
      return 'approve';
    } else if (quality.overallScore >= 0.5) {
      return 'improve';
    } else {
      return 'reject';
    }
  }

  /**
   * Generate detailed feedback
   */
  private async generateDetailedFeedback(
    quality: QualityMetrics,
    performance: PerformanceMetrics,
    baseline?: QualityMetrics
  ): Promise<string> {
    let feedback = `Overall Quality Score: ${(quality.overallScore * 100).toFixed(1)}%\n\n`;
    
    feedback += 'Quality Breakdown:\n';
    for (const [criterion, score] of Object.entries(quality.criteria)) {
      feedback += `- ${criterion}: ${(score * 100).toFixed(1)}%\n`;
    }
    
    if (baseline) {
      const improvement = quality.overallScore - baseline.overallScore;
      feedback += `\nComparison to Baseline: ${improvement >= 0 ? '+' : ''}${(improvement * 100).toFixed(1)}%\n`;
    }
    
    feedback += `\nPerformance: ${performance.latency}ms latency, ${(performance.successRate * 100).toFixed(0)}% success rate\n`;
    
    feedback += '\nStrengths:\n';
    quality.strengths.forEach(s => feedback += `✓ ${s}\n`);
    
    feedback += '\nAreas for Improvement:\n';
    quality.weaknesses.forEach(w => feedback += `- ${w}\n`);
    
    return feedback;
  }

  /**
   * Generate suggested actions for improvement
   */
  private generateSuggestedActions(
    quality: QualityMetrics,
    performance: PerformanceMetrics
  ): string[] {
    const actions: string[] = [];
    
    // Quality-based suggestions
    if (quality.criteria.accuracy < 0.7) {
      actions.push('Improve fact-checking and validation logic');
    }
    if (quality.criteria.relevance < 0.7) {
      actions.push('Enhance request parsing and intent detection');
    }
    if (quality.criteria.completeness < 0.7) {
      actions.push('Add comprehensive response generation');
    }
    if (quality.criteria.clarity < 0.7) {
      actions.push('Simplify language and structure responses better');
    }
    
    // Performance-based suggestions
    if (performance.latency > 3000) {
      actions.push('Optimize processing logic to reduce latency');
    }
    if (performance.errorRate > 0.1) {
      actions.push('Add better error handling and recovery');
    }
    
    return actions;
  }

  /**
   * Benchmark an agent's performance over time
   */
  private async benchmarkAgent(request: any): Promise<any> {
    const { agentId, timeframe = 'week' } = request;
    
    // Get historical evaluations
    const evaluations = await this.getHistoricalEvaluations(agentId, timeframe);
    
    // Calculate trends
    const scores = evaluations.map(e => e.qualityMetrics.overallScore);
    const trend = this.calculateTrend(scores);
    
    // Identify common issues
    const allWeaknesses = evaluations.flatMap(e => e.qualityMetrics.weaknesses);
    const commonIssues = this.findCommonItems(allWeaknesses);
    
    // Extract best practices
    const allStrengths = evaluations.flatMap(e => e.qualityMetrics.strengths);
    const bestPractices = this.findCommonItems(allStrengths);
    
    const benchmark: AgentBenchmark = {
      agentId,
      averageQuality: scores.reduce((a, b) => a + b, 0) / scores.length,
      performanceTrend: trend,
      historicalScores: scores,
      commonIssues,
      bestPractices
    };
    
    // Update stored benchmark
    this.benchmarks.set(agentId, benchmark);
    
    return {
      benchmark,
      insights: this.generateBenchmarkInsights(benchmark),
      recommendations: this.generateBenchmarkRecommendations(benchmark)
    };
  }

  /**
   * Validate output format and safety
   */
  private async validateOutput(request: any): Promise<any> {
    const { output, expectedFormat, safetyChecks = [] } = request;
    
    const issues: string[] = [];
    const fixes: string[] = [];
    
    // Format validation
    if (expectedFormat) {
      const formatIssues = this.validateFormat(output, expectedFormat);
      issues.push(...formatIssues);
    }
    
    // Safety validation
    const safetyIssues = await this.validateSafety(output, safetyChecks);
    issues.push(...safetyIssues);
    
    // Generate fixes for issues
    for (const issue of issues) {
      const fix = await this.generateFix(issue, output);
      if (fix) fixes.push(fix);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      fixes,
      validatedOutput: this.applyFixes(output, fixes)
    };
  }

  /**
   * Compare performance of multiple agents
   */
  private async compareAgents(request: any): Promise<any> {
    const { agentIds, metric = 'overall', timeframe = 'week' } = request;
    
    const comparisons: any = {};
    
    for (const agentId of agentIds) {
      const benchmark = this.benchmarks.get(agentId) || 
                       await this.benchmarkAgent({ agentId, timeframe });
      comparisons[agentId] = benchmark;
    }
    
    // Determine winner based on metric
    const winner = this.determineWinner(comparisons, metric);
    
    // Generate insights
    const insights = this.generateComparisonInsights(comparisons, metric);
    
    return {
      comparison: comparisons,
      winner,
      insights,
      recommendations: this.generateComparisonRecommendations(comparisons)
    };
  }

  // Helper methods
  private async parseEvaluationRequest(request: string): Promise<any> {
    // Parse natural language evaluation request
    return { type: 'evaluate_response', request };
  }

  private async loadBenchmarks(): Promise<void> {
    // Load from database
    try {
      const { data } = await this.supabase
        .from('agent_benchmarks')
        .select('*');
      
      if (data) {
        data.forEach(benchmark => {
          this.benchmarks.set(benchmark.agent_id, benchmark);
        });
      }
    } catch (error) {
      this.logger.error('Failed to load benchmarks:', error);
    }
  }

  private async saveBenchmarks(): Promise<void> {
    // Save to database
    const benchmarkData = Array.from(this.benchmarks.entries()).map(([id, data]) => ({
      agent_id: id,
      ...data
    }));
    
    try {
      await this.supabase
        .from('agent_benchmarks')
        .upsert(benchmarkData);
    } catch (error) {
      this.logger.error('Failed to save benchmarks:', error);
    }
  }

  private async initializeEvaluationModels(): Promise<void> {
    // Initialize any specific evaluation models
  }

  private async storeEvaluation(report: EvaluationReport): Promise<void> {
    this.evaluationHistory.push(report);
    
    try {
      await this.supabase
        .from('agent_evaluations')
        .insert({
          evaluation_id: report.evaluationId,
          target_agent: report.targetAgent,
          quality_score: report.qualityMetrics.overallScore,
          recommendation: report.recommendation,
          report_data: report
        });
    } catch (error) {
      this.logger.error('Failed to store evaluation:', error);
    }
  }

  private async getBaselineMetrics(agentId: string): Promise<QualityMetrics | undefined> {
    const benchmark = this.benchmarks.get(agentId);
    if (!benchmark) return undefined;
    
    return {
      overallScore: benchmark.averageQuality,
      criteria: {
        accuracy: 0.7,
        relevance: 0.7,
        completeness: 0.7,
        clarity: 0.7,
        efficiency: 0.7,
        safety: 0.9
      },
      strengths: benchmark.bestPractices,
      weaknesses: benchmark.commonIssues,
      improvements: [],
      confidence: 0.8
    };
  }

  private async updateAgentBenchmark(agentId: string, quality: QualityMetrics): Promise<void> {
    const benchmark = this.benchmarks.get(agentId) || {
      agentId,
      averageQuality: 0,
      performanceTrend: 'stable' as const,
      historicalScores: [],
      commonIssues: [],
      bestPractices: []
    };
    
    benchmark.historicalScores.push(quality.overallScore);
    benchmark.averageQuality = benchmark.historicalScores.reduce((a, b) => a + b, 0) / 
                               benchmark.historicalScores.length;
    benchmark.performanceTrend = this.calculateTrend(benchmark.historicalScores);
    
    this.benchmarks.set(agentId, benchmark);
  }

  private calculateTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 3) return 'stable';
    
    const recent = scores.slice(-3);
    const older = scores.slice(-6, -3);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 0.05) return 'improving';
    if (difference < -0.05) return 'declining';
    return 'stable';
  }

  private findCommonItems(items: string[]): string[] {
    const counts = new Map<string, number>();
    items.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([item]) => item);
  }

  private async getHistoricalEvaluations(agentId: string, timeframe: string): Promise<EvaluationReport[]> {
    const cutoffDate = new Date();
    switch (timeframe) {
      case 'day':
        cutoffDate.setDate(cutoffDate.getDate() - 1);
        break;
      case 'week':
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
    }
    
    return this.evaluationHistory.filter(
      e => e.targetAgent === agentId && e.timestamp > cutoffDate
    );
  }

  private generateBenchmarkInsights(benchmark: AgentBenchmark): string[] {
    const insights: string[] = [];
    
    if (benchmark.performanceTrend === 'improving') {
      insights.push('Agent performance is trending upward');
    } else if (benchmark.performanceTrend === 'declining') {
      insights.push('Agent performance needs attention - declining trend detected');
    }
    
    if (benchmark.averageQuality > 0.8) {
      insights.push('Consistently high quality outputs');
    } else if (benchmark.averageQuality < 0.6) {
      insights.push('Quality below acceptable threshold');
    }
    
    return insights;
  }

  private generateBenchmarkRecommendations(benchmark: AgentBenchmark): string[] {
    const recommendations: string[] = [];
    
    if (benchmark.commonIssues.length > 0) {
      recommendations.push(`Focus on addressing: ${benchmark.commonIssues.join(', ')}`);
    }
    
    if (benchmark.performanceTrend === 'declining') {
      recommendations.push('Review recent changes and rollback if necessary');
    }
    
    return recommendations;
  }

  private validateFormat(output: any, expectedFormat: any): string[] {
    const issues: string[] = [];
    
    // Type checking
    if (expectedFormat.type && typeof output !== expectedFormat.type) {
      issues.push(`Expected type ${expectedFormat.type}, got ${typeof output}`);
    }
    
    // Required fields
    if (expectedFormat.required && Array.isArray(expectedFormat.required)) {
      for (const field of expectedFormat.required) {
        if (!(field in output)) {
          issues.push(`Missing required field: ${field}`);
        }
      }
    }
    
    return issues;
  }

  private async validateSafety(output: any, checks: string[]): Promise<string[]> {
    const issues: string[] = [];
    
    // Check for common safety issues
    if (checks.includes('no-secrets')) {
      const secretPattern = /(api[_-]?key|password|secret|token)[\s]*[:=][\s]*['"]?[a-zA-Z0-9]+/gi;
      if (JSON.stringify(output).match(secretPattern)) {
        issues.push('Potential secrets detected in output');
      }
    }
    
    if (checks.includes('no-pii')) {
      const piiPattern = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b/g;
      if (JSON.stringify(output).match(piiPattern)) {
        issues.push('Potential PII detected in output');
      }
    }
    
    return issues;
  }

  private async generateFix(issue: string, output: any): Promise<string | null> {
    // Generate fixes for common issues
    if (issue.includes('Missing required field')) {
      const field = issue.split(': ')[1];
      return `Add field '${field}' with appropriate default value`;
    }
    
    if (issue.includes('secrets detected')) {
      return 'Remove or mask sensitive information';
    }
    
    return null;
  }

  private applyFixes(output: any, fixes: string[]): any {
    // Apply automated fixes where possible
    return output; // Would implement actual fixes
  }

  private determineWinner(comparisons: any, metric: string): string {
    let winner = '';
    let bestScore = -1;
    
    for (const [agentId, benchmark] of Object.entries(comparisons)) {
      const score = (benchmark as any).averageQuality;
      if (score > bestScore) {
        bestScore = score;
        winner = agentId;
      }
    }
    
    return winner;
  }

  private generateComparisonInsights(comparisons: any, metric: string): string[] {
    const insights: string[] = [];
    const scores = Object.entries(comparisons).map(([id, b]) => ({
      id,
      score: (b as any).averageQuality
    }));
    
    scores.sort((a, b) => b.score - a.score);
    
    insights.push(`${scores[0].id} leads with ${(scores[0].score * 100).toFixed(1)}% quality`);
    
    const spread = scores[0].score - scores[scores.length - 1].score;
    if (spread > 0.2) {
      insights.push('Significant performance gap between agents');
    }
    
    return insights;
  }

  private generateComparisonRecommendations(comparisons: any): string[] {
    const recommendations: string[] = [];
    
    // Find agents that could learn from each other
    const entries = Object.entries(comparisons);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [id1, b1] = entries[i];
        const [id2, b2] = entries[j];
        
        // Check if they have complementary strengths
        const strengths1 = new Set((b1 as any).bestPractices);
        const weaknesses2 = new Set((b2 as any).commonIssues);
        
        const overlap = Array.from(strengths1).filter(s => weaknesses2.has(s));
        if (overlap.length > 0) {
          recommendations.push(`${id1} could help ${id2} with: ${overlap.join(', ')}`);
        }
      }
    }
    
    return recommendations;
  }

  private buildEvaluationReasoning(request: any, result: any): string {
    return `Evaluated ${request.type} with overall score: ${(result.qualityMetrics?.overallScore * 100 || 0).toFixed(1)}%`;
  }

  private suggestNextActions(result: any): string[] {
    if (result.recommendation === 'approve') {
      return ['Deploy to production', 'Share best practices'];
    } else if (result.recommendation === 'improve') {
      return ['Implement suggested improvements', 'Re-evaluate after changes'];
    } else {
      return ['Review agent implementation', 'Consider alternative approaches'];
    }
  }

  private async performGeneralEvaluation(request: any): Promise<any> {
    return {
      message: 'General evaluation completed',
      request
    };
  }
}

export default EvaluationAgent;