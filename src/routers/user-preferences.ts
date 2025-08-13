/**
 * User Preferences Router
 * API endpoints for user preference learning and personalization
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import type { ContextVector, UserInteraction } from '../services/user-preference-learning-service';
import { userPreferenceLearningService } from '../services/user-preference-learning-service';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

// Simple auth middleware (replace with your actual auth system)
const requireAuth = (req: Request, res: Response, next: any) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
  }
  (req as any).userId = userId;
  next();
};

router.use(requireAuth);

// ============================================================================
// Model Recommendation Endpoints
// ============================================================================

/**
 * Get personalized model recommendations
 * POST /api/v1/user-preferences/recommendations
 */
router.post('/recommendations', async (req: Request, res: Response) => {
  try {
    const { context, topN = 3 } = req.body;
    const { userId } = req as any;

    if (!context) {
      return sendError(res, 'VALIDATION_ERROR', 'Context is required for recommendations');
    }

    // Validate context structure
    const contextVector: ContextVector = {
      taskType: context.taskType || 'general',
      complexity: Math.max(0, Math.min(1, context.complexity || 0.5)),
      urgency: Math.max(0, Math.min(1, context.urgency || 0.5)),
      creativity: Math.max(0, Math.min(1, context.creativity || 0.5)),
      technicalLevel: Math.max(0, Math.min(1, context.technicalLevel || 0.5)),
      previousContext: context.previousContext,
      userMood: context.userMood,
      timeOfDay: context.timeOfDay,
    };

    const recommendations = await userPreferenceLearningService.getModelRecommendations(
      userId,
      contextVector,
      Math.min(10, Math.max(1, topN))
    );

    log.info('🎯 Model recommendations generated', LogContext.API, {
      userId,
      taskType: contextVector.taskType,
      recommendationCount: recommendations.length,
    });

    sendSuccess(res, {
      recommendations,
      context: contextVector,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('❌ Failed to get model recommendations', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to generate recommendations');
  }
});

/**
 * Get personalized model selection (single best model)
 * POST /api/v1/user-preferences/select-model
 */
router.post('/select-model', async (req: Request, res: Response) => {
  try {
    const { context } = req.body;
    const { userId } = req as any;

    if (!context) {
      return sendError(res, 'VALIDATION_ERROR', 'Context is required for model selection');
    }

    const contextVector: ContextVector = {
      taskType: context.taskType || 'general',
      complexity: Math.max(0, Math.min(1, context.complexity || 0.5)),
      urgency: Math.max(0, Math.min(1, context.urgency || 0.5)),
      creativity: Math.max(0, Math.min(1, context.creativity || 0.5)),
      technicalLevel: Math.max(0, Math.min(1, context.technicalLevel || 0.5)),
      previousContext: context.previousContext,
      userMood: context.userMood,
      timeOfDay: context.timeOfDay,
    };

    const selectedModel = await userPreferenceLearningService.getPersonalizedModelSelection(
      userId,
      contextVector
    );

    const [modelId, providerId] = selectedModel.split(':');

    log.info('🎯 Personalized model selected', LogContext.API, {
      userId,
      modelId,
      providerId,
      taskType: contextVector.taskType,
    });

    sendSuccess(res, {
      modelId,
      providerId,
      selectedModel,
      context: contextVector,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    log.error('❌ Failed to select personalized model', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to select model');
  }
});

// ============================================================================
// Interaction Recording Endpoints
// ============================================================================

/**
 * Record user interaction with model
 * POST /api/v1/user-preferences/interactions
 */
router.post('/interactions', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      interactionType,
      modelId,
      providerId,
      prompt,
      response,
      rating,
      feedback,
      context,
      taskType,
      responseTime,
      tokenCount,
      wasRegenerated,
      corrections,
    } = req.body;

    const { userId } = req as any;

    // Validate required fields
    if (!sessionId || !interactionType || !modelId || !providerId) {
      return sendError(res, 'VALIDATION_ERROR', 
        'sessionId, interactionType, modelId, and providerId are required');
    }

    // Validate interaction type
    const validTypes = ['model_selection', 'prompt_submission', 'response_rating', 'correction', 'regeneration'];
    if (!validTypes.includes(interactionType)) {
      return sendError(res, 'VALIDATION_ERROR', 
        `Invalid interaction type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return sendError(res, 'VALIDATION_ERROR', 'Rating must be between 1 and 5');
    }

    const interaction: UserInteraction = {
      userId,
      sessionId,
      timestamp: new Date(),
      interactionType,
      modelId,
      providerId,
      prompt: prompt ? String(prompt).slice(0, 10000) : undefined, // Limit prompt length
      response: response ? String(response).slice(0, 50000) : undefined, // Limit response length
      rating: rating ? Math.max(1, Math.min(5, parseInt(rating))) : undefined,
      feedback: feedback ? String(feedback).slice(0, 2000) : undefined, // Limit feedback length
      context: context || {},
      taskType: taskType ? String(taskType).slice(0, 100) : undefined,
      responseTime: responseTime ? Math.max(0, parseInt(responseTime)) : undefined,
      tokenCount: tokenCount ? Math.max(0, parseInt(tokenCount)) : undefined,
      wasRegenerated: Boolean(wasRegenerated),
      corrections: Array.isArray(corrections) ? corrections.slice(0, 10).map(c => String(c).slice(0, 1000)) : undefined,
    };

    await userPreferenceLearningService.recordInteraction(interaction);

    log.info('📝 User interaction recorded', LogContext.API, {
      userId,
      sessionId,
      interactionType,
      modelId: `${modelId}:${providerId}`,
      hasRating: Boolean(rating),
      hasFeedback: Boolean(feedback),
    });

    sendSuccess(res, { recorded: true, timestamp: interaction.timestamp });

  } catch (error) {
    log.error('❌ Failed to record user interaction', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to record interaction');
  }
});

/**
 * Record user feedback (simplified endpoint for ratings)
 * POST /api/v1/user-preferences/feedback
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { sessionId, modelId, providerId, rating, feedback } = req.body;
    const { userId } = req as any;

    if (!sessionId || !modelId || !providerId || !rating) {
      return sendError(res, 'VALIDATION_ERROR', 
        'sessionId, modelId, providerId, and rating are required');
    }

    await userPreferenceLearningService.updateUserFeedback(
      userId,
      sessionId,
      modelId,
      providerId,
      Math.max(1, Math.min(5, parseInt(rating))),
      feedback ? String(feedback).slice(0, 2000) : undefined
    );

    log.info('👍 User feedback recorded', LogContext.API, {
      userId,
      modelId: `${modelId}:${providerId}`,
      rating,
      hasFeedback: Boolean(feedback),
    });

    sendSuccess(res, { recorded: true });

  } catch (error) {
    log.error('❌ Failed to record user feedback', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to record feedback');
  }
});

// ============================================================================
// User Insights and Analytics
// ============================================================================

/**
 * Get user preference insights
 * GET /api/v1/user-preferences/insights
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const { userId } = req as any;

    const insights = await userPreferenceLearningService.getUserInsights(userId);

    log.info('📊 User insights retrieved', LogContext.API, {
      userId,
      topModelsCount: insights.topModels?.length || 0,
      preferredTasksCount: insights.preferredTasks?.length || 0,
    });

    sendSuccess(res, insights);

  } catch (error) {
    log.error('❌ Failed to get user insights', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get insights');
  }
});

/**
 * Get user's model preferences summary
 * GET /api/v1/user-preferences/models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const { userId } = req as any;
    const { includeScore = 'true', limit = '20' } = req.query;

    const insights = await userPreferenceLearningService.getUserInsights(userId);
    
    let modelPreferences = insights.topModels || [];
    
    // Filter out scores if requested
    if (includeScore !== 'true') {
      modelPreferences = modelPreferences.map((pref: any) => ({
        model: pref.model,
        usageCount: pref.usageCount,
        avgRating: pref.avgRating,
      }));
    }
    
    // Limit results
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit))));
    modelPreferences = modelPreferences.slice(0, limitNum);

    sendSuccess(res, {
      models: modelPreferences,
      total: modelPreferences.length,
    });

  } catch (error) {
    log.error('❌ Failed to get model preferences', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get model preferences');
  }
});

/**
 * Get user's task preferences
 * GET /api/v1/user-preferences/tasks
 */
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { userId } = req as any;

    const insights = await userPreferenceLearningService.getUserInsights(userId);

    sendSuccess(res, {
      tasks: insights.preferredTasks || [],
      generalProfile: insights.generalProfile,
      total: insights.preferredTasks?.length || 0,
    });

  } catch (error) {
    log.error('❌ Failed to get task preferences', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get task preferences');
  }
});

// ============================================================================
// Preference Management
// ============================================================================

/**
 * Update user's general preferences
 * PUT /api/v1/user-preferences/general
 */
router.put('/general', async (req: Request, res: Response) => {
  try {
    const { userId } = req as any;
    const {
      responseSpeed,
      creativityLevel,
      technicalDetail,
      explainationDepth,
      preferredTone,
      languageComplexity,
    } = req.body;

    // Validate enum values
    const validResponseSpeeds = ['fast', 'balanced', 'quality'];
    const validTones = ['professional', 'friendly', 'neutral'];
    const validComplexities = ['simple', 'moderate', 'advanced'];

    if (responseSpeed && !validResponseSpeeds.includes(responseSpeed)) {
      return sendError(res, 'VALIDATION_ERROR', 
        `Invalid responseSpeed. Must be one of: ${validResponseSpeeds.join(', ')}`);
    }

    if (preferredTone && !validTones.includes(preferredTone)) {
      return sendError(res, 'VALIDATION_ERROR', 
        `Invalid preferredTone. Must be one of: ${validTones.join(', ')}`);
    }

    if (languageComplexity && !validComplexities.includes(languageComplexity)) {
      return sendError(res, 'VALIDATION_ERROR', 
        `Invalid languageComplexity. Must be one of: ${validComplexities.join(', ')}`);
    }

    // Validate numeric ranges
    const validateRange = (value: any, name: string) => {
      if (value !== undefined) {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 1) {
          return `${name} must be a number between 0 and 1`;
        }
      }
      return null;
    };

    const validationErrors = [
      validateRange(creativityLevel, 'creativityLevel'),
      validateRange(technicalDetail, 'technicalDetail'),
      validateRange(explainationDepth, 'explainationDepth'),
    ].filter(Boolean);

    if (validationErrors.length > 0) {
      return sendError(res, 'VALIDATION_ERROR', validationErrors.join(', '));
    }

    // Record the preference update as an interaction
    const interaction: UserInteraction = {
      userId,
      sessionId: `pref-update-${Date.now()}`,
      timestamp: new Date(),
      interactionType: 'prompt_submission',
      modelId: 'preference-system',
      providerId: 'internal',
      context: {
        action: 'update_general_preferences',
        updates: {
          responseSpeed,
          creativityLevel: creativityLevel ? parseFloat(creativityLevel) : undefined,
          technicalDetail: technicalDetail ? parseFloat(technicalDetail) : undefined,
          explainationDepth: explainationDepth ? parseFloat(explainationDepth) : undefined,
          preferredTone,
          languageComplexity,
        },
      },
      taskType: 'preference_management',
    };

    await userPreferenceLearningService.recordInteraction(interaction);

    log.info('⚙️ General preferences updated', LogContext.API, {
      userId,
      updates: Object.keys(req.body).length,
    });

    sendSuccess(res, { updated: true });

  } catch (error) {
    log.error('❌ Failed to update general preferences', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to update preferences');
  }
});

// ============================================================================
// System Analytics (for administrators)
// ============================================================================

/**
 * Get system-wide preference learning statistics
 * GET /api/v1/user-preferences/analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { userId } = req as any;
    
    // In a real system, you'd check if user has admin permissions
    // For now, this is a simplified endpoint that could be secured differently

    // Return basic analytics (this would be more comprehensive in production)
    const analytics = {
      message: 'Preference learning analytics endpoint',
      note: 'This would contain system-wide analytics in a full implementation',
      availableEndpoints: [
        'POST /recommendations - Get personalized model recommendations',
        'POST /select-model - Get single best model selection',
        'POST /interactions - Record user interactions',
        'POST /feedback - Record user feedback',
        'GET /insights - Get user preference insights',
        'GET /models - Get user model preferences',
        'GET /tasks - Get user task preferences',
        'PUT /general - Update general preferences',
      ],
    };

    sendSuccess(res, analytics);

  } catch (error) {
    log.error('❌ Failed to get preference analytics', LogContext.API, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to get analytics');
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check for preference learning service
 * GET /api/v1/user-preferences/health
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      service: 'User Preference Learning',
      timestamp: new Date().toISOString(),
      features: {
        modelRecommendations: true,
        interactionRecording: true,
        preferenceInsights: true,
        collaborativeFiltering: true,
        adaptiveLearning: true,
      },
    };

    sendSuccess(res, health);
  } catch (error) {
    log.error('❌ Health check failed', LogContext.API, { error });
    sendError(res, 'SERVICE_ERROR', 'Health check failed');
  }
});

export default router;