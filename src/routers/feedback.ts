/**
 * Feedback Collection Router
 * API endpoints for collecting, managing, and analyzing user feedback
 */

import type { Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '../middleware/auth';
import type { UserFeedback } from '../services/feedback-collection-service';
import { feedbackCollectionService } from '../services/feedback-collection-service';
import { sendError, sendSuccess } from '../utils/api-response';
import { log, LogContext } from '../utils/logger';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

// Use standard JWT authentication middleware
router.use(authenticate);

// ============================================================================
// Feedback Collection Endpoints
// ============================================================================

/**
 * Submit new feedback
 * POST /api/v1/feedback/submit
 */
router.post('/submit', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      feedbackType,
      category,
      rating,
      title,
      description,
      context,
      tags,
      modelId,
      providerId,
      responseTime,
      attachments,
    } = req.body;

    const userId = req.user?.id || 'anonymous';

    // Validate required fields
    if (!sessionId || !feedbackType || !description) {
      return sendError(res, 'VALIDATION_ERROR', 
        'Missing required fields: sessionId, feedbackType, description');
    }

    // Validate feedback type
    const validTypes = ['rating', 'suggestion', 'bug_report', 'feature_request', 'general'];
    if (!validTypes.includes(feedbackType)) {
      return sendError(res, 'VALIDATION_ERROR', 
        `feedbackType must be one of: ${validTypes.join(', ')}`);
    }

    // Validate category if provided
    if (category) {
      const validCategories = ['model_performance', 'user_interface', 'speed', 'accuracy', 'usability', 'other'];
      if (!validCategories.includes(category)) {
        return sendError(res, 'VALIDATION_ERROR', 
          `category must be one of: ${validCategories.join(', ')}`);
      }
    }

    // Validate rating if provided
    if (rating !== undefined) {
      const ratingNum = parseInt(String(rating));
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return sendError(res, 'VALIDATION_ERROR', 'rating must be between 1 and 5');
      }
    }

    // Validate description length
    if (description.length > 5000) {
      return sendError(res, 'VALIDATION_ERROR', 'description must be 5000 characters or less');
    }

    // Validate title length if provided
    if (title && title.length > 200) {
      return sendError(res, 'VALIDATION_ERROR', 'title must be 200 characters or less');
    }

    // Validate attachments if provided
    if (attachments && !Array.isArray(attachments)) {
      return sendError(res, 'VALIDATION_ERROR', 'attachments must be an array');
    }

    if (attachments && attachments.length > 5) {
      return sendError(res, 'VALIDATION_ERROR', 'maximum 5 attachments allowed');
    }

    const feedback: Omit<UserFeedback, 'id' | 'timestamp'> = {
      userId,
      sessionId: String(sessionId),
      feedbackType,
      category,
      rating: rating !== undefined ? parseInt(String(rating)) : undefined,
      title: title ? String(title) : undefined,
      description: String(description),
      context,
      tags: Array.isArray(tags) ? tags : undefined,
      modelId: modelId ? String(modelId) : undefined,
      providerId: providerId ? String(providerId) : undefined,
      responseTime: responseTime ? parseInt(String(responseTime)) : undefined,
      attachments,
    };

    log.info('📝 Feedback submission received', LogContext.AI, {
      userId,
      feedbackType,
      category,
      rating,
      hasAttachments: !!(attachments && attachments.length > 0),
    });

    const feedbackId = await feedbackCollectionService.submitFeedback(feedback);

    sendSuccess(res, {
      feedbackId,
      message: 'Feedback submitted successfully',
      processed: true,
    });

  } catch (error) {
    log.error('❌ Feedback submission failed', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to submit feedback');
  }
});

