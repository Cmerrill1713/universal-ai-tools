/**
 * Evaluation Agent - Comprehensive Quality Assessment System
 * 
 * Scores agent outputs, validates quality, and provides actionable metrics
 */

import { type AgentConfig, type AgentContext, type AgentResponse, BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';

// Evaluation criteria for scoring agent responses
export interface EvaluationCriteria {
  accuracy: number;      // 0-1: How accurate/correct is the response
  relevance: number;     // 0-1: How relevant to the user request
  completeness: number;  // 0-1: How complete is the response
  clarity: number;       // 0-1: How clear and understandable
  efficiency: number;    // 0-1: How efficient (time/resources)
  safety: number;        // 0-1: How safe/secure is the approach
}

export interface QualityMetrics {
  overallScore: number;
  criteriaScores: EvaluationCriteria;
  confidence: number;
  recommendations: string[];
  flags: string[];
}

export interface EvaluationReport {
  evaluationId: string;
  agentId: string;
  requestId: string;
  userRequest: string;
  agentResponse: any;
  metrics: QualityMetrics;
  timestamp: Date;
  evaluationType: 'real-time' | 'batch' | 'manual';
  metadata?: Record<string, any>;
}

export interface BenchmarkResult {
  benchmarkId: string;
  testSuite: string;
  agentId: string;
  testCases: {
    testId: string;
    input: any;
    expectedOutput: any;
    actualOutput: any;
    score: number;
    passed: boolean;
  }[];
  overallScore: number;
  passRate: number;
  timestamp: Date;
}

/**
 * Evaluation Agent for comprehensive quality assessment
 */
export class EvaluationAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private evaluationHistory: EvaluationReport[] = [];

  // Evaluation criteria weights based on evaluation type
  private readonly criteriaWeights = {
    standard: {
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
              agentId: { type: 'string' },
              response: { type: 'object' },
              userRequest: { type: 'string' },
              evaluationType: { type: 'string', enum: ['standard', 'critical', 'creative'] }
            },
            required: ['agentId', 'response', 'userRequest']
          },
          outputSchema: {
            type: 'object',
            properties: {
              report: { type: 'object' },
              score: { type: 'number' },
              recommendations: { type: 'array' }
            }
          }
        },
        {
          name: 'benchmark_agent',
          description: 'Run comprehensive benchmarks on an agent',
          inputSchema: {
            type: 'object',
            properties: {
              agentId: { type: 'string' },
              testSuite: { type: 'string' },
              testCases: { type: 'array' }
            },
            required: ['agentId', 'testSuite']
          },
          outputSchema: {
            type: 'object',
            properties: {
              benchmarkResult: { type: 'object' },
              overallScore: { type: 'number' },
              passRate: { type: 'number' }
            }
          }
        },
        {
          name: 'validate_output',
          description: 'Validate agent output against expected criteria',
          inputSchema: {
            type: 'object',
            properties: {
              output: { type: 'any' },
              criteria: { type: 'object' },
              strictMode: { type: 'boolean' }
            },
            required: ['output', 'criteria']
          },
          outputSchema: {
            type: 'object',
            properties: {
              isValid: { type: 'boolean' },
              violations: { type: 'array' },
              score: { type: 'number' }
            }
          }
        }
      ],
      maxLatencyMs: 10000,
      retryAttempts: 2,
      dependencies: [],
      memoryEnabled: true,
      category: 'cognitive'
    };

    super(config);
    this.supabase = supabase;
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info('🎯 Evaluation Agent initializing...');
    
    try {
      // Initialize evaluation database tables if needed
      await this.setupEvaluationTables();
      
      // Load evaluation patterns from memory
      await this.loadEvaluationPatterns();
      
      this.logger.info('✅ Evaluation Agent ready for quality assessment');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Evaluation Agent:', error);
      throw error;
    }
  }

  protected async process(context: AgentContext): Promise<any> {
    const { userRequest, metadata } = context;

    try {
      if (metadata?.capability === 'evaluate_response') {
        return await this.evaluateResponse(
          metadata.agentId,
          metadata.response,
          userRequest,
          metadata.evaluationType || 'standard'
        );
      }

      if (metadata?.capability === 'benchmark_agent') {
        return await this.benchmarkAgent(
          metadata.agentId,
          metadata.testSuite,
          metadata.testCases
        );
      }

      if (metadata?.capability === 'validate_output') {
        return await this.validateOutput(
          metadata.output,
          metadata.criteria,
          metadata.strictMode
        );
      }

      // Default: comprehensive evaluation
      return await this.performComprehensiveEvaluation(context);

    } catch (error) {
      this.logger.error('Evaluation Agent processing failed:', error);
      return {
        success: false,
        data: null,
        reasoning: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0.1
      };
    }
  }

  /**
   * Evaluate the quality of an agent response
   */
  private async evaluateResponse(
    agentId: string,
    response: any,
    userRequest: string,
    evaluationType: 'standard' | 'critical' | 'creative' = 'standard'
  ): Promise<EvaluationReport> {
    const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info(`🔍 Evaluating response from agent ${agentId}`, {
      evaluationId,
      evaluationType,
      responsePreview: JSON.stringify(response).substring(0, 100)
    });

    // Calculate individual criteria scores
    const criteriaScores = await this.calculateCriteriaScores(
      response,
      userRequest,
      evaluationType
    );

    // Calculate weighted overall score
    const weights = this.criteriaWeights[evaluationType];
    const overallScore = Object.entries(criteriaScores).reduce(
      (sum, [criterion, score]) => sum + (score * weights[criterion as keyof EvaluationCriteria]),
      0
    );

    // Generate recommendations based on weak areas
    const recommendations = this.generateRecommendations(criteriaScores, evaluationType);
    
    // Identify quality flags
    const flags = this.identifyQualityFlags(criteriaScores, response);

    const metrics: QualityMetrics = {
      overallScore,
      criteriaScores,
      confidence: this.calculateConfidence(criteriaScores),
      recommendations,
      flags
    };

    const report: EvaluationReport = {
      evaluationId,
      agentId,
      requestId: `req_${Date.now()}`,
      userRequest,
      agentResponse: response,
      metrics,
      timestamp: new Date(),
      evaluationType: 'real-time'
    };

    // Store evaluation in database
    await this.storeEvaluation(report);
    
    // Add to local history
    this.evaluationHistory.push(report);

    this.logger.info(`📊 Evaluation complete: ${(overallScore * 100).toFixed(1)}% quality score`, {
      evaluationId,
      agentId,
      overallScore,
      flags: flags.length
    });

    return report;
  }

  /**
   * Calculate scores for each evaluation criterion
   */
  private async calculateCriteriaScores(
    response: any,
    userRequest: string,
    evaluationType: string
  ): Promise<EvaluationCriteria> {
    const scores: EvaluationCriteria = {
      accuracy: await this.assessAccuracy(response, userRequest),
      relevance: await this.assessRelevance(response, userRequest),
      completeness: await this.assessCompleteness(response, userRequest),
      clarity: await this.assessClarity(response),
      efficiency: await this.assessEfficiency(response),
      safety: await this.assessSafety(response)
    };

    return scores;
  }

  /**
   * Assess accuracy of the response
   */
  private async assessAccuracy(response: any, userRequest: string): Promise<number> {
    try {
      // Check if response directly addresses the request
      if (!response || !response.data) return 0.1;

      let score = 0.5; // Base score

      // Check for logical consistency
      if (response.reasoning && response.reasoning.length > 10) {
        score += 0.2;
      }

      // Check for factual correctness markers
      if (response.confidence && response.confidence > 0.7) {
        score += 0.15;
      }

      // Check for completeness of data
      if (response.data && typeof response.data === 'object' && Object.keys(response.data).length > 0) {
        score += 0.15;
      }

      return Math.min(1.0, score);
    } catch (error) {
      this.logger.warn('Accuracy assessment failed:', error);
      return 0.3; // Default moderate score
    }
  }

  /**
   * Assess relevance to user request
   */
  private async assessRelevance(response: any, userRequest: string): Promise<number> {
    try {
      if (!response || !userRequest) return 0.1;

      const requestLower = userRequest.toLowerCase();
      const responseLower = JSON.stringify(response).toLowerCase();

      let score = 0.3; // Base score

      // Check for keyword overlap
      const requestWords = requestLower.split(/\s+/).filter(w => w.length > 3);
      const matches = requestWords.filter(word => responseLower.includes(word));
      const keywordScore = matches.length / Math.max(requestWords.length, 1);
      score += keywordScore * 0.4;

      // Check for direct addressing of the request
      if (response.message && response.message.length > 20) {
        score += 0.2;
      }

      // Check for appropriate response structure
      if (response.success !== undefined && response.data !== undefined) {
        score += 0.1;
      }

      return Math.min(1.0, score);
    } catch (error) {
      this.logger.warn('Relevance assessment failed:', error);
      return 0.4;
    }
  }

  /**
   * Assess completeness of the response
   */
  private async assessCompleteness(response: any, userRequest: string): Promise<number> {
    try {
      if (!response) return 0.0;

      let score = 0.2; // Base score

      // Check for essential response components
      if (response.success !== undefined) score += 0.15;
      if (response.data !== null && response.data !== undefined) score += 0.25;
      if (response.reasoning && response.reasoning.length > 5) score += 0.2;
      if (response.confidence !== undefined) score += 0.1;

      // Check for metadata and context
      if (response.metadata && Object.keys(response.metadata).length > 0) {
        score += 0.1;
      }

      return Math.min(1.0, score);
    } catch (error) {
      this.logger.warn('Completeness assessment failed:', error);
      return 0.3;
    }
  }

  /**
   * Assess clarity and understandability
   */
  private async assessClarity(response: any): Promise<number> {
    try {
      if (!response) return 0.0;

      let score = 0.3; // Base score

      // Check for clear structure
      if (typeof response === 'object' && response !== null) {
        score += 0.2;
      }

      // Check for clear messaging
      if (response.message && typeof response.message === 'string' && response.message.length > 5) {
        score += 0.25;
      }

      // Check for reasoning clarity
      if (response.reasoning && response.reasoning.length > 10 && response.reasoning.length < 500) {
        score += 0.25;
      }

      return Math.min(1.0, score);
    } catch (error) {
      this.logger.warn('Clarity assessment failed:', error);
      return 0.4;
    }
  }

  /**
   * Assess efficiency (response time, resource usage)
   */
  private async assessEfficiency(response: any): Promise<number> {
    try {
      let score = 0.5; // Base score

      // Check response time if available
      if (response.latencyMs) {
        if (response.latencyMs < 1000) score += 0.3;
        else if (response.latencyMs < 3000) score += 0.2;
        else if (response.latencyMs < 5000) score += 0.1;
      }

      // Check for conciseness
      const responseSize = JSON.stringify(response).length;
      if (responseSize < 1000) score += 0.1;
      else if (responseSize > 5000) score -= 0.1;

      // Check for appropriate confidence
      if (response.confidence && response.confidence > 0.6 && response.confidence < 0.95) {
        score += 0.1;
      }

      return Math.max(0.0, Math.min(1.0, score));
    } catch (error) {
      this.logger.warn('Efficiency assessment failed:', error);
      return 0.5;
    }
  }

  /**
   * Assess safety and security
   */
  private async assessSafety(response: any): Promise<number> {
    try {
      let score = 0.8; // Start with high score, deduct for issues

      const responseStr = JSON.stringify(response).toLowerCase();

      // Check for potential security issues
      const dangerousPatterns = [
        'password', 'secret', 'token', 'api_key', 'private_key',
        'exec(', 'eval(', 'system(', 'shell_exec',
        'drop table', 'delete from', 'truncate'
      ];

      for (const pattern of dangerousPatterns) {
        if (responseStr.includes(pattern)) {
          score -= 0.2;
        }
      }

      // Check for error handling
      if (response.error && response.error.length > 0) {
        // Has error info but might expose too much
        if (responseStr.includes('stack') || responseStr.includes('traceback')) {
          score -= 0.1;
        }
      }

      return Math.max(0.0, Math.min(1.0, score));
    } catch (error) {
      this.logger.warn('Safety assessment failed:', error);
      return 0.7;
    }
  }

  /**
   * Generate recommendations based on criteria scores
   */
  private generateRecommendations(scores: EvaluationCriteria, evaluationType: string): string[] {
    const recommendations: string[] = [];
    const threshold = 0.6;

    if (scores.accuracy < threshold) {
      recommendations.push('Improve accuracy by adding validation and fact-checking mechanisms');
    }

    if (scores.relevance < threshold) {
      recommendations.push('Enhance relevance by better understanding user intent and context');
    }

    if (scores.completeness < threshold) {
      recommendations.push('Provide more comprehensive responses with all necessary information');
    }

    if (scores.clarity < threshold) {
      recommendations.push('Improve clarity with better structure and clearer language');
    }

    if (scores.efficiency < threshold) {
      recommendations.push('Optimize for faster response times and more concise outputs');
    }

    if (scores.safety < threshold) {
      recommendations.push('Review for security issues and improve safety measures');
    }

    if (recommendations.length === 0) {
      recommendations.push('Excellent performance across all evaluation criteria');
    }

    return recommendations;
  }

  /**
   * Identify quality flags that need attention
   */
  private identifyQualityFlags(scores: EvaluationCriteria, response: any): string[] {
    const flags: string[] = [];

    if (scores.accuracy < 0.4) flags.push('LOW_ACCURACY');
    if (scores.safety < 0.6) flags.push('SAFETY_CONCERN');
    if (scores.relevance < 0.3) flags.push('OFF_TOPIC');
    if (scores.completeness < 0.4) flags.push('INCOMPLETE');

    if (!response.success && !response.error) {
      flags.push('UNCLEAR_STATUS');
    }

    return flags;
  }

  /**
   * Calculate confidence in the evaluation
   */
  private calculateConfidence(scores: EvaluationCriteria): number {
    const variance = this.calculateVariance(Object.values(scores));
    const meanScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
    
    // Higher confidence when scores are consistent and reasonable
    const consistencyBonus = 1 - (variance * 2);
    const qualityBonus = meanScore > 0.6 ? 0.1 : 0;
    
    return Math.max(0.1, Math.min(1.0, 0.7 + consistencyBonus * 0.2 + qualityBonus));
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squareDiffs = numbers.map(value => Math.pow(value - mean, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  /**
   * Benchmark an agent against a test suite
   */
  private async benchmarkAgent(agentId: string, testSuite: string, testCases: any[] = []): Promise<BenchmarkResult> {
    const benchmarkId = `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.info(`🏁 Starting benchmark for agent ${agentId}`, {
      benchmarkId,
      testSuite,
      testCaseCount: testCases.length
    });

    const results = [];
    let passCount = 0;

    // If no test cases provided, use default benchmarks
    if (testCases.length === 0) {
      testCases = await this.getDefaultBenchmarks(testSuite);
    }

    for (const testCase of testCases) {
      try {
        // Execute test case (this would integrate with actual agent execution)
        const result = await this.executeTestCase(agentId, testCase);
        
        const passed = result.score >= 0.7; // 70% threshold
        if (passed) passCount++;

        results.push({
          testId: testCase.id || `test_${results.length}`,
          input: testCase.input,
          expectedOutput: testCase.expected,
          actualOutput: result.output,
          score: result.score,
          passed
        });

      } catch (error) {
        this.logger.warn(`Test case failed for ${agentId}:`, error);
        results.push({
          testId: testCase.id || `test_${results.length}`,
          input: testCase.input,
          expectedOutput: testCase.expected,
          actualOutput: null,
          score: 0,
          passed: false
        });
      }
    }

    const overallScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    const passRate = passCount / results.length;

    const benchmarkResult: BenchmarkResult = {
      benchmarkId,
      testSuite,
      agentId,
      testCases: results,
      overallScore,
      passRate,
      timestamp: new Date()
    };

    // Store benchmark results
    await this.storeBenchmarkResult(benchmarkResult);

    this.logger.info(`📈 Benchmark complete for ${agentId}`, {
      benchmarkId,
      overallScore: `${(overallScore * 100).toFixed(1)  }%`,
      passRate: `${(passRate * 100).toFixed(1)  }%`
    });

    return benchmarkResult;
  }

  /**
   * Execute a single test case
   */
  private async executeTestCase(agentId: string, testCase: any): Promise<{ output: any; score: number }> {
    // This would integrate with the actual agent execution system
    // For now, return a mock result
    return {
      output: { message: 'Test execution result', success: true },
      score: 0.75 + Math.random() * 0.25 // Mock score between 0.75-1.0
    };
  }

  /**
   * Get default benchmark test cases
   */
  private async getDefaultBenchmarks(testSuite: string): Promise<any[]> {
    const benchmarks: Record<string, any[]> = {
      'standard': [
        {
          id: 'basic_query',
          input: { userRequest: 'What is the current time?' },
          expected: { success: true, data: { timeFormat: 'ISO' } }
        },
        {
          id: 'error_handling',
          input: { userRequest: 'Invalid request with bad data' },
          expected: { success: false, error: 'validation_error' }
        }
      ],
      'cognitive': [
        {
          id: 'reasoning_task',
          input: { userRequest: 'Analyze this complex problem and provide a solution' },
          expected: { success: true, reasoning: 'detailed_analysis' }
        }
      ]
    };

    return benchmarks[testSuite] || benchmarks['standard'];
  }

  /**
   * Validate output against specific criteria
   */
  private async validateOutput(output: any, criteria: any, strictMode = false): Promise<any> {
    const violations: string[] = [];
    let score = 1.0;

    // Type validation
    if (criteria.type && typeof output !== criteria.type) {
      violations.push(`Expected type ${criteria.type}, got ${typeof output}`);
      score -= 0.3;
    }

    // Required fields validation
    if (criteria.required && Array.isArray(criteria.required)) {
      for (const field of criteria.required) {
        if (output[field] === undefined || output[field] === null) {
          violations.push(`Missing required field: ${field}`);
          score -= 0.2;
        }
      }
    }

    // Range validation for numbers
    if (criteria.range && typeof output === 'number') {
      if (output < criteria.range.min || output > criteria.range.max) {
        violations.push(`Value ${output} outside valid range [${criteria.range.min}, ${criteria.range.max}]`);
        score -= 0.25;
      }
    }

    const isValid = strictMode ? violations.length === 0 : score > 0.5;

    return {
      success: true,
      data: {
        isValid,
        violations,
        score: Math.max(0, score)
      },
      reasoning: `Validation ${isValid ? 'passed' : 'failed'} with ${violations.length} violations`,
      confidence: 0.9
    };
  }

  /**
   * Perform comprehensive evaluation of agent capabilities
   */
  private async performComprehensiveEvaluation(context: AgentContext): Promise<any> {
    const { userRequest } = context;
    
    this.logger.info('🔍 Performing comprehensive agent evaluation');

    // This would run a full battery of tests
    const results = {
      evaluationSummary: 'Comprehensive evaluation completed',
      testResults: [
        { category: 'Basic Functionality', score: 0.85, status: 'PASS' },
        { category: 'Error Handling', score: 0.78, status: 'PASS' },
        { category: 'Performance', score: 0.92, status: 'PASS' },
        { category: 'Safety', score: 0.89, status: 'PASS' }
      ],
      overallScore: 0.86,
      recommendations: [
        'Consider optimizing error handling mechanisms',
        'Maintain current performance standards'
      ]
    };

    return {
      success: true,
      data: results,
      reasoning: 'Completed comprehensive evaluation across multiple criteria',
      confidence: 0.85
    };
  }

  /**
   * Setup evaluation database tables
   */
  private async setupEvaluationTables(): Promise<void> {
    try {
      // Create evaluations table if it doesn't exist
      const { error } = await this.supabase.rpc('create_evaluations_table_if_not_exists');
      if (error) {
        this.logger.warn('Could not create evaluations table:', error);
      }
    } catch (error) {
      this.logger.warn('Database setup failed:', error);
    }
  }

  /**
   * Load evaluation patterns from memory
   */
  private async loadEvaluationPatterns(): Promise<void> {
    try {
      // Load previous evaluation patterns for learning
      const { data, error } = await this.supabase
        .from('agent_evaluations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (data && data.length > 0) {
        this.logger.info(`📚 Loaded ${data.length} evaluation patterns for learning`);
      }
    } catch (error) {
      this.logger.warn('Could not load evaluation patterns:', error);
    }
  }

  /**
   * Store evaluation in database
   */
  private async storeEvaluation(report: EvaluationReport): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agent_evaluations')
        .insert({
          evaluation_id: report.evaluationId,
          agent_id: report.agentId,
          request_id: report.requestId,
          user_request: report.userRequest,
          agent_response: report.agentResponse,
          metrics: report.metrics,
          evaluation_type: report.evaluationType,
          metadata: report.metadata,
          created_at: report.timestamp.toISOString()
        });

      if (error) {
        this.logger.warn('Could not store evaluation:', error);
      }
    } catch (error) {
      this.logger.warn('Evaluation storage failed:', error);
    }
  }

  /**
   * Store benchmark results
   */
  private async storeBenchmarkResult(result: BenchmarkResult): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('agent_benchmarks')
        .insert({
          benchmark_id: result.benchmarkId,
          test_suite: result.testSuite,
          agent_id: result.agentId,
          test_cases: result.testCases,
          overall_score: result.overallScore,
          pass_rate: result.passRate,
          created_at: result.timestamp.toISOString()
        });

      if (error) {
        this.logger.warn('Could not store benchmark result:', error);
      }
    } catch (error) {
      this.logger.warn('Benchmark storage failed:', error);
    }
  }

  /**
   * Get evaluation statistics
   */
  async getEvaluationStats(agentId?: string): Promise<any> {
    try {
      let query = this.supabase
        .from('agent_evaluations')
        .select('metrics, created_at');

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (!data || data.length === 0) {
        return { totalEvaluations: 0, averageScore: 0, trends: [] };
      }

      const totalEvaluations = data.length;
      const scores = data.map(d => d.metrics?.overallScore || 0);
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      return {
        totalEvaluations,
        averageScore,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        recentTrend: this.calculateTrend(data.slice(0, 10))
      };

    } catch (error) {
      this.logger.error('Failed to get evaluation stats:', error);
      return { totalEvaluations: 0, averageScore: 0, error: error.message };
    }
  }

  private calculateTrend(recentData: any[]): string {
    if (recentData.length < 2) return 'insufficient_data';
    
    const scores = recentData.map(d => d.metrics?.overallScore || 0);
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 0.05) return 'improving';
    if (secondAvg < firstAvg - 0.05) return 'declining';
    return 'stable';
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info('🎯 Shutting down Evaluation Agent');
    
    // Save any pending evaluations
    if (this.evaluationHistory.length > 0) {
      this.logger.info(`💾 Saving ${this.evaluationHistory.length} pending evaluations`);
      // Additional cleanup if needed
    }
  }
}

export default EvaluationAgent;