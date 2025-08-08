/**
 * Code Intelligence API Router;
 * Enhanced API endpoints for code pattern recognition, analysis, and intelligent suggestions;
 * Integrates with semantic analyzer, pattern mining, and code intelligence orchestrator;
 */

import { Router } from 'express';
import { authenticateRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validate-request';
import { apiResponse } from '../utils/api-response';
import { LogContext, logger } from '../utils/enhanced-logger';
import CodeIntelligenceOrchestrator, { 
  type CodeIntelligenceQuery, 
  type LearningFeedback 
} from '../services/code-intelligence-orchestrator';'
import { createClient } from '@supabase/supabase-js';
import type { EnhancedCodeAssistantAgent } from '../agents/specialized/enhanced-code-assistant-agent';
import type { ParameterAnalyticsService } from '../services/parameter-analytics-service';
import Joi from 'joi';

const router = Router()

// Initialize services (these would be injected in production)
let codeIntelligenceOrchestrator: CodeIntelligenceOrchestrator;
let supabaseClient: any;
let codeAssistantAgent: EnhancedCodeAssistantAgent;
let parameterAnalyticsService: ParameterAnalyticsService;

// Initialize the orchestrator;
const initializeServices = async () => {
  try {
    if (!supabaseClient) {
      supabaseClient = createClient()
        process?.env?.SUPABASE_URL || 'http: //localhost:54321','
        process?.env?.SUPABASE_SERVICE_KEY || 'your-service-key''
      )
    }

    if (!codeIntelligenceOrchestrator) {
      // Import services dynamically to avoid circular dependencies;
      const { EnhancedCodeAssistantAgent } = await import('../agents/specialized/enhanced-code-assistant-agent');';
      const { ParameterAnalyticsService } = await import('../services/parameter-analytics-service');';
      
      codeAssistantAgent = new EnhancedCodeAssistantAgent()
      parameterAnalyticsService = new ParameterAnalyticsService(supabaseClient)
      
      codeIntelligenceOrchestrator = new CodeIntelligenceOrchestrator()
        supabaseClient,
        codeAssistantAgent,
        parameterAnalyticsService,
        {
          enableMLAnalysis: true,
          enablePatternLearning: true,
          maxCacheSize: 1000,
          analysisTimeout: 300000,
          confidenceThreshold: 7;
        }
      )
    }
  } catch (error) {
    logger?.error('Failed to initialize code intelligence services', LogContext?.SYSTEM, { error) });'
  }
}

// Validation schemas;
const analyzeFileSchema = {
  type: 'object','
  required: ['filePath'],'
  properties: {,
    filePath: { type: 'string', minLength: 1 },'
    options: {,
      type: 'object','
      properties: {,
        analysisDepth: { enum: ['shallow', 'medium', 'deep'] },'
        enableLearning: {, type: 'boolean' },'
        includeMLSuggestions: {, type: 'boolean' }'
      }
    }
  }
}

const analyzeDirectorySchema = {
  type: 'object','
  required: ['directoryPath'],'
  properties: {,
    directoryPath: { type: 'string', minLength: 1 },'
    options: {,
      type: 'object','
      properties: {,
        includePatterns: { type: 'array', items: {, type: 'string' } },'
        excludePatterns: {, type: 'array', items: {, type: 'string' } },'
        analysisDepth: {, enum: ['shallow', 'medium', 'deep'] },'
        enableLearning: {, type: 'boolean' }'
      }
    }
  }
}

const findPatternsSchema = {
  type: 'object','
  required: ['codeSnippet'],'
  properties: {,
    codeSnippet: { type: 'string', minLength: 1 },'
    threshold: {, type: 'number', minimum: 0, maximum: 1 },'
    options: {,
      type: 'object','
      properties: {,
        contextWindow: { type: 'number', minimum: 1 }'
      }
    }
  }
}

const feedbackSchema = {
  type: 'object','
  required: ['recommendationId', 'outcome'],'
  properties: {,
    recommendationId: { type: 'string', minLength: 1 },'
    outcome: {, enum: ['accepted', 'rejected', 'modified'] },'
    effectiveness: {, type: 'number', minimum: 0, maximum: 1 },'
    userNotes: {, type: 'string' }'
  }
}

