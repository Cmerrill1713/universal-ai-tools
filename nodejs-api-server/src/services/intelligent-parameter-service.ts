/**
 * Intelligent Parameter Service
 * ML-based parameter optimization for all LLM calls
 */

import { createClient } from '@supabase/supabase-js';
import { OllamaIntegrationService } from './ollama-integration';

interface ParameterOptimizationRequest {
  model: string;
  taskType: 'text_generation' | 'chat' | 'analysis' | 'code_generation' | 'summarization' | 'translation';
  context: any;
  userPreferences?: UserPreferences;
  performanceGoals: ('accuracy' | 'speed' | 'creativity' | 'consistency')[];
  historicalData?: any[];
}

interface ParameterOptimizationResponse {
  success: boolean;
  optimizedParameters: OptimizedParameters;
  confidence: number;
  reasoning: string;
  alternatives: OptimizedParameters[];
  performancePrediction: PerformancePrediction;
  learningData?: any;
  error?: string;
}

interface OptimizedParameters {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  num_predict: number;
  num_ctx: number;
  seed?: number;
  stop?: string[];
  custom?: Record<string, any>;
}

interface UserPreferences {
  creativity: number; // 0-1
  formality: number; // 0-1
  verbosity: number; // 0-1
  technicality: number; // 0-1
  consistency: number; // 0-1
}

interface PerformancePrediction {
  expectedAccuracy: number;
  expectedSpeed: number;
  expectedCreativity: number;
  expectedConsistency: number;
  confidence: number;
}

interface ParameterLearningData {
  request: ParameterOptimizationRequest;
  parameters: OptimizedParameters;
  actualPerformance: any;
  userFeedback?: number;
  timestamp: Date;
  userId: string;
  sessionId: string;
}

interface ParameterAnalytics {
  totalOptimizations: number;
  averageConfidence: number;
  performanceByTaskType: Record<string, any>;
  userSatisfaction: number;
  topPerformingParameters: OptimizedParameters[];
  learningTrends: any[];
}

