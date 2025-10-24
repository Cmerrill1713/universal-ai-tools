export function SweetAthenaRouter() {
  const router = Router();

  // Service instances per user (in production, use proper session management)
  const userServices = new Map<string, SweetAthenaIntegrationService>();

  /**
   * Get or create Sweet Athena service for user
   */
  const getUserService = async (userId: string): Promise<SweetAthenaIntegrationService> => {
    if (!userServices.has(userId)) {
      const service = new SweetAthenaIntegrationService(supabase);
      await service.initialize(userId);
      userServices.set(userId, service);
    }
    return userServices.get(userId)!;
  };

  /**
   * POST /api/sweet-athena/personality
   * Change avatar personality mode
   */
  router.post(
    '/personality',
    authenticate,
    [
      body('personality')
        .isIn(['sweet', 'shy', 'confident', 'caring', 'playful'])
        .withMessage('Invalid personality mode'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { personality, adaptation } = PersonalityChangeSchema.parse(req.body);
        const userId = (req as any).user.id;

        const service = await getUserService(userId);
        await service.setPersonality(personality);

        const newState = service.getCurrentState();

        // Log personality change
        logger.info('Sweet Athena personality changed', undefined, {
          userId,
          newPersonality: personality,
          adaptation,
        });

        res.json({
          success: true,
          personality,
          state: newState.personality,
          message: `Personality changed to ${personality}`,
          adaptation,
        });
      } catch (error) {
        logger.error(Personality change error', undefined, error;
        res.status(500).json({
          success: false,
          error 'Failed to change personality',
          details: (erroras Error).message,
        });
      }
    }
  );

  /**
   * POST /api/sweet-athena/clothing
   * Update avatar clothing configuration
   */
  router.post(
    '/clothing',
    authenticate,
    [
      body('level')
        .optional()
        .isIn(['conservative', 'moderate', 'revealing', 'very_revealing'])
        .withMessage('Invalid clothing level'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const clothingUpdate = ClothingUpdateSchema.parse(req.body);
        const userId = (req as any).user.id;

        const service = await getUserService(userId);

        if (clothingUpdate.level) {
          await service.setClothingLevel(clothingUpdate.level);
        }

        // Handle individual item customization
        if (clothingUpdate.item) {
          // This would integrate with the clothing customization system
          // For now, we'll store the customization request
        }

        const newState = service.getCurrentState();

        logger.info('Sweet Athena clothing updated', undefined, {
          userId,
          clothingUpdate,
        });

        res.json({
          success: true,
          clothing: newState.clothing,
          message: 'Clothing updated successfully',
        });
      } catch (error) {
        logger.error(Clothing update error', undefined, error;
        res.status(500).json({
          success: false,
          error 'Failed to update clothing',
          details: (erroras Error).message,
        });
      }
    }
  );

  /**
   * POST /api/sweet-athena/chat
   * Handle text/voice chat interaction
   */
  router.post(
    '/chat',
    authenticate,
    [
      body('message')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Message must be between 1 and 1000 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const chatData = ChatInteractionSchema.parse(req.body);
        const userId = (req as any).user.id;

        const service = await getUserService(userId);

        // Set personality if specified
        if (chatData.personalityMode) {
          await service.setPersonality(chatData.personalityMode);
        }

        // Update interaction mode
        await service.setInteractionMode('chat', chatData.context?.userIntent || 'general_chat');

        // Generate Sweet Athena response using enhanced widget generation
        const enhancedRequest = {
          _input chatData.message,
          inputType: chatData.type,
          userId,
          sweetAthenaConfig: {
            personalityMode: chatData.personalityMode,
            provideFeedback: true,
            voiceGuidance:
              chatData.expectedResponseType === 'voice' || chatData.expectedResponseType === 'both',
            adaptPersonality: true,
            showAvatar: true,
          },
          context: {
            conversationContext: chatData.context?.conversationId,
            projectContext: chatData.context?.widgetContext,
          },
        };

        // For chat interactions, we'll use a simplified response
        // In a full implementation, this would integrate with a conversational AI
        const currentState = service.getCurrentState();
        const personality = currentState.personality.mode;

        // Generate personality-appropriate response
        const responses = {
          sweet: {
            greeting: 'Hello there! How can I help you today? 😊',
            general: "I'd love to help you with that! Let me see what I can do.",
            widget_help: "Oh, creating widgets is so much fun! Tell me what you'd like to build.",
          },
          shy: {
            greeting: 'Um... hi. I hope I can help you somehow...',
            general: "I'll try my best to help, if that's okay with you.",
            widget_help:
              "Creating widgets is... well, it's quite nice. What would you like to make?",
          },
          confident: {
            greeting: "Hello! I'm here to help you achieve your goals.",
            general: 'I can definitely handle that for you. What do you need?',
            widget_help: 'Widget creation is my specialty. What are we building today?',
          },
          caring: {
            greeting: "Hello! I'm here to support you in whatever you need.",
            general: 'I want to make sure I understand exactly what you need help with.',
            widget_help: "I'll help you create something wonderful. What's your vision?",
          },
          playful: {
            greeting: 'Hey there! Ready to create something awesome? 🎉',
            general: "Ooh, this sounds like fun! Let's figure this out together!",
            widget_help: 'Widget time! This is going to be epic! What are we making?',
          },
        };

        const responseType = chatData.context?.userIntent || 'general';
        const responseText =
          responses[personality][responseType as keyof typeof responses.sweet] ||
          responses[personality].general;

        res.json({
          success: true,
          response: {
            text: responseText,
            personality,
            audioUrl:
              chatData.expectedResponseType === 'voice' || chatData.expectedResponseType === 'both'
                ? `/api/sweet-athena/audio/response/${Date.now()}`
                : undefined,
            timestamp: new Date().toISOString(),
          },
          state: currentState,
          context: {
            conversationId: chatData.context?.conversationId || `conv_${Date.now()}`,
            personalityUsed: personality,
          },
        });

        logger.info('Sweet Athena chat interaction', undefined, {
          userId,
          personality,
          messageLength: chatData.message.length,
          responseType: chatData.expectedResponseType,
        });
      } catch (error) {
        logger.error(Chat interaction error', undefined, error;
        res.status(500).json({
          success: false,
          error 'Failed to process chat interaction',
          details: (erroras Error).message,
        });
      }
    }
  );

  /**
   * POST /api/sweet-athena/voice
   * Handle voice _inputfor avatar interaction
   */
  router.post('/voice', authenticate, upload.single('audio'), async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error 'No audio file provided',
        });
      }

      const { text, personality, context, expectResponse } = req.body;
      const userId = req.user.id;

      const service = await getUserService(userId);

      // If text is provided, use text-to-speech
      if (text) {
        const voiceData = VoiceInteractionSchema.parse({
          text,
          personality,
          context,
          expectResponse: expectResponse !== 'false',
        });

        if (voiceData.personality) {
          await service.setPersonality(voiceData.personality);
        }

        // Generate voice response
        const audioUrl = `/api/sweet-athena/audio/generated/${Date.now()}`;

        res.json({
          success: true,
          response: {
            audioUrl,
            transcript: voiceData.text,
            personality: voiceData.personality || service.getCurrentState().personality.mode,
          },
        });
      } else {
        // Process uploaded audio file
        // In a full implementation, this would use speech-to-text
        // For now, we'll return a mock response

        res.json({
          success: true,
          response: {
            transcript: 'Voice processing not fully implemented yet',
            confidence: 0.95,
            audioUrl: `/api/sweet-athena/audio/response/${Date.now()}`,
          },
        });
      }

      // Clean up uploaded file
      await fs
        .unlink(req.file.path)
        .catch((err) => logger.error(Failed to delete temp voice file:', undefined, err));
    } catch (error) {
      logger.error(Voice interaction error', undefined, error;

      // Clean up file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }

      res.status(500).json({
        success: false,
        error 'Failed to process voice interaction',
        details: (erroras Error).message,
      });
    }
  });

  /**
   * GET /api/sweet-athena/status
   * Get current avatar state and status
   */
  router.get('/status', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      if (!userServices.has(userId)) {
        return res.json({
          success: true,
          initialized: false,
          message: 'Sweet Athena service not initialized for this user',
        });
      }

      const service = userServices.get(userId)!;
      const currentState = service.getCurrentState();

      res.json({
        success: true,
        initialized: true,
        state: currentState,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(Status check error', undefined, error;
      res.status(500).json({
        success: false,
        error 'Failed to get avatar status',
        details: (erroras Error).message,
      });
    }
  });

  /**
   * PUT /api/sweet-athena/state
   * Update avatar state
   */
  router.put('/state', authenticate, validateInput, async (req: Request, res: Response) => {
    try {
      const stateUpdate = StateUpdateSchema.parse(req.body);
      const userId = (req as any).user.id;

      const service = await getUserService(userId);

      // Update interaction state
      if (stateUpdate.interaction) {
        if (stateUpdate.interaction.mode) {
          await service.setInteractionMode(
            stateUpdate.interaction.mode,
            stateUpdate.interaction.context || ''
          );
        }

        if (stateUpdate.interaction.userEngagement !== undefined) {
          service.updateUserEngagement(stateUpdate.interaction.userEngagement);
        }
      }

      const newState = service.getCurrentState();

      res.json({
        success: true,
        state: newState,
        message: 'Avatar state updated successfully',
      });
    } catch (error) {
      logger.error(State update error', undefined, error;
      res.status(500).json({
        success: false,
        error 'Failed to update avatar state',
        details: (erroras Error).message,
      });
    }
  });

  /**
   * GET /api/sweet-athena/preferences
   * Get user preferences for Sweet Athena
   */
  router.get('/preferences', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const { data, error} = await supabase
        .from('sweet_athena_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error&& errorcode !== 'PGRST116') {
        throw error
      }

      res.json({
        success: true,
        preferences: data || null,
      });
    } catch (error) {
      logger.error(Preferences retrieval error', undefined, error;
      res.status(500).json({
        success: false,
        error 'Failed to retrieve preferences',
        details: (erroras Error).message,
      });
    }
  });

  /**
   * PUT /api/sweet-athena/preferences
   * Update user preferences for Sweet Athena
   */
  router.put('/preferences', authenticate, validateInput, async (req: Request, res: Response) => {
    try {
      const preferences = PreferencesSchema.parse(req.body);
      const userId = (req as any).user.id;

      const { error} = await supabase.from('sweet_athena_preferences').upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      });

      if (error {
        throw error
      }

      res.json({
        success: true,
        preferences,
        message: 'Preferences updated successfully',
      });
    } catch (error) {
      logger.error(Preferences update error', undefined, error;
      res.status(500).json({
        success: false,
        error 'Failed to update preferences',
        details: (erroras Error).message,
      });
    }
  });

  /**
   * GET /api/sweet-athena/personalities
   * Get available personality modes and their descriptions
   */
  router.get('/personalities', async (req: Request, res: Response) => {
    try {
      const personalities = [
        {
          mode: 'sweet',
          name: 'Sweet',
          description: 'Nurturing and caring, always encouraging',
          traits: {
            sweetness: 0.9,
            confidence: 0.6,
            playfulness: 0.7,
            caring: 0.8,
            shyness: 0.3,
          },
          voiceStyle: 'warm and gentle',
          recommendedFor: ['learning', 'encouragement', 'general assistance'],
        },
        {
          mode: 'shy',
          name: 'Shy',
          description: 'Gentle and reserved, speaks softly',
          traits: {
            sweetness: 0.7,
            confidence: 0.3,
            playfulness: 0.4,
            caring: 0.8,
            shyness: 0.9,
          },
          voiceStyle: 'soft and tentative',
          recommendedFor: ['sensitive topics', 'careful guidance', 'patient learning'],
        },
        {
          mode: 'confident',
          name: 'Confident',
          description: 'Direct and efficient, expert guidance',
          traits: {
            sweetness: 0.6,
            confidence: 0.9,
            playfulness: 0.7,
            caring: 0.6,
            shyness: 0.1,
          },
          voiceStyle: 'clear and authoritative',
          recommendedFor: ['complex tasks', 'professional work', 'technical guidance'],
        },
        {
          mode: 'caring',
          name: 'Caring',
          description: 'Empathetic and supportive, always helpful',
          traits: {
            sweetness: 0.8,
            confidence: 0.7,
            playfulness: 0.5,
            caring: 0.9,
            shyness: 0.2,
          },
          voiceStyle: 'warm and supportive',
          recommendedFor: ['problem solving', 'emotional support', 'detailed explanations'],
        },
        {
          mode: 'playful',
          name: 'Playful',
          description: 'Energetic and fun, loves creativity',
          traits: {
            sweetness: 0.7,
            confidence: 0.8,
            playfulness: 0.9,
            caring: 0.6,
            shyness: 0.2,
          },
          voiceStyle: 'energetic and expressive',
          recommendedFor: ['creative projects', 'brainstorming', 'fun activities'],
        },
      ];

      res.json({
        success: true,
        personalities,
      });
    } catch (error) {
      logger.error(Personalities retrieval error', undefined, error;
      res.status(500).json({
        success: false,
        error 'Failed to retrieve personality information',
      });
    }
  });

  /**
   * POST /api/sweet-athena/widget-assistance
   * Get Sweet Athena assistance for widget creation
   */
  router.post(
    '/widget-assistance',
    authenticate,
    [
      body('widgetRequest')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Widget _requestis required')
        .isLength({ min: 10, max: 2000 })
        .withMessage('Widget _requestmust be between 10 and 2000 characters'),
    ],
    validateInput,
    async (req: Request, res: Response) => {
      try {
        const { widgetRequest, personalityMode, voiceGuidance = true } = req.body;
        const userId = (req as any).user.id;

        const service = await getUserService(userId);

        // Generate widget with Sweet Athena assistance
        const result = await service.generateWidgetWithSweetAthena({
          _input widgetRequest,
          inputType: 'text',
          userId,
          sweetAthenaConfig: {
            personalityMode,
            provideFeedback: true,
            voiceGuidance,
            adaptPersonality: true,
            showAvatar: true,
          },
        });

        res.json({
          success: true,
          widget: result.widget,
          sweetAthenaResponse: result.sweetAthenaResponse,
          metadata: result.metadata,
          links: {
            preview: `/api/nl-widgets/${result.widget.id}/preview`,
            edit: `/api/nl-widgets/${result.widget.id}/edit`,
            export: `/api/widgets/export/${result.widget.id}`,
          },
        });

        logger.info('Sweet Athena widget assistance completed', undefined, {
          userId,
          widgetId: result.widget.id,
          personality: result.sweetAthenaResponse.personalityUsed,
        });
      } catch (error) {
        logger.error(Widget assistance error', undefined, error;
        res.status(500).json({
          success: false,
          error 'Failed to provide widget assistance',
          details: (erroras Error).message,
        });
      }
    }
  );

  /**
   * WebSocket endpoint for real-time communication
   * This would be set up separately in the main server file
   */
  router.get('/ws-info', (req: Request, res: Response) => {
    res.json({
      success: true,
      websocketUrl: '/api/sweet-athena/ws',
      supportedEvents: [
        'personality_change',
        'clothing_update',
        'state_change',
        'voice_interaction',
        'avatar_response',
      ],
    });
  });

  return router;
}

export default SweetAthenaRouter;
/**
 * Knowledge Monitoring Router
 * API endpoints for knowledge base health monitoring and management
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { KNOWLEDGE_SOURCES } from '../config/knowledge-sources';
import { DSPyKnowledgeManager } from '../core/knowledge/dspy-knowledge-manager';
import { createKnowledgeFeedbackService } from '../services/knowledge-feedback-service';
import { knowledgeScraperService } from '../services/knowledge-scraper-service';
import { createKnowledgeUpdateAutomation } from '../services/knowledge-update-automation';
import { knowledgeValidationService } from '../services/knowledge-validation-service';
import { logger } from '../utils/logger';

export default function createKnowledgeMonitoringRouter(supabase: SupabaseClient) {
  const router = Router();

  // Initialize services
  const knowledgeManager = new DSPyKnowledgeManager();
  const feedbackService = createKnowledgeFeedbackService(supabase, logger);
  const updateAutomation = createKnowledgeUpdateAutomation(
    knowledgeScraperService,
    knowledgeValidationService,
    feedbackService,
    knowledgeManager
  );

  // Authentication is applied at the app level

  /**
   * GET /api/knowledge-monitoring/dashboard
   * Get comprehensive dashboard data
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const timeRange = (req.query.timeRange as string) || '24h';
      const since = getTimeSince(timeRange);

      // Fetch all dashboard data in parallel
      const [
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights,
      ] = await Promise.all([
        getOverviewMetrics(since),
        getSourceHealthMetrics(),
        getValidationMetrics(since),
        getUsageAnalytics(since),
        getPerformanceMetrics(since),
        getActiveAlerts(),
        getUpdateQueueStatus(),
        feedbackService.getInsights(),
      ]);

      res.json({
        timestamp: new Date().toISOString(),
        timeRange,
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights: insights.slice(0, 10), // Limit to recent insights
      });
    } catch (error) {
      logger.error(Error fetching dashboard data:', error;
      res.status(500).json({ error 'Failed to fetch dashboard data' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/sources
   * Get detailed source status
   */
  router.get('/sources', async (_req, res) => {
    try {
      const sources = await Promise.all(
        KNOWLEDGE_SOURCES.map(async (source) => {
          const [lastScrape, itemCount, qualityScore, issues] = await Promise.all([
            getLastScrapeTime(source.id),
            getSourceItemCount(source.id),
            getSourceQualityScore(source.id),
            getSourceIssues(source.id),
          ]);

          return {
            id: source.id,
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            priority: source.priority,
            credibilityScore: source.credibilityScore,
            updateFrequency: source.updateFrequency,
            lastScrape,
            itemCount,
            averageQualityScore: qualityScore,
            activeIssues: issues.length,
            status: determineSourceStatus(lastScrape, issues.length, source.enabled),
          };
        })
      );

      res.json({ sources });
    } catch (error) {
      logger.error(Error fetching source status:', error;
      res.status(500).json({ error 'Failed to fetch source status' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/alerts
   * Get monitoring alerts with filtering
   */
  router.get('/alerts', async (req, res) => {
    try {
      const { status, severity, type, limit = 50 } = req.query;

      let query = supabase
        .from('knowledge_monitoring_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(limit));

      if (status) query = query.eq('status', status);
      if (severity) query = query.eq('severity', severity);
      if (type) query = query.eq('alert_type', type);

      const { data: alerts, error} = await query;

      if (error throw error

      res.json({
        alerts,
        summary: {
          total: alerts?.length || 0,
          bySeverity: groupBy(alerts || [], 'severity'),
          byType: groupBy(alerts || [], 'alert_type'),
          byStatus: groupBy(alerts || [], 'status'),
        },
      });
    } catch (error) {
      logger.error(Error fetching alerts:', error;
      res.status(500).json({ error 'Failed to fetch alerts' });
    }
  });

  /**
   * PUT /api/knowledge-monitoring/alerts/:id
   * Update alert status
   */
  router.put('/alerts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, resolution_notes } = req.body;

      const updates: any = { status };

      if (status === 'acknowledged') {
        updates.acknowledged_at = new Date().toISOString();
      } else if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
        updates.resolution_notes = resolution_notes;
      }

      const { data, error} = await supabase
        .from('knowledge_monitoring_alerts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error throw error

      res.json({ alert: data });
    } catch (error) {
      logger.error(Error updating alert:', error;
      res.status(500).json({ error 'Failed to update alert' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/performance
   * Get detailed performance metrics
   */
  router.get('/performance', async (req, res) => {
    try {
      const { metricType, period = '24h', groupBy = 'hour' } = req.query;
      const since = getTimeSince(period as string);

      const { data: metrics, error} = await supabase
        .from('knowledge_performance_metrics')
        .select('*')
        .gte('period_start', since.toISOString())
        .order('period_start', { ascending: true });

      if (error throw error

      // Filter by metric type if specified
      const filteredMetrics = metricType
        ? metrics?.filter((m) => m.metric_type === metricType)
        : metrics;

      // Group by time period
      const grouped = groupMetricsByPeriod(filteredMetrics || [], groupBy as string);

      res.json({
        metrics: grouped,
        summary: {
          averageValue: calculateAverage(filteredMetrics || [], 'metric_value'),
          trend: calculateTrend(filteredMetrics || []),
          periodStart: since.toISOString(),
          periodEnd: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error(Error fetching performance metrics:', error;
      res.status(500).json({ error 'Failed to fetch performance metrics' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/usage-patterns
   * Get knowledge usage patterns
   */
  router.get('/usage-patterns', async (_req, res) => {
    try {
      const patterns = feedbackService.getPatterns();

      // Convert Map to array for JSON serialization
      const patternArray = Array.from(patterns.entries()).map(([key, _pattern) => ({
        id: key,
        ..._pattern
      }));

      // Sort by confidence and evidence
      patternArray.sort((a, b) => {
        const scoreA = a.confidence * Math.log(a.evidence + 1);
        const scoreB = b.confidence * Math.log(b.evidence + 1);
        return scoreB - scoreA;
      });

      res.json({
        patterns: patternArray.slice(0, 50), // Top 50 patterns
        summary: {
          total: patternArray.length,
          highConfidence: patternArray.filter((p) => p.confidence > 0.8).length,
          recentlyActive: patternArray.filter(
            (p) => new Date(p.lastSeen).getTime() > Date.now() - 24 * 60 * 60 * 1000
          ).length,
        },
      });
    } catch (error) {
      logger.error(Error fetching usage patterns:', error;
      res.status(500).json({ error 'Failed to fetch usage patterns' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/update-status
   * Get knowledge update automation status
   */
  router.get('/update-status', async (_req, res) => {
    try {
      const [statistics, queue, recentJobs] = await Promise.all([
        updateAutomation.getStatistics(),
        getUpdateQueueDetails(),
        getRecentUpdateJobs(),
      ]);

      res.json({
        statistics,
        queue,
        recentJobs,
        health: {
          isHealthy: statistics.recentFailures < statistics.recentCompletions * 0.1,
          successRate:
            statistics.recentCompletions /
              (statistics.recentCompletions + statistics.recentFailures) || 0,
        },
      });
    } catch (error) {
      logger.error(Error fetching update status:', error;
      res.status(500).json({ error 'Failed to fetch update status' });
    }
  });

  /**
   * POST /api/knowledge-monitoring/manual-update
   * Trigger manual knowledge update
   */
  router.post('/manual-update', async (req, res) => {
    try {
      const { sourceId, url, updateType = 'update', priority = 8 } = req.body;

      if (!sourceId || !url) {
        return res.status(400).json({ error 'sourceId and url are required' });
      }

      const jobId = await updateAutomation.queueUpdateJob({
        sourceId,
        url,
        updateType,
        priority,
        scheduledFor: new Date(),
      });

      res.json({
        jobId,
        message: 'Update job queued successfully',
        estimatedProcessingTime: '5-10 minutes',
      });
    } catch (error) {
      logger.error(Error queuing manual update:', error;
      res.status(500).json({ error 'Failed to queue update' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/quality-trends
   * Get knowledge quality trends over time
   */
  router.get('/quality-trends', async (req, res) => {
    try {
      const { period = '7d', sourceId } = req.query;
      const since = getTimeSince(period as string);

      let query = supabase
        .from('scraped_knowledge')
        .select('id, source_id, quality_score, scraped_at, validation_status')
        .gte('scraped_at', since.toISOString())
        .order('scraped_at', { ascending: true });

      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      const { data: knowledge, error} = await query.limit(1000);

      if (error throw error

      // Calculate daily quality trends
      const dailyTrends = calculateDailyTrends(knowledge || []);

      res.json({
        trends: dailyTrends,
        summary: {
          averageQuality: calculateAverage(knowledge || [], 'quality_score'),
          validatedPercentage: calculatePercentage(
            knowledge || [],
            (item) => item.validation_status === 'validated'
          ),
          totalItems: knowledge?.length || 0,
          period: { start: since.toISOString(), end: new Date().toISOString() },
        },
      });
    } catch (error) {
      logger.error(Error fetching quality trends:', error;
      res.status(500).json({ error 'Failed to fetch quality trends' });
    }
  });

  /**
   * GET /api/knowledge-monitoring/relationships
   * Get learned knowledge relationships
   */
  router.get('/relationships', async (req, res) => {
    try {
      const { minStrength = 0.5, limit = 100 } = req.query;

      const { data: relationships, error} = await supabase
        .from('learned_knowledge_relationships')
        .select(
          `
        *,
        source:scraped_knowledge!source_knowledge_id(id, title),
        target:scraped_knowledge!target_knowledge_id(id, title)
      `
        )
        .gte('strength', Number(minStrength))
        .order('strength', { ascending: false })
        .limit(Number(limit));

      if (error throw error

      // Create graph data
      const nodes = new Set<string>();
      const edges =
        relationships?.map((rel) => {
          nodes.add(rel.source_knowledge_id);
          nodes.add(rel.target_knowledge_id);

          return {
            source: rel.source_knowledge_id,
            target: rel.target_knowledge_id,
            type: rel.relationship_type,
            strength: rel.strength,
            confidence: rel.confidence,
            evidence: rel.evidence_count,
          };
        }) || [];

      res.json({
        graph: {
          nodes: Array.from(nodes).map((id) => ({
            id,
            label:
              relationships?.find(
                (r) => r.source_knowledge_id === id || r.target_knowledge_id === id
              )?.source?.title || id,
          })),
          edges,
        },
        summary: {
          totalRelationships: relationships?.length || 0,
          strongRelationships: relationships?.filter((r) => r.strength > 0.8).length || 0,
          relationshipTypes: groupBy(relationships || [], 'relationship_type'),
        },
      });
    } catch (error) {
      logger.error(Error fetching relationships:', error;
      res.status(500).json({ error 'Failed to fetch relationships' });
    }
  });

  // Helper functions

  function getTimeSince(timeRange: string): Date {
    const now = new Date();
    const match = timeRange.match(/(\d+)([hdwm])/);

    if (!match) return new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default 24h

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'h':
        return new Date(now.getTime() - num * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() - num * 24 * 60 * 60 * 1000);
      case 'w':
        return new Date(now.getTime() - num * 7 * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() - num * 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  async function getOverviewMetrics(since: Date) {
    const [totalKnowledge, activeAlerts, recentUpdates, qualityScore] = await Promise.all([
      supabase.from('scraped_knowledge').select('id', { count: 'exact' }),
      supabase
        .from('knowledge_monitoring_alerts')
        .select('id', { count: 'exact' })
        .eq('status', 'active'),
      supabase
        .from('scraped_knowledge')
        .select('id', { count: 'exact' })
        .gte('scraped_at', since.toISOString()),
      supabase
        .from('scraped_knowledge')
        .select('quality_score')
        .gte('scraped_at', since.toISOString())
        .limit(500),
    ]);

    const avgQuality = calculateAverage(qualityScore.data || [], 'quality_score');

    return {
      totalKnowledgeItems: totalKnowledge.count || 0,
      activeAlerts: activeAlerts.count || 0,
      recentUpdates: recentUpdates.count || 0,
      averageQualityScore: avgQuality,
      healthStatus: determineHealthStatus(activeAlerts.count || 0, avgQuality),
    };
  }

  async function getSourceHealthMetrics() {
    const metrics = await Promise.all(
      KNOWLEDGE_SOURCES.map(async (source) => {
        const { data } = await supabase
          .from('scraped_knowledge')
          .select('quality_score, validation_status')
          .eq('source_id', source.id)
          .gte('scraped_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(200);

        return {
          sourceId: source.id,
          name: source.name,
          itemCount: data?.length || 0,
          averageQuality: calculateAverage(data || [], 'quality_score'),
          validationRate: calculatePercentage(
            data || [],
            (item) => item.validation_status === 'validated'
          ),
        };
      })
    );

    return metrics;
  }

  async function getValidationMetrics(since: Date) {
    const { data: validations } = await supabase
      .from('knowledge_validation')
      .select('validation_type, score')
      .gte('validated_at', since.toISOString())
      .limit(1000);

    const byType = validations?.reduce(
      (acc, val) => {
        if (!acc[val.validation_type]) {
          acc[val.validation_type] = { count: 0, totalScore: 0 };
        }
        acc[val.validation_type].count++;
        acc[val.validation_type].totalScore += val.score;
        return acc;
      },
      {} as Record<string, { count: number; totalScore: number }>
    );

    return Object.entries(byType || {}).map(([type, stats]) => ({
      type,
      count: stats.count,
      averageScore: stats.totalScore / stats.count,
    }));
  }

  async function getUsageAnalytics(since: Date) {
    const { data: usage } = await supabase
      .from('knowledge_usage_analytics')
      .select('action_type, performance_score')
      .gte('created_at', since.toISOString())
      .limit(1000);

    const actionCounts = groupBy(usage || [], 'action_type');
    const performanceByAction = Object.entries(actionCounts).reduce(
      (acc, [action, items]) => {
        acc[action] = {
          count: items.length,
          averagePerformance: calculateAverage(
            items.filter((i: any) => i.performance_score !== null),
            'performance_score'
          ),
        };
        return acc;
      },
      {} as Record<string, { count: number; averagePerformance: number }>
    );

    return performanceByAction;
  }

  async function getPerformanceMetrics(since: Date) {
    const { data: metrics } = await supabase
      .from('knowledge_performance_metrics')
      .select('metric_type, metric_value')
      .gte('period_start', since.toISOString())
      .limit(1000);

    const byType = metrics?.reduce(
      (acc, metric) => {
        if (!acc[metric.metric_type]) {
          acc[metric.metric_type] = [];
        }
        acc[metric.metric_type].push(metric.metric_value);
        return acc;
      },
      {} as Record<string, number[]>
    );

    return Object.entries(byType || {}).map(([type, values]) => ({
      type,
      current: values[values.length - 1] || 0,
      average: values.reduce((a, b) => a + b, 0) / values.length,
      trend: calculateTrend(values.map((v, i) => ({ metric_value: v, index: i }))),
    }));
  }

  async function getActiveAlerts() {
    const { data: alerts } = await supabase
      .from('knowledge_monitoring_alerts')
      .select('*')
      .eq('status', 'active')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    return alerts || [];
  }

  async function getUpdateQueueStatus() {
    const { data: queue } = await supabase
      .from('knowledge_update_queue')
      .select('status, update_type')
      .in('status', ['pending', 'processing'])
      .limit(100);

    const byStatus = groupBy(queue || [], 'status');
    const byType = groupBy(queue || [], 'update_type');

    return {
      pending: byStatus.pending?.length || 0,
      processing: byStatus.processing?.length || 0,
      byType: Object.entries(byType).map(([type, items]) => ({
        type,
        count: items.length,
      })),
    };
  }

  async function getLastScrapeTime(sourceId: string): Promise<Date | null> {
    const { data } = await supabase
      .from('scraped_knowledge')
      .select('scraped_at')
      .eq('source_id', sourceId)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    return data ? new Date(data.scraped_at) : null;
  }

  async function getSourceItemCount(sourceId: string): Promise<number> {
    const { count } = await supabase
      .from('scraped_knowledge')
      .select('id', { count: 'exact' })
      .eq('source_id', sourceId);

    return count || 0;
  }

  async function getSourceQualityScore(sourceId: string): Promise<number> {
    const { data } = await supabase
      .from('scraped_knowledge')
      .select('quality_score')
      .eq('source_id', sourceId)
      .not('quality_score', 'is', null)
      .limit(100);

    return calculateAverage(data || [], 'quality_score');
  }

  async function getSourceIssues(sourceId: string): Promise<any[]> {
    const { data } = await supabase
      .from('knowledge_monitoring_alerts')
      .select('*')
      .eq('status', 'active')
      .contains('affected_items', [{ source_id: sourceId }]);

    return data || [];
  }

  async function getUpdateQueueDetails() {
    const { data: queue } = await supabase
      .from('knowledge_update_queue')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(20);

    return queue || [];
  }

  async function getRecentUpdateJobs() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: jobs } = await supabase
      .from('knowledge_update_queue')
      .select('*')
      .gte('updated_at', oneDayAgo.toISOString())
      .order('updated_at', { ascending: false })
      .limit(50);

    return jobs || [];
  }

  // Utility functions

  function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce(
      (acc, item) => {
        const value = String(item[key]);
        if (!acc[value]) acc[value] = [];
        acc[value].push(item);
        return acc;
      },
      {} as Record<string, T[]>
    );
  }

  function calculateAverage(items: any[], field: string): number {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / items.length;
  }

  function calculatePercentage(items: any[], predicate: (item: any) => boolean): number {
    if (items.length === 0) return 0;
    const matching = items.filter(predicate).length;
    return (matching / items.length) * 100;
  }

  function calculateTrend(items: any[]): 'improving' | 'stable' | 'declining' {
    if (items.length < 2) return 'stable';

    const firstHalf = items.slice(0, Math.floor(items.length / 2));
    const secondHalf = items.slice(Math.floor(items.length / 2));

    const firstAvg = calculateAverage(firstHalf, 'metric_value');
    const secondAvg = calculateAverage(secondHalf, 'metric_value');

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  function calculateDailyTrends(items: any[]) {
    const dailyData = items.reduce(
      (acc, item) => {
        const date = new Date(item.scraped_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { count: 0, totalQuality: 0, validated: 0 };
        }
        acc[date].count++;
        acc[date].totalQuality += item.quality_score || 0;
        if (item.validation_status === 'validated') acc[date].validated++;
        return acc;
      },
      {} as Record<string, { count: number; totalQuality: number; validated: number }>
    );

    return Object.entries(dailyData)
      .map(([date, data]) => {
        const typedData = data as { count: number; totalQuality: number; validated: number };
        return {
          date,
          itemCount: typedData.count,
          averageQuality: typedData.count > 0 ? typedData.totalQuality / typedData.count : 0,
          validationRate: typedData.count > 0 ? (typedData.validated / typedData.count) * 100 : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function determineSourceStatus(
    lastScrape: Date | null,
    issueCount: number,
    enabled: boolean
  ): 'healthy' | 'warning' | 'error | 'disabled' {
    if (!enabled) return 'disabled';
    if (issueCount > 5) return 'error;
    if (!lastScrape) return 'warning';

    const hoursSinceLastScrape = (Date.now() - lastScrape.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastScrape > 48) return 'error;
    if (hoursSinceLastScrape > 24) return 'warning';

    return 'healthy';
  }

  function determineHealthStatus(alertCount: number, qualityScore: number): string {
    if (alertCount > 10 || qualityScore < 0.5) return 'critical';
    if (alertCount > 5 || qualityScore < 0.7) return 'warning';
    return 'healthy';
  }

  function groupMetricsByPeriod(metrics: any[], _period: string) {
    // Implementation would group metrics by hour/day/week
    // For simplicity, returning as-is
    return metrics;
  }

  return router;
}
/**
 * Alpha Evolve Router
 * API endpoints for the self-improving evolution system
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { AlphaEvolveCoordinator } from '../services/alpha-evolve-coordinator.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/async-wrapper.js';
import { sendError, sendSuccess } from '../utils/api-response.js';

const router = Router();

// Initialize Supabase client
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

// Initialize Alpha Evolve Coordinator
let coordinator: AlphaEvolveCoordinator | null = null;

// Ensure coordinator is initialized
const ensureCoordinator = async () => {
  if (!coordinator) {
    coordinator = new AlphaEvolveCoordinator(supabase);
    logger.info('Alpha Evolve Coordinator initialized');
  }
  return coordinator;
};

/**
 * Submit a task for evolved processing
 */
router.post(
  '/tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId, taskType, context, priority = 5 } = req.body;

    if (!agentId || !taskType || !context) {
      return res.status(400).json({ error 'Missing required fields: agentId, taskType, context' });
    }

    try {
      const coord = await ensureCoordinator();
      const taskId = await coord.submitTask(agentId, taskType, context, priority);

      return res.status(200).json( {
        taskId,
        message: 'Task submitted successfully',
      });
    } catch (error) {
      logger.error(Failed to submit task:', error;
      return res.status(500).json({ error 'Failed to submit task' });
    }
  })
);

/**
 * Get task status
 */
router.get(
  '/tasks/:taskId',
  asyncHandler(async (req: Request, res: Response) => {
    const { taskId } = req.params;

    try {
      const coord = await ensureCoordinator();
      const status = await coord.getTaskStatus(taskId);

      if (!status) {
        return res.status(404).json({ error 'Task not found' });
      }

      return res.status(200).json( status);
    } catch (error) {
      logger.error(Failed to get task status:', error;
      return res.status(500).json({ error 'Failed to get task status' });
    }
  })
);

/**
 * Get global evolution status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const coord = await ensureCoordinator();
      const status = await coord.getGlobalStatus();

      return res.status(200).json( status);
    } catch (error) {
      logger.error(Failed to get global status:', error;
      return res.status(500).json({ error 'Failed to get global status' });
    }
  })
);

/**
 * Get agent-specific evolution details
 */
router.get(
  '/agents/:agentId/evolution',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.params;

    try {
      const coord = await ensureCoordinator();
      const evolution = await coord.getAgentEvolution(agentId);

      if (!evolution) {
        return res.status(404).json({ error 'Agent not found' });
      }

      return res.status(200).json( evolution);
    } catch (error) {
      logger.error(Failed to get agent evolution:', error;
      return res.status(500).json({ error 'Failed to get agent evolution' });
    }
  })
);

/**
 * Get cross-learning history
 */
router.get(
  '/cross-learning',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 50;

    try {
      const coord = await ensureCoordinator();
      const history = await coord.getCrossLearningHistory(limit);

      return res.status(200).json( {
        history,
        total: history.length,
      });
    } catch (error) {
      logger.error(Failed to get cross-learning history:', error;
      return res.status(500).json({ error 'Failed to get cross-learning history' });
    }
  })
);

/**
 * Trigger manual evolution for an agent
 */
router.post(
  '/agents/:agentId/evolve',
  asyncHandler(async (req: Request, res: Response) => {
    const { agentId } = req.params;

    try {
      const coord = await ensureCoordinator();

      // Submit a special evolution task
      const taskId = await coord.submitTask(
        agentId,
        'manual_evolution',
        { trigger: 'api', timestamp: new Date() },
        10 // Highest priority
      );

      return res.status(200).json( {
        message: 'Evolution triggered',
        taskId,
      });
    } catch (error) {
      logger.error(Failed to trigger evolution:', error;
      return res.status(500).json({ error 'Failed to trigger evolution' });
    }
  })
);

/**
 * Get evolution insights and recommendations
 */
router.get(
  '/insights',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const coord = await ensureCoordinator();
      const status = await coord.getGlobalStatus();

      // Analyze current state and generate insights
      const insights = {
        performance: {
          globalSuccessRate:
            status.globalMetrics.successfulTasks / Math.max(1, status.globalMetrics.totalTasks),
          averageAgentFitness: calculateAverageAgentFitness(status.agents),
          evolutionProgress: status.globalMetrics.totalEvolutions,
        },
        recommendations: generateRecommendations(status),
        topPerformingAgents: getTopPerformingAgents(status.agents),
        learningTrends: {
          crossLearningEffectiveness: status.globalMetrics.crossLearningEvents > 0,
          patternsPerAgent: calculatePatternsPerAgent(status.agents),
        },
      };

      return res.status(200).json( insights);
    } catch (error) {
      logger.error(Failed to get insights:', error;
      return res.status(500).json({ error 'Failed to get insights' });
    }
  })
);

/**
 * Submit batch tasks for evolution testing
 */
router.post(
  '/batch-tasks',
  asyncHandler(async (req: Request, res: Response) => {
    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error 'Tasks must be an array' });
    }

    try {
      const coord = await ensureCoordinator();
      const taskIds = [];

      for (const task of tasks) {
        const { agentId, taskType, context, priority = 5 } = task;
        if (agentId && taskType && context) {
          const taskId = await coord.submitTask(agentId, taskType, context, priority);
          taskIds.push(taskId);
        }
      }

      return res.status(200).json( {
        taskIds,
        message: `${taskIds.length} tasks submitted successfully`,
      });
    } catch (error) {
      logger.error(Failed to submit batch tasks:', error;
      return res.status(500).json({ error 'Failed to submit batch tasks' });
    }
  })
);

/**
 * Get _pattern_analysisfor a specific _patterntype
 */
router.get(
  '/patterns/:patternType',
  asyncHandler(async (req: Request, res: Response) => {
    const { patternType } = req.params;

    try {
      // Query patterns from database
      const { data: patterns, error} = await supabase
        .from('ai_learning_patterns')
        .select('*')
        .ilike('_pattern, `%${patternType}%`)
        .order('confidence', { ascending: false })
        .limit(20);

      if (error throw error

      return res.status(200).json( {
        patterns,
        total: patterns?.length || 0,
      });
    } catch (error) {
      logger.error(Failed to get patterns:', error;
      return res.status(500).json({ error 'Failed to get patterns' });
    }
  })
);

/**
 * Get performance metrics for a time range
 */
router.get(
  '/metrics',
  asyncHandler(async (req: Request, res: Response) => {
    const { start, end, agentId } = req.query;

    try {
      let query = supabase.from('ai_performance_metrics').select('*');

      if (start) {
        query = query.gte('timestamp', start);
      }

      if (end) {
        query = query.lte('timestamp', end);
      }

      if (agentId) {
        query = query.eq('agent_id', agentId);
      }

      const { data: metrics, error} = await query
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (error throw error

      // Calculate aggregated metrics
      const aggregated = aggregateMetrics(metrics || []);

      return res.status(200).json( {
        metrics,
        aggregated,
      });
    } catch (error) {
      logger.error(Failed to get metrics:', error;
      return res.status(500).json({ error 'Failed to get metrics' });
    }
  })
);

// Helper functions
function calculateAverageAgentFitness(agents: any): number {
  const fitnessValues = Object.values(agents)
    .map((agent: any) => agent.averageFitness || 0)
    .filter((f) => f > 0);

  if (fitnessValues.length === 0) return 0;
  return fitnessValues.reduce((sum, f) => sum + f, 0) / fitnessValues.length;
}

function generateRecommendations(status: any): string[] {
  const recommendations = [];
  const avgFitness = calculateAverageAgentFitness(status.agents);

  if (avgFitness < 0.5) {
    recommendations.push('Consider increasing population size for better diversity');
  }

  if (status.globalMetrics.crossLearningEvents < 5) {
    recommendations.push('Enable more cross-agent learning opportunities');
  }

  if (status.taskQueueLength > 100) {
    recommendations.push('Consider scaling up processing capacity');
  }

  const successRate =
    status.globalMetrics.successfulTasks / Math.max(1, status.globalMetrics.totalTasks);

  if (successRate < 0.7) {
    recommendations.push('Review and optimize agent strategies for better success rates');
  }

  return recommendations;
}

function getTopPerformingAgents(agents: any): any[] {
  return Object.entries(agents)
    .map(([id, agent]: [string, any]) => ({
      agentId: id,
      fitness: agent.averageFitness || 0,
      generation: agent.generation || 0,
    }))
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, 5);
}

function calculatePatternsPerAgent(agents: any): number {
  const patternCounts = Object.values(agents).map((agent: any) => agent.patternsLearned || 0);

  if (patternCounts.length === 0) return 0;
  return patternCounts.reduce((sum, c) => sum + c, 0) / patternCounts.length;
}

function aggregateMetrics(metrics: any[]): any {
  if (metrics.length === 0) return {};

  const totalLatency = metrics.reduce((sum, m) => sum + (m.latency_ms || 0), 0);
  const successCount = metrics.filter((m) => m.success).length;
  const errorCount = metrics.filter((m) => m.error.length;

  const byOperation = metrics.reduce((acc, m) => {
    const op = m.operation_type;
    if (!acc[op]) {
      acc[op] = { count: 0, totalLatency: 0, errors: 0 };
    }
    acc[op].count++;
    acc[op].totalLatency += m.latency_ms || 0;
    if (m.error acc[op].errors++;
    return acc;
  }, {});

  return {
    total: metrics.length,
    averageLatency: totalLatency / metrics.length,
    successRate: successCount / metrics.length,
    errorRate: errorCount / metrics.length,
    byOperation,
  };
}

export default router;
import { Router } from 'express';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dspyWidgetOrchestrator } from '../services/dspy-widget-orchestrator';
import { LogContext, logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// Request validation schemas
const widgetGenerationRequestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  functionality: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
  context: z.record(z.any()).optional(),
  styling: z
    .enum(['mui', 'tailwind', 'css-modules', 'styled-components'])
    .optional()
    .default('mui'),
});

const widgetImprovementRequestSchema = z.object({
  existingCode: z.string().min(1),
  improvementRequest: z.string().min(10),
  preserveInterface: z.boolean().optional().default(true),
  context: z.record(z.any()).optional(),
});

const widgetProgressRequestSchema = z.object({
  widgetId: z.string().uuid(),
});