/**
 * Get user's feedback history
 * GET /api/v1/feedback/history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { limit = 50, offset = 0 } = req.query;

    // Validate limit
    const limitNum = parseInt(String(limit));
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return sendError(res, 'VALIDATION_ERROR', 'limit must be between 1 and 100');
    }

    // Validate offset
    const offsetNum = parseInt(String(offset));
    if (isNaN(offsetNum) || offsetNum < 0) {
      return sendError(res, 'VALIDATION_ERROR', 'offset must be 0 or greater');
    }

    const feedbackHistory = await feedbackCollectionService.getFeedbackHistory(userId, limitNum);

    // Apply offset
    const paginatedHistory = feedbackHistory.slice(offsetNum, offsetNum + limitNum);

    sendSuccess(res, {
      feedback: paginatedHistory,
      total: feedbackHistory.length,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < feedbackHistory.length,
    });

  } catch (error) {
    log.error('❌ Failed to get feedback history', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve feedback history');
  }
});

/**
 * Get feedback analytics
 * GET /api/v1/feedback/analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { startDate, endDate, global } = req.query;

    let timeRange: { start: Date; end: Date } | undefined;

    if (startDate && endDate) {
      const start = new Date(String(startDate));
      const end = new Date(String(endDate));

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid date format for startDate or endDate');
      }

      if (start >= end) {
        return sendError(res, 'VALIDATION_ERROR', 'startDate must be before endDate');
      }

      timeRange = { start, end };
    }

    // Only allow global analytics for admin users (simplified check)
    const analyticsUserId = global === 'true' ? undefined : userId;

    const analytics = await feedbackCollectionService.getFeedbackAnalytics(analyticsUserId, timeRange);

    sendSuccess(res, {
      analytics,
      timeRange: timeRange ? {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      } : null,
      scope: analyticsUserId ? 'user' : 'global',
    });

  } catch (error) {
    log.error('❌ Failed to get feedback analytics', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve feedback analytics');
  }
});

/**
 * Update feedback status (admin functionality)
 * PUT /api/v1/feedback/:feedbackId/status
 */
router.put('/:feedbackId/status', async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const { status } = req.body;

    if (!feedbackId) {
      return sendError(res, 'VALIDATION_ERROR', 'feedbackId is required');
    }

    if (!status) {
      return sendError(res, 'VALIDATION_ERROR', 'status is required');
    }

    const validStatuses = ['new', 'reviewed', 'in_progress', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 'VALIDATION_ERROR', 
        `status must be one of: ${validStatuses.join(', ')}`);
    }

    await feedbackCollectionService.updateFeedbackStatus(feedbackId, status);

    log.info('📝 Feedback status updated', LogContext.AI, {
      feedbackId,
      status,
      updatedBy: req.user?.id || 'anonymous',
    });

    sendSuccess(res, {
      feedbackId,
      status,
      updated: true,
    });

  } catch (error) {
    log.error('❌ Failed to update feedback status', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to update feedback status');
  }
});

/**
 * Get top issues across platform
 * GET /api/v1/feedback/issues
 */
router.get('/issues', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const limitNum = parseInt(String(limit));
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return sendError(res, 'VALIDATION_ERROR', 'limit must be between 1 and 50');
    }

    const topIssues = await feedbackCollectionService.getTopIssues(limitNum);

    sendSuccess(res, {
      issues: topIssues,
      count: topIssues.length,
      limit: limitNum,
    });

  } catch (error) {
    log.error('❌ Failed to get top issues', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve top issues');
  }
});

/**
 * Get improvement suggestions
 * GET /api/v1/feedback/suggestions
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { limit = 5 } = req.query;

    const limitNum = parseInt(String(limit));
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 20) {
      return sendError(res, 'VALIDATION_ERROR', 'limit must be between 1 and 20');
    }

    const suggestions = await feedbackCollectionService.getImprovementSuggestions(limitNum);

    sendSuccess(res, {
      suggestions,
      count: suggestions.length,
      limit: limitNum,
    });

  } catch (error) {
    log.error('❌ Failed to get improvement suggestions', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to retrieve improvement suggestions');
  }
});

/**
 * Submit quick rating
 * POST /api/v1/feedback/rating
 */