// =====================================================
// CODE ANALYSIS ENDPOINTS;
// =====================================================

/**
 * Analyze a single file for code patterns, smells, and improvements;
 * POST /api/v1/code-intelligence/analyze/file;
 */
router?.post('/analyze/file', ')
  authenticateRequest, 
  validateRequest(analyzeFileSchema),
  async (req, res) => {
    try {
      await initializeServices()
      
      const { filePath, options = {} } = req?.body;
      
      const query: CodeIntelligenceQuery = {,;
        type: 'analyze_file','
        target: filePath,
        options: {,
          analysisDepth: options?.analysisDepth || 'medium','
          enableLearning: options?.enableLearning !== false,
          includeMLSuggestions: options?.includeMLSuggestions !== false;
        }
      }

      const result = await codeIntelligenceOrchestrator?.executeQuery(query)
      
      logger?.info('File analysis completed', LogContext?.API, { ')
        filePath, 
        patternsFound: result?.metadata?.patterns_found',
        issuesDetected: result?.metadata?.issues_detected 
      })

      return apiResponse?.success(res, result, 'File analysis completed successfully');';
    } catch (error) {
      logger?.error('File analysis failed', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'File analysis failed', 500);';
    }
  }
)

/**
 * Analyze a directory for code patterns and quality metrics;
 * POST /api/v1/code-intelligence/analyze/directory;
 */
router?.post('/analyze/directory',')
  authenticateRequest,
  validateRequest(analyzeDirectorySchema),
  async (req, res) => {
    try {
      await initializeServices()
      
      const { directoryPath, options = {} } = req?.body;
      
      const query: CodeIntelligenceQuery = {,;
        type: 'analyze_directory','
        target: directoryPath,
        options: {,
          includePatterns: options?.includePatterns || ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],'
          excludePatterns: options?.excludePatterns || ['**/node_modules/**', '**/dist/**'],'
          analysisDepth: options?.analysisDepth || 'medium','
          enableLearning: options?.enableLearning !== false;
        }
      }

      const result = await codeIntelligenceOrchestrator?.executeQuery(query)
      
      logger?.info('Directory analysis completed', LogContext?.API, { ')
        directoryPath, 
        filesAnalyzed: result?.results?.semanticAnalysis?.length || 0,
        totalPatterns: result?.metadata?.patterns_found 
      })

      return apiResponse?.success(res, result, 'Directory analysis completed successfully');';
    } catch (error) {
      logger?.error('Directory analysis failed', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Directory analysis failed', 500);';
    }
  }
)

/**
 * Find similar code patterns using ML embeddings;
 * POST /api/v1/code-intelligence/patterns/find;
 */
router?.post('/patterns/find',')
  authenticateRequest,
  validateRequest(findPatternsSchema),
  async (req, res) => {
    try {
      await initializeServices()
      
      const { codeSnippet, threshold = 0.8, options = {} } = req?.body;
      
      const query: CodeIntelligenceQuery = {,;
        type: 'find_patterns','
        target: codeSnippet,
        options: {,
          contextWindow: options?.contextWindow || 100,
        }
      }

      const result = await codeIntelligenceOrchestrator?.executeQuery(query)
      
      logger?.info('Pattern search completed', LogContext?.API, { ')
        patternsFound: result?.metadata?.patterns_found',
        confidence: result?.confidence 
      })

      return apiResponse?.success(res, result, 'Pattern search completed successfully');';
    } catch (error) {
      logger?.error('Pattern search failed', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Pattern search failed', 500);';
    }
  }
)

/**
 * Get AI-powered code suggestions and improvements;
 * POST /api/v1/code-intelligence/suggestions;
 */
router?.post('/suggestions',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const { target, context } = req?.body;
      
      if (!target) {
        return apiResponse?.error(res, 'Target code or file path is required', 400);';
      }
      
      const query: CodeIntelligenceQuery = {,;
        type: 'get_suggestions','
        target,
        context,
        options: {,
          includeMLSuggestions: true,
          enableLearning: true;
        }
      }

      const result = await codeIntelligenceOrchestrator?.executeQuery(query)
      
      logger?.info('Suggestion generation completed', LogContext?.API, { ')
        recommendationsCount: result?.results?.recommendations?.length || 0 
      })

      return apiResponse?.success(res, result, 'Suggestions generated successfully');';
    } catch (error) {
      logger?.error('Suggestion generation failed', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Suggestion generation failed', 500);';
    }
  }
)

