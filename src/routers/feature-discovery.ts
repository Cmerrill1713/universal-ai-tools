/**
 * Feature Discovery Router
 * Provides endpoints for discovering features, agents, and capabilities
 * Helps users find what they need more effectively
 */

import { Router } from 'express';

import { authRequired } from '@/middleware/auth';
import { sendError, sendSuccess } from '@/utils/api-response';
import { log, LogContext } from '@/utils/logger';

const router = Router();

/**
 * POST /api/v1/features/discover
 * Discover features based on user intent and query
 */
router.post('/discover', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const {
      query,
      keywords = [],
      category,
      difficulty,
      type,
      limit = 10,
      includeExamples = true,
      personalizeResults = true,
    } = req.body;

    if (!query || typeof query !== 'string') {
      return sendError(res, 'VALIDATION_ERROR', 'Query is required', 400);
    }

    const userIntent = {
      query,
      keywords: Array.isArray(keywords) ? keywords : [],
      category,
      difficulty,
      type,
    };

    const userId = (req as any).user?.id || 'anonymous';

    const result = await featureDiscoveryService.discoverFeatures(
      userIntent,
      userId,
      {
        limit,
        includeExamples,
        personalizeResults,
        filterByDifficulty: true,
      }
    );

    sendSuccess(res, {
      status: 'success',
      data: result,
      meta: {
        query,
        userId: userId !== 'anonymous' ? userId : undefined,
        timestamp: new Date().toISOString(),
      },
    });

    log.info('🔍 Feature discovery completed', LogContext.API, {
      query,
      resultCount: result.features.length,
      confidence: result.confidence,
      searchTime: result.searchTime,
      userId: userId !== 'anonymous' ? userId : undefined,
    });
  } catch (error) {
    log.error('❌ Feature discovery failed', LogContext.API, { error });
    sendError(res, 'FEATURE_DISCOVERY_ERROR', 'Failed to discover features', 500);
  }
});

/**
 * GET /api/v1/features/search
 * Search features by text query with optional filters
 */
router.get('/search', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const {
      q: query,
      category,
      type,
      difficulty,
      tags,
      limit = 20,
    } = req.query;

    if (!query || typeof query !== 'string') {
      return sendError(res, 'VALIDATION_ERROR', 'Query parameter "q" is required', 400);
    }

    const filters: any = {};
    if (category) filters.category = category;
    if (type) filters.type = type;
    if (difficulty) filters.difficulty = difficulty;
    if (tags) {
      filters.tags = typeof tags === 'string' ? tags.split(',') : tags;
    }

    const features = await featureDiscoveryService.searchFeatures(
      query,
      filters,
      parseInt(limit as string) || 20
    );

    sendSuccess(res, {
      status: 'success',
      data: {
        features,
        query,
        filters,
        totalResults: features.length,
      },
    });

    log.info('🔍 Feature search completed', LogContext.API, {
      query,
      filters,
      resultCount: features.length,
    });
  } catch (error) {
    log.error('❌ Feature search failed', LogContext.API, { error });
    sendError(res, 'FEATURE_SEARCH_ERROR', 'Failed to search features', 500);
  }
});

/**
 * GET /api/v1/features/recommendations
 * Get personalized feature recommendations for the user
 */
router.get('/recommendations', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 5;

    if (!userId || userId === 'anonymous') {
      return sendError(res, 'AUTHENTICATION_ERROR', 'User authentication required for recommendations', 401);
    }

    const recommendations = await featureDiscoveryService.getRecommendations(userId, limit);

    sendSuccess(res, {
      status: 'success',
      data: {
        recommendations,
        userId,
        timestamp: new Date().toISOString(),
      },
    });

    log.info('💡 Recommendations generated', LogContext.API, {
      userId,
      recommendationCount: recommendations.length,
    });
  } catch (error) {
    log.error('❌ Recommendations failed', LogContext.API, { error });
    sendError(res, 'RECOMMENDATIONS_ERROR', 'Failed to get recommendations', 500);
  }
});

/**
 * GET /api/v1/features/categories
 * Get all available feature categories
 */