class IntelligentParameterService {
  private ollamaService: OllamaIntegrationService;
  private supabase: any;
  private learningData: ParameterLearningData[] = [];
  private parameterCache: Map<string, OptimizedParameters> = new Map();
  private analytics: ParameterAnalytics;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.ollamaService = new OllamaIntegrationService();
    this.analytics = this.initializeAnalytics();
  }

  /**
   * Initialize Intelligent Parameter Service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎯 Initializing Intelligent Parameter Service...');
      
      // Initialize Ollama service
      await this.ollamaService.initialize();
      
      // Load existing learning data
      await this.loadLearningData();
      
      console.log('✅ Intelligent Parameter Service initialized successfully');
    } catch (error) {
      console.error('❌ Intelligent Parameter Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize analytics
   */
  private initializeAnalytics(): ParameterAnalytics {
    return {
      totalOptimizations: 0,
      averageConfidence: 0,
      performanceByTaskType: {},
      userSatisfaction: 0,
      topPerformingParameters: [],
      learningTrends: []
    };
  }

  /**
   * Optimize parameters for a given request
   */
  async optimizeParameters(request: ParameterOptimizationRequest): Promise<ParameterOptimizationResponse> {
    try {
      console.log(`🎯 Optimizing parameters for ${request.taskType} task`);

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedParams = this.parameterCache.get(cacheKey);
      if (cachedParams) {
        console.log('📋 Using cached parameters');
        return {
          success: true,
          optimizedParameters: cachedParams,
          confidence: 0.8,
          reasoning: 'Parameters retrieved from cache',
          alternatives: [],
          performancePrediction: this.predictPerformance(cachedParams, request)
        };
      }

      // Generate optimized parameters using ML-based approach
      const optimizedParams = await this.generateOptimizedParameters(request);
      
      // Generate alternatives
      const alternatives = await this.generateParameterAlternatives(request, optimizedParams);
      
      // Predict performance
      const performancePrediction = this.predictPerformance(optimizedParams, request);
      
      // Calculate confidence
      const confidence = this.calculateConfidence(optimizedParams, request);

      // Cache the results
      this.parameterCache.set(cacheKey, optimizedParams);

      // Store learning data
      const learningData: ParameterLearningData = {
        request,
        parameters: optimizedParams,
        actualPerformance: null, // Will be updated after execution
        timestamp: new Date(),
        userId: request.context.userId || 'unknown',
        sessionId: request.context.sessionId || 'unknown'
      };
      this.learningData.push(learningData);

      return {
        success: true,
        optimizedParameters: optimizedParams,
        confidence,
        reasoning: this.generateReasoning(optimizedParams, request),
        alternatives,
        performancePrediction,
        learningData
      };

    } catch (error) {
      console.error('Error optimizing parameters:', error);
      return {
        success: false,
        optimizedParameters: this.getDefaultParameters(request.taskType),
        confidence: 0,
        reasoning: 'Failed to optimize parameters, using defaults',
        alternatives: [],
        performancePrediction: {
          expectedAccuracy: 0.5,
          expectedSpeed: 0.5,
          expectedCreativity: 0.5,
          expectedConsistency: 0.5,
          confidence: 0
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate optimized parameters using ML-based approach
   */
  private async generateOptimizedParameters(request: ParameterOptimizationRequest): Promise<OptimizedParameters> {
    // Use Ollama to analyze the request and generate optimal parameters
    const analysisPrompt = `Analyze the following request and generate optimal LLM parameters.

Task Type: ${request.taskType}
Context: ${JSON.stringify(request.context, null, 2)}
User Preferences: ${JSON.stringify(request.userPreferences || {}, null, 2)}
Performance Goals: ${request.performanceGoals.join(', ')}

Generate optimal parameters considering:
- Task complexity and requirements
- User preferences and style
- Performance goals (accuracy, speed, creativity, consistency)
- Historical performance data

Respond with JSON containing:
- temperature (0.0-2.0)
- top_p (0.0-1.0)
- top_k (1-100)
- repeat_penalty (0.0-2.0)
- num_predict (50-4000)
- num_ctx (512-8192)
- reasoning for the choices`;

    try {
      const response = await this.ollamaService.generateText({
        model: 'llama3.2:3b',
        prompt: analysisPrompt,
        options: {
          temperature: 0.3, // Low temperature for consistent parameter generation
          num_predict: 1000
        }
      });

      // Parse the response
      const analysis = JSON.parse(response.response);
      
      return {
        temperature: this.clamp(analysis.temperature || 0.7, 0.0, 2.0),
        top_p: this.clamp(analysis.top_p || 0.9, 0.0, 1.0),
        top_k: this.clamp(analysis.top_k || 40, 1, 100),
        repeat_penalty: this.clamp(analysis.repeat_penalty || 1.1, 0.0, 2.0),
        num_predict: this.clamp(analysis.num_predict || 2000, 50, 4000),
        num_ctx: this.clamp(analysis.num_ctx || 4000, 512, 8192),
        seed: analysis.seed,
        stop: analysis.stop || [],
        custom: analysis.custom || {}
      };

    } catch (error) {
      console.warn('Failed to generate optimized parameters with ML, using rule-based approach');
      return this.generateRuleBasedParameters(request);
    }
  }

  /**
   * Generate rule-based parameters as fallback
   */
  private generateRuleBasedParameters(request: ParameterOptimizationRequest): OptimizedParameters {
    const baseParams = this.getDefaultParameters(request.taskType);
    
    // Adjust based on user preferences
    if (request.userPreferences) {
      const prefs = request.userPreferences;
      
      // Adjust temperature based on creativity preference
      baseParams.temperature = 0.3 + (prefs.creativity * 1.4);
      
      // Adjust verbosity based on verbosity preference
      baseParams.num_predict = Math.round(500 + (prefs.verbosity * 2000));
      
      // Adjust consistency based on consistency preference
      baseParams.repeat_penalty = 1.0 + (prefs.consistency * 0.5);
    }

    // Adjust based on performance goals
    if (request.performanceGoals.includes('speed')) {
      baseParams.num_predict = Math.min(baseParams.num_predict, 1000);
      baseParams.num_ctx = Math.min(baseParams.num_ctx, 2048);
    }
    
    if (request.performanceGoals.includes('accuracy')) {
      baseParams.temperature = Math.max(baseParams.temperature - 0.2, 0.1);
      baseParams.top_p = Math.max(baseParams.top_p - 0.1, 0.7);
    }
    
    if (request.performanceGoals.includes('creativity')) {
      baseParams.temperature = Math.min(baseParams.temperature + 0.3, 1.5);
      baseParams.top_p = Math.min(baseParams.top_p + 0.1, 1.0);
    }

    return baseParams;
  }

  /**
   * Generate parameter alternatives
   */
  private async generateParameterAlternatives(
    request: ParameterOptimizationRequest, 
    primaryParams: OptimizedParameters
  ): Promise<OptimizedParameters[]> {
    const alternatives: OptimizedParameters[] = [];

    // Conservative alternative (lower temperature, more focused)
    alternatives.push({
      ...primaryParams,
      temperature: Math.max(primaryParams.temperature - 0.2, 0.1),
      top_p: Math.max(primaryParams.top_p - 0.1, 0.7),
      repeat_penalty: Math.min(primaryParams.repeat_penalty + 0.1, 1.5)
    });

    // Creative alternative (higher temperature, more diverse)
    alternatives.push({
      ...primaryParams,
      temperature: Math.min(primaryParams.temperature + 0.3, 1.5),
      top_p: Math.min(primaryParams.top_p + 0.1, 1.0),
      top_k: Math.min(primaryParams.top_k + 20, 100)
    });

    // Fast alternative (shorter responses)
    alternatives.push({
      ...primaryParams,
      num_predict: Math.max(primaryParams.num_predict - 500, 200),
      num_ctx: Math.max(primaryParams.num_ctx - 1000, 1024)
    });

    return alternatives;
  }

  /**
   * Predict performance for given parameters
   */
  private predictPerformance(params: OptimizedParameters, request: ParameterOptimizationRequest): PerformancePrediction {
    // Simple performance prediction based on parameter values
    const expectedAccuracy = this.calculateAccuracyScore(params, request);
    const expectedSpeed = this.calculateSpeedScore(params);
    const expectedCreativity = this.calculateCreativityScore(params);
    const expectedConsistency = this.calculateConsistencyScore(params);
    
    const confidence = this.calculatePredictionConfidence(params, request);

    return {
      expectedAccuracy,
      expectedSpeed,
      expectedCreativity,
      expectedConsistency,
      confidence
    };
  }

  /**
   * Calculate accuracy score
   */
  private calculateAccuracyScore(params: OptimizedParameters, request: ParameterOptimizationRequest): number {
    let score = 0.5; // Base score
    
    // Lower temperature generally means higher accuracy
    if (params.temperature < 0.5) score += 0.2;
    else if (params.temperature > 1.0) score -= 0.1;
    
    // Higher top_p means more focused responses
    if (params.top_p > 0.9) score += 0.1;
    
    // Task-specific adjustments
    if (request.taskType === 'analysis' || request.taskType === 'code_generation') {
      score += 0.1; // These tasks benefit from lower temperature
    }
    
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate speed score
   */
  private calculateSpeedScore(params: OptimizedParameters): number {
    let score = 1.0; // Base score
    
    // Shorter responses are faster
    if (params.num_predict < 1000) score += 0.2;
    else if (params.num_predict > 3000) score -= 0.3;
    
    // Smaller context is faster
    if (params.num_ctx < 2048) score += 0.1;
    else if (params.num_ctx > 6000) score -= 0.2;
    
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate creativity score
   */
  private calculateCreativityScore(params: OptimizedParameters): number {
    let score = 0.5; // Base score
    
    // Higher temperature means more creativity
    if (params.temperature > 0.8) score += 0.3;
    else if (params.temperature < 0.3) score -= 0.2;
    
    // Higher top_p means more diversity
    if (params.top_p > 0.95) score += 0.1;
    
    // Higher top_k means more options
    if (params.top_k > 60) score += 0.1;
    
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(params: OptimizedParameters): number {
    let score = 0.5; // Base score
    
    // Lower temperature means more consistency
    if (params.temperature < 0.5) score += 0.3;
    else if (params.temperature > 1.0) score -= 0.2;
    
    // Higher repeat_penalty means less repetition
    if (params.repeat_penalty > 1.2) score += 0.1;
    
    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(params: OptimizedParameters, request: ParameterOptimizationRequest): number {
    let confidence = 0.5; // Base confidence
    
    // More historical data means higher confidence
    const historicalData = this.getHistoricalData(request.taskType);
    if (historicalData.length > 10) confidence += 0.2;
    else if (historicalData.length > 5) confidence += 0.1;
    
    // Parameter values within normal ranges increase confidence
    if (params.temperature >= 0.1 && params.temperature <= 1.5) confidence += 0.1;
    if (params.top_p >= 0.7 && params.top_p <= 1.0) confidence += 0.1;
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Get default parameters for task type
   */
  private getDefaultParameters(taskType: string): OptimizedParameters {
    const defaults: Record<string, OptimizedParameters> = {
      text_generation: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        num_predict: 2000,
        num_ctx: 4000
      },
      chat: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1,
        num_predict: 1000,
        num_ctx: 4000
      },
      analysis: {
        temperature: 0.3,
        top_p: 0.8,
        top_k: 20,
        repeat_penalty: 1.2,
        num_predict: 1500,
        num_ctx: 4000
      },
      code_generation: {
        temperature: 0.2,
        top_p: 0.8,
        top_k: 20,
        repeat_penalty: 1.3,
        num_predict: 2000,
        num_ctx: 6000
      },
      summarization: {
        temperature: 0.3,
        top_p: 0.8,
        top_k: 20,
        repeat_penalty: 1.1,
        num_predict: 500,
        num_ctx: 4000
      },
      translation: {
        temperature: 0.1,
        top_p: 0.7,
        top_k: 10,
        repeat_penalty: 1.2,
        num_predict: 1000,
        num_ctx: 4000
      }
    };

    return defaults[taskType] || defaults.text_generation;
  }

  /**
   * Generate reasoning for parameter choices
   */
  private generateReasoning(params: OptimizedParameters, request: ParameterOptimizationRequest): string {
    const reasoning = [];
    
    reasoning.push(`Temperature ${params.temperature} for ${params.temperature < 0.5 ? 'focused' : 'creative'} responses`);
    reasoning.push(`Top-p ${params.top_p} for ${params.top_p > 0.9 ? 'diverse' : 'focused'} token selection`);
    reasoning.push(`Top-k ${params.top_k} for ${params.top_k > 50 ? 'broad' : 'narrow'} vocabulary`);
    reasoning.push(`Repeat penalty ${params.repeat_penalty} for ${params.repeat_penalty > 1.2 ? 'low' : 'moderate'} repetition`);
    reasoning.push(`Max tokens ${params.num_predict} for ${params.num_predict > 2000 ? 'detailed' : 'concise'} responses`);
    
    if (request.performanceGoals.includes('speed')) {
      reasoning.push('Optimized for speed with shorter context and response length');
    }
    if (request.performanceGoals.includes('accuracy')) {
      reasoning.push('Optimized for accuracy with lower temperature and focused sampling');
    }
    if (request.performanceGoals.includes('creativity')) {
      reasoning.push('Optimized for creativity with higher temperature and diverse sampling');
    }

    return reasoning.join('; ');
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(params: OptimizedParameters, request: ParameterOptimizationRequest): number {
    const predictionConfidence = this.calculatePredictionConfidence(params, request);
    const historicalConfidence = this.getHistoricalConfidence(request.taskType);
    
    return (predictionConfidence + historicalConfidence) / 2;
  }

  /**
   * Get historical confidence for task type
   */
  private getHistoricalConfidence(taskType: string): number {
    const historicalData = this.getHistoricalData(taskType);
    if (historicalData.length === 0) return 0.5;
    
    const avgConfidence = historicalData.reduce((sum, data) => sum + (data.actualPerformance?.confidence || 0.5), 0) / historicalData.length;
    return avgConfidence;
  }

  /**
   * Get historical data for task type
   */
  private getHistoricalData(taskType: string): ParameterLearningData[] {
    return this.learningData.filter(data => data.request.taskType === taskType);
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(request: ParameterOptimizationRequest): string {
    const key = `${request.model}_${request.taskType}_${JSON.stringify(request.userPreferences || {})}_${request.performanceGoals.join(',')}`;
    return Buffer.from(key).toString('base64').substring(0, 32);
  }

  /**
   * Clamp value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Load learning data from database
   */
  private async loadLearningData(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('parameter_learning_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error) {
        console.warn('Could not load learning data:', error);
        return;
      }

      data?.forEach((item: any) => {
        this.learningData.push({
          request: item.request,
          parameters: item.parameters,
          actualPerformance: item.actual_performance,
          userFeedback: item.user_feedback,
          timestamp: new Date(item.timestamp),
          userId: item.user_id,
          sessionId: item.session_id
        });
      });

      console.log(`📚 Loaded ${this.learningData.length} parameter learning records`);

    } catch (error) {
      console.warn('Error loading learning data:', error);
    }
  }

  /**
   * Update performance data after execution
   */
  async updatePerformanceData(
    learningDataId: string,
    actualPerformance: any,
    userFeedback?: number
  ): Promise<void> {
    try {
      // Find the learning data entry
      const learningEntry = this.learningData.find(entry => 
        entry.userId === learningDataId.split('_')[0] && 
        entry.timestamp.getTime().toString() === learningDataId.split('_')[1]
      );

      if (learningEntry) {
        learningEntry.actualPerformance = actualPerformance;
        if (userFeedback !== undefined) {
          learningEntry.userFeedback = userFeedback;
        }

        // Update in database
        await this.supabase
          .from('parameter_learning_data')
          .update({
            actual_performance: actualPerformance,
            user_feedback: userFeedback,
            updated_at: new Date().toISOString()
          })
          .eq('id', learningDataId);
      }

    } catch (error) {
      console.error('Error updating performance data:', error);
    }
  }

  /**
   * Get parameter analytics
   */
  getAnalytics(): ParameterAnalytics {
    const totalOptimizations = this.learningData.length;
    const averageConfidence = this.learningData.length > 0 ? 
      this.learningData.reduce((sum, data) => sum + (data.actualPerformance?.confidence || 0.5), 0) / this.learningData.length : 0;
    
    const performanceByTaskType: Record<string, any> = {};
    this.learningData.forEach(data => {
      if (!performanceByTaskType[data.request.taskType]) {
        performanceByTaskType[data.request.taskType] = { count: 0, avgConfidence: 0 };
      }
      performanceByTaskType[data.request.taskType].count++;
    });

    const userSatisfaction = this.learningData.length > 0 ?
      this.learningData.reduce((sum, data) => sum + (data.userFeedback || 0.5), 0) / this.learningData.length : 0;

    return {
      totalOptimizations,
      averageConfidence,
      performanceByTaskType,
      userSatisfaction,
      topPerformingParameters: this.getTopPerformingParameters(),
      learningTrends: this.getLearningTrends()
    };
  }

  /**
   * Get top performing parameters
   */
  private getTopPerformingParameters(): OptimizedParameters[] {
    return this.learningData
      .filter(data => data.actualPerformance?.confidence > 0.8)
      .sort((a, b) => (b.actualPerformance?.confidence || 0) - (a.actualPerformance?.confidence || 0))
      .slice(0, 5)
      .map(data => data.parameters);
  }

  /**
   * Get learning trends
   */
  private getLearningTrends(): any[] {
    // Group by week and calculate average performance
    const weeklyData: Record<string, any> = {};
    
    this.learningData.forEach(data => {
      const week = data.timestamp.toISOString().substring(0, 10); // YYYY-MM-DD
      if (!weeklyData[week]) {
        weeklyData[week] = { count: 0, totalConfidence: 0 };
      }
      weeklyData[week].count++;
      weeklyData[week].totalConfidence += data.actualPerformance?.confidence || 0.5;
    });

    return Object.entries(weeklyData).map(([week, data]) => ({
      week,
      count: data.count,
      avgConfidence: data.totalConfidence / data.count
    }));
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<any> {
    const ollamaStatus = await this.ollamaService.getStatus();
    const analytics = this.getAnalytics();
    
    return {
      initialized: true,
      ollamaStatus,
      learningDataCount: this.learningData.length,
      cacheSize: this.parameterCache.size,
      analytics,
      availableTaskTypes: [
        'text_generation',
        'chat',
        'analysis',
        'code_generation',
        'summarization',
        'translation'
      ]
    };
  }

  /**
   * Shutdown service
   */
  async shutdown(): Promise<void> {
    await this.ollamaService.shutdown();
    console.log('🛑 Intelligent Parameter Service shutdown');
  }
}

export { 
  IntelligentParameterService, 
  ParameterOptimizationRequest, 
  ParameterOptimizationResponse, 
  OptimizedParameters, 
  UserPreferences, 
  PerformancePrediction,
  ParameterLearningData,
  ParameterAnalytics
};