/**
 * Detect specific code issues (security, performance, maintainability)
 * POST /api/v1/code-intelligence/detect/issues;
 */
router?.post('/detect/issues',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const { filePath, issueTypes = ['security', 'performance', 'maintainability'] } = req?.body;';
      
      if (!filePath) {
        return apiResponse?.error(res, 'File path is required', 400);';
      }
      
      const query: CodeIntelligenceQuery = {,;
        type: 'detect_issues','
        target: filePath,
        context: {,
          focusAreas: issueTypes;
        }
      }

      const result = await codeIntelligenceOrchestrator?.executeQuery(query)
      
      logger?.info('Issue detection completed', LogContext?.API, { ')
        filePath,
        issuesDetected: result?.metadata?.issues_detected',
        riskLevel: result?.results?.riskAssessment?.overall 
      })

      return apiResponse?.success(res, result, 'Issue detection completed successfully');';
    } catch (error) {
      logger?.error('Issue detection failed', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Issue detection failed', 500);';
    }
  }
)

// =====================================================
// LEARNING AND FEEDBACK ENDPOINTS;
// =====================================================

/**
 * Provide feedback on code intelligence recommendations;
 * POST /api/v1/code-intelligence/feedback;
 */
router?.post('/feedback',')
  authenticateRequest,
  validateRequest(feedbackSchema),
  async (req, res) => {
    try {
      await initializeServices()
      
      const { recommendationId, outcome, effectiveness, userNotes } = req?.body;
      
      const feedback: LearningFeedback = {
        recommendationId,
        outcome,
        effectiveness,
        userNotes,
        timestamp: new Date()
      }

      await codeIntelligenceOrchestrator?.provideFeedback(feedback)
      
      logger?.info('Feedback recorded successfully', LogContext?.API, { recommendationId, outcome) });'

      return apiResponse?.success(res, { feedbackId: recommendationId) }, 'Feedback recorded successfully');';
    } catch (error) {
      logger?.error('Failed to record feedback', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to record feedback', 500);';
    }
  }
)

/**
 * Get analytics on code intelligence performance and learning;
 * GET /api/v1/code-intelligence/analytics;
 */
router?.get('/analytics',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const analytics = await codeIntelligenceOrchestrator?.getAnalytics()
      
      logger?.info('Analytics retrieved successfully', LogContext?.API);'

      return apiResponse?.success(res, analytics, 'Analytics retrieved successfully');';
    } catch (error) {
      logger?.error('Failed to get analytics', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to get analytics', 500);';
    }
  }
)

// =====================================================
// PATTERN MANAGEMENT ENDPOINTS;
// =====================================================

/**
 * Get discovered patterns with filtering options;
 * GET /api/v1/code-intelligence/patterns;
 */
router?.get('/patterns',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const { 
        type,
        domain,
        minConfidence,
        tags,
        limit = 50,
        offset = 0 
      } = req?.query;

      // Build search query;
      const searchQuery: any = {}
      if (type) searchQuery?.type = type;
      if (domain) searchQuery?.domain = domain;
      if (minConfidence) searchQuery?.minConfidence = parseFloat(minConfidence as string)
      if (tags) searchQuery?.tags = (tags as string).split(',');'

      const patterns = await codeIntelligenceOrchestrator['patternMiningSystem'].searchPatterns(searchQuery);';
      
      // Apply pagination;
      const paginatedPatterns = patterns?.slice(parseInt(offset as string, 10), parseInt(offset as string, 10) + parseInt(limit as string, 10))
      
      logger?.info('Patterns retrieved successfully', LogContext?.API, { ')
        total: patterns?.length,
        returned: paginatedPatterns?.length 
      })

      return apiResponse?.success(res, {)
        patterns: paginatedPatterns,
        total: patterns?.length,
        offset: parseInt(offset as string, 10),
        limit: parseInt(limit as string, 10)
      }, 'Patterns retrieved successfully');'
    } catch (error) {
      logger?.error('Failed to get patterns', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to get patterns', 500);';
    }
  }
)