router.get('/categories', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const categories = featureDiscoveryService.getCategories();

    sendSuccess(res, {
      status: 'success',
      data: {
        categories,
        totalCategories: categories.length,
      },
    });
  } catch (error) {
    log.error('❌ Failed to get categories', LogContext.API, { error });
    sendError(res, 'CATEGORIES_ERROR', 'Failed to get categories', 500);
  }
});

/**
 * GET /api/v1/features/categories/:categoryId
 * Get features in a specific category
 */
router.get('/categories/:categoryId', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const { categoryId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const features = featureDiscoveryService.getFeaturesByCategory(categoryId, limit);

    if (features.length === 0) {
      return sendError(res, 'NOT_FOUND', `No features found in category: ${categoryId}`, 404);
    }

    sendSuccess(res, {
      status: 'success',
      data: {
        category: categoryId,
        features,
        totalFeatures: features.length,
      },
    });
  } catch (error) {
    log.error('❌ Failed to get category features', LogContext.API, { error });
    sendError(res, 'CATEGORY_FEATURES_ERROR', 'Failed to get category features', 500);
  }
});

/**
 * POST /api/v1/features/usage/:featureId
 * Track feature usage for analytics and recommendations
 */
router.post('/usage/:featureId', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const { featureId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId || userId === 'anonymous') {
      return sendError(res, 'AUTHENTICATION_ERROR', 'User authentication required for usage tracking', 401);
    }

    await featureDiscoveryService.trackFeatureUsage(userId, featureId);

    sendSuccess(res, {
      status: 'success',
      data: {
        message: 'Feature usage tracked successfully',
        featureId,
        userId,
        timestamp: new Date().toISOString(),
      },
    });

    log.info('📊 Feature usage tracked', LogContext.API, {
      featureId,
      userId,
    });
  } catch (error) {
    log.error('❌ Failed to track feature usage', LogContext.API, { error });
    sendError(res, 'USAGE_TRACKING_ERROR', 'Failed to track feature usage', 500);
  }
});

/**
 * GET /api/v1/features/analytics
 * Get feature discovery analytics and statistics
 */
router.get('/analytics', authRequired, async (req, res) => {
  try {
    const { featureDiscoveryService } = await import('../services/feature-discovery-service');
    
    const analytics = featureDiscoveryService.getAnalytics();

    sendSuccess(res, {
      status: 'success',
      data: {
        analytics,
        timestamp: new Date().toISOString(),
      },
    });

    log.info('📊 Feature analytics retrieved', LogContext.API, {
      totalFeatures: analytics.totalFeatures,
      totalUsers: analytics.totalUsers,
    });
  } catch (error) {
    log.error('❌ Failed to get feature analytics', LogContext.API, { error });
    sendError(res, 'ANALYTICS_ERROR', 'Failed to get feature analytics', 500);
  }
});

/**
 * GET /api/v1/features/help
 * Get help and examples for using the feature discovery system
 */
router.get('/help', async (req, res) => {
  try {
    const helpData = {
      overview: 'Feature Discovery API helps users find and learn about available features, agents, and capabilities.',
      
      endpoints: [
        {
          endpoint: 'POST /api/v1/features/discover',
          description: 'Discover features based on natural language queries',
          example: {
            body: {
              query: 'I want to detect faces in photos',
              keywords: ['face', 'photos', 'detection'],
              limit: 5,
            },
          },
        },
        {
          endpoint: 'GET /api/v1/features/search',
          description: 'Search features with text and filters',
          example: {
            url: '/api/v1/features/search?q=photo&category=photos&limit=10',
          },
        },
        {
          endpoint: 'GET /api/v1/features/recommendations',
          description: 'Get personalized feature recommendations',
        },
        {
          endpoint: 'GET /api/v1/features/categories',
          description: 'List all available feature categories',
        },
      ],

      exampleQueries: [
        'I want to detect faces in my family photos',
        'Help me debug my JavaScript code',
        'Create visualizations from my data',
        'Organize my photo collection',
        'Generate content for my blog',
        'Automate my daily tasks',
        'Research artificial intelligence trends',
      ],

      categories: [
        { id: 'photos', name: 'Photo & Image Processing', icon: '📸' },
        { id: 'code', name: 'Code Development', icon: '💻' },
        { id: 'data', name: 'Data Analysis', icon: '📊' },
        { id: 'writing', name: 'Writing & Content', icon: '✍️' },
        { id: 'research', name: 'Research & Knowledge', icon: '🔬' },
        { id: 'automation', name: 'Automation & Tasks', icon: '🤖' },
      ],

      tips: [
        'Use natural language in your queries - describe what you want to accomplish',
        'Include specific keywords related to your task',
        'Specify your experience level (beginner/intermediate/advanced) for better results',
        'Try different categories if you\'re not finding what you need',
        'Track feature usage to get better personalized recommendations',
      ],
    };

    sendSuccess(res, {
      status: 'success',
      data: helpData,
    });
  } catch (error) {
    log.error('❌ Failed to get help data', LogContext.API, { error });
    sendError(res, 'HELP_ERROR', 'Failed to get help data', 500);
  }
});

