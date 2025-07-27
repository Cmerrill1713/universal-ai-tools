/**
 * Knowledge Monitoring Router with Lazy Initialization
 * API endpoints for knowledge base health monitoring and management
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { initializeWithTimeout } from '../utils/timeout-utils';

// Lazy-loaded services
let knowledgeManager: any = null;
let feedbackService: any = null;
let updateAutomation: any = null;
let knowledgeScraperService: any = null;
let knowledgeValidationService: any = null;
let servicesInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

async function initializeServices(supabase: SupabaseClient): Promise<boolean> {
  if (servicesInitialized) return true;

  // Return existing promise if initialization is already in progress
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      logger.info('Lazy loading knowledge monitoring services...');

      // Import services
      const [;
        { DSPyKnowledgeManager },
        { createKnowledgeFeedbackService },
        knowledgeScraperModule,
        { createKnowledgeUpdateAutomation },
        knowledgeValidationModule,
      ] = await Promise.all([
        import('../core/knowledge/dspy-knowledge-manager'),
        import('../services/knowledge-feedback-service'),
        import('../services/knowledge-scraper-service'),
        import('../services/knowledge-update-automation'),
        import('../services/knowledge-validation-service'),
      ]);

      knowledgeScraperService = knowledgeScraperModule.knowledgeScraperService;
      knowledgeValidationService = knowledgeValidationModule.knowledgeValidationService;

      // Initialize services with timeout protection
      knowledgeManager = await initializeWithTimeout(
        async () => new DSPyKnowledgeManager({}),
        'DSPyKnowledgeManager',
        5000
      );

      feedbackService = await initializeWithTimeout(
        async () => createKnowledgeFeedbackService(supabase, logger,
        'KnowledgeFeedbackService',
        5000
      );

      if (knowledgeManager && feedbackService) {
        updateAutomation = await initializeWithTimeout(
          async () =>
            createKnowledgeUpdateAutomation(
              knowledgeScraperService,
              knowledgeValidationService,
              feedbackService,
              knowledgeManager
            ),
          'KnowledgeUpdateAutomation',
          5000
        );
      }

      servicesInitialized = !!(knowledgeManager && feedbackService && updateAutomation);
      return servicesInitialized;
    } catch (error) {
      logger.error('Failed to initialize knowledge monitoring service, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  })();

  return initializationPromise;
}

// Helper function to ensure services are initialized
async function ensureServicesInitialized(
  supabase: SupabaseClient,
  res: Response
): Promise<boolean> {
  if (!servicesInitialized) {
    const initialized = await initializeServices(supabase);
    if (!initialized) {
      res.status(503).json({
        error: 'Knowledge monitoring services are not available',
        message: 'The service is still initializing or failed to start',
      });
      return false;
    }
  }
  return true;
}

// Time range helper
function getTimeSince(timeRange: string: Date {
  const now = new Date();
  const ranges: Record<string, number> = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const offset = ranges[timeRange] || ranges['24h'];
  return new Date(now.getTime() - offset);
}

export default function createKnowledgeMonitoringRouter(supabase: SupabaseClient {
  const router = Router();

  /**
   * GET /api/knowledge-monitoring/status
   * Get service initialization status
   */
  router.get('/status', async (req: Request, res: Response) => {
    res.json({
      initialized: servicesInitialized,
      services: {
        knowledgeManager: !!knowledgeManager,
        feedbackService: !!feedbackService,
        updateAutomation: !!updateAutomation,
      },
    });
  });

  /**
   * GET /api/knowledge-monitoring/dashboard
   * Get comprehensive dashboard data
   */
  router.get('/dashboard', async (req: Request, res: Response) => {
    if (!(await ensureServicesInitialized(supabase, res)) return;

    try {
      const timeRange = (req.query.timeRange as string) || '24h';
      const since = getTimeSince(timeRange);

      // Fetch all dashboard data in parallel
      const [;
        overview,
        sourceHealth,
        validationMetrics,
        usageAnalytics,
        performanceMetrics,
        activeAlerts,
        updateQueue,
        insights,
      ] = await Promise.all([
        feedbackService.getSystemOverview(since),
        feedbackService.getSourceHealthMetrics(since),
        knowledgeValidationService.getValidationMetrics(since),
        feedbackService.getUsageAnalytics(since),
        knowledgeManager.getPerformanceMetrics(),
        knowledgeValidationService.getActiveAlerts(),
        updateAutomation.getUpdateQueue(),
        feedbackService.generateInsights(),
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
        insights,
      });
    } catch (error) {
      logger.error('Da, error;
      res.status(500).json({
        error: 'Failed to fetch dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Add other routes similarly with lazy initialization checks...
  // (Keeping the router small for this example, but all routes should follow this_pattern

  return router;
}