/**
 * Get pattern statistics and insights;
 * GET /api/v1/code-intelligence/patterns/stats;
 */
router?.get('/patterns/stats',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const stats = await codeIntelligenceOrchestrator['patternMiningSystem'].getPatternStatistics();';
      
      logger?.info('Pattern statistics retrieved successfully', LogContext?.API);'

      return apiResponse?.success(res, stats, 'Pattern statistics retrieved successfully');';
    } catch (error) {
      logger?.error('Failed to get pattern statistics', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to get pattern statistics', 500);';
    }
  }
)

// =====================================================
// SYSTEM STATUS AND HEALTH;
// =====================================================

/**
 * Get code intelligence system status;
 * GET /api/v1/code-intelligence/status;
 */
router?.get('/status',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const status = {
        systemStatus: 'operational','
        services: {,
          semanticAnalyzer: 'ready','
          patternMining: 'ready','
          orchestrator: 'ready','
          mlEmbeddings: codeIntelligenceOrchestrator ? 'ready' : 'unavailable''
        },
        capabilities: {,
          astAnalysis: true,
          patternMining: true,
          mlEmbeddings: true,
          agentSuggestions: !!codeAssistantAgent,
          learningFeedback: true;
        },
        version: '1.0.0','
        uptime: process?.uptime()
      }
      
      return apiResponse?.success(res, status, 'Code intelligence system is operational');';
    } catch (error) {
      logger?.error('Failed to get system status', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to get system status', 500);';
    }
  }
)

// =====================================================
// ENHANCED PARAMETER ANALYTICS INTEGRATION ENDPOINTS;
// =====================================================

/**
 * Get enhanced analytics with parameter analytics integration;
 * GET /api/v1/code-intelligence/analytics/enhanced;
 */
router?.get('/analytics/enhanced',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const orchestratorAnalytics = await codeIntelligenceOrchestrator?.getAnalytics()
      
      // Get code intelligence specific analytics from parameter analytics service;
      let enhancedAnalytics = {}
      if (parameterAnalyticsService) {
        enhancedAnalytics = await parameterAnalyticsService?.getCodeIntelligenceAnalytics()
      }
      
      const combinedAnalytics = {
        ...orchestratorAnalytics,
        parameterInsights: enhancedAnalytics,
        integrationStatus: {,
          orchestrator: 'operational','
          parameterAnalytics: parameterAnalyticsService ? 'operational' : 'unavailable','
          learningEnabled: true;
        }
      }
      
      logger?.info('Enhanced analytics retrieved successfully', LogContext?.API);'

      return apiResponse?.success(res, combinedAnalytics, 'Enhanced analytics retrieved successfully');';
    } catch (error) {
      logger?.error('Failed to get enhanced analytics', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to get enhanced analytics', 500);';
    }
  }
)

/**
 * Record code intelligence execution for parameter learning;
 * POST /api/v1/code-intelligence/execution/record;
 */
router?.post('/execution/record',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const { 
        queryType, 
        executionTime, 
        patternsFound, 
        confidence, 
        success,
        parameters,
        userId = 'system''
      } = req?.body;
      
      if (!queryType || executionTime === undefined) {
        return apiResponse?.error(res, 'Query type and execution time are required', 400);';
      }
      
      if (parameterAnalyticsService) {
        await parameterAnalyticsService?.recordCodeIntelligenceExecution({)
          query_type: queryType,
          execution_time: executionTime,
          patterns_found: patternsFound || 0,
          confidence_score: confidence || 0,
          success: success !== false,
          parameters: parameters || {},
          user_id: userId;
        })
      }
      
      logger?.info('Code intelligence execution recorded', LogContext?.API, { queryType, success) });'

      return apiResponse?.success(res, { recorded: true) }, 'Execution recorded successfully');';
    } catch (error) {
      logger?.error('Failed to record execution', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to record execution', 500);';
    }
  }
)