router.post('/rating', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      rating,
      modelId,
      providerId,
      responseTime,
      context,
    } = req.body;

    const userId = req.user?.id || 'anonymous';

    // Validate required fields
    if (!sessionId || rating === undefined) {
      return sendError(res, 'VALIDATION_ERROR', 'Missing required fields: sessionId, rating');
    }

    // Validate rating
    const ratingNum = parseInt(String(rating));
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return sendError(res, 'VALIDATION_ERROR', 'rating must be between 1 and 5');
    }

    const feedback: Omit<UserFeedback, 'id' | 'timestamp'> = {
      userId,
      sessionId: String(sessionId),
      feedbackType: 'rating',
      category: 'model_performance',
      rating: ratingNum,
      description: `User rated the response ${ratingNum}/5`,
      context,
      modelId: modelId ? String(modelId) : undefined,
      providerId: providerId ? String(providerId) : undefined,
      responseTime: responseTime ? parseInt(String(responseTime)) : undefined,
    };

    const feedbackId = await feedbackCollectionService.submitFeedback(feedback);

    log.info('⭐ Quick rating submitted', LogContext.AI, {
      userId,
      sessionId,
      rating: ratingNum,
      modelId,
      providerId,
    });

    sendSuccess(res, {
      feedbackId,
      rating: ratingNum,
      message: 'Rating submitted successfully',
    });

  } catch (error) {
    log.error('❌ Quick rating submission failed', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to submit rating');
  }
});

/**
 * Submit bug report
 * POST /api/v1/feedback/bug
 */
router.post('/bug', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      title,
      description,
      steps,
      expected,
      actual,
      context,
      attachments,
    } = req.body;

    const userId = req.user?.id || 'anonymous';

    // Validate required fields
    if (!sessionId || !title || !description) {
      return sendError(res, 'VALIDATION_ERROR', 
        'Missing required fields: sessionId, title, description');
    }

    // Create detailed bug report description
    let bugDescription = String(description);
    
    if (steps) {
      bugDescription += `\n\nSteps to reproduce:\n${steps}`;
    }
    
    if (expected) {
      bugDescription += `\n\nExpected behavior:\n${expected}`;
    }
    
    if (actual) {
      bugDescription += `\n\nActual behavior:\n${actual}`;
    }

    const feedback: Omit<UserFeedback, 'id' | 'timestamp'> = {
      userId,
      sessionId: String(sessionId),
      feedbackType: 'bug_report',
      category: 'other',
      title: String(title),
      description: bugDescription,
      context: {
        ...context,
        errorOccurred: true,
      },
      priority: 'high', // Bug reports start with high priority
      tags: ['bug'],
      attachments,
    };

    const feedbackId = await feedbackCollectionService.submitFeedback(feedback);

    log.info('🐛 Bug report submitted', LogContext.AI, {
      userId,
      sessionId,
      title,
      hasAttachments: !!(attachments && attachments.length > 0),
    });

    sendSuccess(res, {
      feedbackId,
      message: 'Bug report submitted successfully',
      priority: 'high',
    });

  } catch (error) {
    log.error('❌ Bug report submission failed', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to submit bug report');
  }
});

/**
 * Submit feature request
 * POST /api/v1/feedback/feature
 */
router.post('/feature', async (req: Request, res: Response) => {
  try {
    const {
      sessionId,
      title,
      description,
      useCase,
      priority,
      category,
    } = req.body;

    const userId = req.user?.id || 'anonymous';

    // Validate required fields
    if (!sessionId || !title || !description) {
      return sendError(res, 'VALIDATION_ERROR', 
        'Missing required fields: sessionId, title, description');
    }

    // Create detailed feature request description
    let featureDescription = String(description);
    
    if (useCase) {
      featureDescription += `\n\nUse case:\n${useCase}`;
    }

    const feedback: Omit<UserFeedback, 'id' | 'timestamp'> = {
      userId,
      sessionId: String(sessionId),
      feedbackType: 'feature_request',
      category: category || 'other',
      title: String(title),
      description: featureDescription,
      priority: priority || 'medium',
      tags: ['feature-request'],
    };

    const feedbackId = await feedbackCollectionService.submitFeedback(feedback);

    log.info('💡 Feature request submitted', LogContext.AI, {
      userId,
      sessionId,
      title,
      category,
      priority: priority || 'medium',
    });

    sendSuccess(res, {
      feedbackId,
      message: 'Feature request submitted successfully',
      priority: priority || 'medium',
    });

  } catch (error) {
    log.error('❌ Feature request submission failed', LogContext.AI, { error });
    sendError(res, 'INTERNAL_ERROR', 'Failed to submit feature request');
  }
});

export default router;