/**
 * POST /api/v1/features/guided-discovery
 * Guided discovery flow - asks follow-up questions to better understand user needs
 */
router.post('/guided-discovery', authRequired, async (req, res) => {
  try {
    const { initialQuery, answers = [] } = req.body;

    if (!initialQuery) {
      return sendError(res, 'VALIDATION_ERROR', 'Initial query is required', 400);
    }

    // Simple guided discovery logic
    const questions = [
      {
        id: 'experience',
        question: 'What is your experience level with AI tools?',
        options: ['Beginner', 'Intermediate', 'Expert'],
      },
      {
        id: 'goal',
        question: 'What is your primary goal?',
        options: ['Learn something new', 'Solve a specific problem', 'Automate a task', 'Create content'],
      },
      {
        id: 'category',
        question: 'Which area interests you most?',
        options: ['Photos & Images', 'Code Development', 'Data Analysis', 'Writing', 'Research', 'Automation'],
      },
    ];

    const currentStep = answers.length;
    
    if (currentStep < questions.length) {
      // Return next question
      sendSuccess(res, {
        status: 'question',
        data: {
          question: questions[currentStep],
          progress: {
            current: currentStep + 1,
            total: questions.length,
          },
          initialQuery,
          answers,
        },
      });
    } else {
      // Process answers and provide recommendations
      const { featureDiscoveryService } = await import('../services/feature-discovery-service');
      
      // Convert answers to search parameters
      const experienceLevel = answers.find((a: any) => a.questionId === 'experience')?.answer?.toLowerCase();
      const goalAnswer = answers.find((a: any) => a.questionId === 'goal')?.answer;
      const categoryAnswer = answers.find((a: any) => a.questionId === 'category')?.answer;

      // Map category answers to internal categories
      const categoryMap: Record<string, string> = {
        'Photos & Images': 'photos',
        'Code Development': 'code',
        'Data Analysis': 'data',
        'Writing': 'writing',
        'Research': 'research',
        'Automation': 'automation',
      };

      const userIntent = {
        query: initialQuery,
        keywords: [goalAnswer, categoryAnswer].filter(Boolean).map(s => s.toLowerCase()),
        category: categoryMap[categoryAnswer] || undefined,
        difficulty: experienceLevel,
      };

      const result = await featureDiscoveryService.discoverFeatures(
        userIntent,
        (req as any).user?.id || 'anonymous',
        {
          limit: 8,
          includeExamples: true,
          personalizeResults: false, // Use guided answers instead
          filterByDifficulty: true,
        }
      );

      sendSuccess(res, {
        status: 'completed',
        data: {
          recommendations: result.features,
          explanation: `Based on your ${experienceLevel || 'intermediate'} experience level and interest in ${categoryAnswer || 'various areas'}, here are the best features for you:`,
          userIntent,
          answers,
          confidence: result.confidence,
        },
      });
    }
  } catch (error) {
    log.error('❌ Guided discovery failed', LogContext.API, { error });
    sendError(res, 'GUIDED_DISCOVERY_ERROR', 'Failed to process guided discovery', 500);
  }
});

export default router;