/**
 * Get enhanced parameter recommendations for code intelligence;
 * POST /api/v1/code-intelligence/recommendations/parameters;
 */
router?.post('/recommendations/parameters',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const { taskType, context = {}, codeComplexity, queryHistory } = req?.body;
      
      if (!taskType) {
        return apiResponse?.error(res, 'Task type is required', 400);';
      }
      
      let recommendations = {
        defaultRecommendations: {,
          analysisDepth: 'medium','
          enableLearning: true,
          confidenceThreshold: 7,
          includeMLSuggestions: true;
        }
      }
      
      if (parameterAnalyticsService) {
        const enhancedRecommendations = await parameterAnalyticsService?.getEnhancedParameterRecommendations()
          taskType,
          {
            codeComplexity,
            queryHistory,
            ...context;
          }
        )
        
        recommendations = {
          ...recommendations,
          enhancedRecommendations,
          learningBased: true;
        }
      }
      
      logger?.info('Parameter recommendations generated', LogContext?.API, { taskType) });'

      return apiResponse?.success(res, recommendations, 'Parameter recommendations generated successfully');';
    } catch (error) {
      logger?.error('Failed to generate parameter recommendations', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to generate parameter recommendations', 500);';
    }
  }
)

/**
 * Update recommendation feedback with parameter analytics integration;
 * POST /api/v1/code-intelligence/feedback/enhanced;
 */
router?.post('/feedback/enhanced',')
  authenticateRequest,
  validateRequest(feedbackSchema),
  async (req, res) => {
    try {
      await initializeServices()
      
      const { recommendationId, outcome, effectiveness, userNotes, executionId } = req?.body;
      
      const feedback: LearningFeedback = {
        recommendationId,
        outcome,
        effectiveness,
        userNotes,
        timestamp: new Date()
      }

      // Record feedback in orchestrator;
      await codeIntelligenceOrchestrator?.provideFeedback(feedback)
      
      // Update parameter analytics if execution ID provided;
      if (parameterAnalyticsService && executionId) {
        await parameterAnalyticsService?.updateRecommendationFeedback(executionId, {)
          outcome,
          effectiveness,
          user_notes: userNotes,
          feedback_timestamp: new Date()
        })
      }
      
      logger?.info('Enhanced feedback recorded successfully', LogContext?.API, { recommendationId, outcome) });'

      return apiResponse?.success(res, {)
        feedbackId: recommendationId,
        parameterLearningUpdated: !!executionId;
      }, 'Enhanced feedback recorded successfully');'
    } catch (error) {
      logger?.error('Failed to record enhanced feedback', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to record enhanced feedback', 500);';
    }
  }
)

/**
 * Get code intelligence learning insights;
 * GET /api/v1/code-intelligence/insights/learning;
 */
router?.get('/insights/learning',')
  authenticateRequest,
  async (req, res) => {
    try {
      await initializeServices()
      
      const { timeRange, queryType, userId } = req?.query;
      
      let insights = {
        basicInsights: {,
          totalQueries: 0,
          averageSuccess: 0,
          commonPatterns: []
        }
      }
      
      if (parameterAnalyticsService) {
        const learningInsights = await parameterAnalyticsService?.getCodeIntelligenceAnalytics()
        
        insights = {
          ...insights,
          advancedInsights: learningInsights,
          filters: {,
            timeRange: timeRange || 'all','
            queryType: queryType || 'all','
            userId: userId || 'all''
          },
          learningEnabled: true;
        }
      }
      
      logger?.info('Learning insights retrieved', LogContext?.API);'

      return apiResponse?.success(res, insights, 'Learning insights retrieved successfully');';
    } catch (error) {
      logger?.error('Failed to get learning insights', LogContext?.API, { error) });'
      return apiResponse?.error(res, 'Failed to get learning insights', 500);';
    }
  }
)

export default router;