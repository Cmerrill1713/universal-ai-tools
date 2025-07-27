/**
 * Continuous Learning Service with Lazy Initialization
 * Main orchestrator for the knowledge update and learning system
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { initializeServicesParallel, initializeWithTimeout } from '../utils/timeout-utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  issues: string[];
  metrics: Record<string, unknown>;
}

interface LearningCycle {
  cycleId: string;
  startTime: Date;
  endTime?: Date;
  phase: 'collection' | 'validation' | 'integration' | 'optimization' | 'complete';
  itemsProcessed: number;
  itemsValidated: number;
  itemsIntegrated: number;
  insights: string[];
  errors: string[];
}

export class ContinuousLearningService extends EventEmitter {
  private supabase: SupabaseClient;
  private scraperService: any = null;
  private validationService: any = null;
  private feedbackService: any = null;
  private updateAutomation: any = null;
  private knowledgeManager: any = null;
  private rerankingPipeline: any = null;

  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private currentCycle: LearningCycle | null = null;
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private isRunning = false;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
  }

  /**
   * Initialize all services with timeout protection
   */
  private async initializeServices(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        logger.info('🧠 Initializing Continuous Learning Service components...');

        // Import all required modules
        const [
          { KnowledgeScraperService },
          { KnowledgeValidationService },
          { createKnowledgeFeedbackService },
          { createKnowledgeUpdateAutomation },
          { DSPyKnowledgeManager },
          { RerankingPipeline },
        ] = await Promise.all([
          import('./knowledge-scraper-service'),
          import('./knowledge-validation-service'),
          import('./knowledge-feedback-service'),
          import('./knowledge-update-automation'),
          import('../core/knowledge/dspy-knowledge-manager'),
          import('./reranking-pipeline'),
        ]);

        // Initialize services in parallel with timeouts
        const serviceResults = await initializeServicesParallel([
          {
            name: 'KnowledgeScraperService',
            init: async () => new KnowledgeScraperService(),
            timeout: 5000,
          },
          {
            name: 'KnowledgeValidationService',
            init: async () => new KnowledgeValidationService(),
            timeout: 5000,
          },
          {
            name: 'DSPyKnowledgeManager',
            init: async () => new DSPyKnowledgeManager({}),
            timeout: 8000,
          },
          {
            name: 'RerankingPipeline',
            init: async () => new RerankingPipeline(this.supabase, logger),
            timeout: 5000,
          },
        ]);

        // Extract successfully initialized services
        const results = serviceResults.get('KnowledgeScraperService');
        if (results?.success) this.scraperService = results.result;

        const validationResults = serviceResults.get('KnowledgeValidationService');
        if (validationResults?.success) this.validationService = validationResults.result;

        const knowledgeResults = serviceResults.get('DSPyKnowledgeManager');
        if (knowledgeResults?.success) this.knowledgeManager = knowledgeResults.result;

        const rerankingResults = serviceResults.get('RerankingPipeline');
        if (rerankingResults?.success) this.rerankingPipeline = rerankingResults.result;

        // Initialize feedback service (depends on supabase)
        this.feedbackService = await initializeWithTimeout(
          async () => createKnowledgeFeedbackService(this.supabase, logger),
          'KnowledgeFeedbackService',
          5000
        );

        // Initialize update automation (depends on other services)
        if (
          this.scraperService &&
          this.validationService &&
          this.feedbackService &&
          this.knowledgeManager
        ) {
          this.updateAutomation = await initializeWithTimeout(
            async () =>
              createKnowledgeUpdateAutomation(
                this.scraperService,
                this.validationService,
                this.feedbackService,
                this.knowledgeManager
              ),
            'KnowledgeUpdateAutomation',
            5000
          );
        }

        this.isInitialized = !!(
          this.scraperService &&
          this.validationService &&
          this.feedbackService &&
          this.knowledgeManager &&
          this.updateAutomation
        );

        if (this.isInitialized) {
          logger.info('✅ Continuous Learning Service initialized successfully');
          this.initializeHealthMonitoring();
        } else {
          logger.warn(
            '⚠️  Continuous Learning Service partially initialized - some features may be unavailable'
          );
        }
      } catch (error) {
        logger.error('Failed to initialize Continuous Learning Service:', {
          _error error instanceof Error ? error.message : String(_error,
        });
        this.isInitialized = false;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Start the continuous learning service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Continuous Learning Service is already running');
      return;
    }

    try {
      // Initialize services if not already done
      await this.initializeServices();

      this.isRunning = true;
      this.emit('service:started');

      // Schedule periodic tasks
      this.schedulePeriodicTasks();

      logger.info('🚀 Continuous Learning Service started successfully');
    } catch (error) {
      logger.error('Failed to start Continuous Learning Service:', {
        _error error instanceof Error ? error.message : String(_error,
      });
      throw error;
    }
  }

  /**
   * Stop the continuous learning service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Continuous Learning Service is not running');
      return;
    }

    logger.info('Stopping Continuous Learning Service...');

    // Cancel all scheduled jobs
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      logger.info(`Cancelled scheduled job: ${name}`);
    }
    this.scheduledJobs.clear();

    // Wait for current cycle to complete
    if (this.currentCycle) {
      logger.info('Waiting for current learning cycle to complete...');
      await this.waitForCycleCompletion();
    }

    this.isRunning = false;
    this.emit('service:stopped');

    logger.info('✅ Continuous Learning Service stopped successfully');
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    initialized: boolean;
    currentCycle: LearningCycle | null;
    health: Record<string, ServiceHealth>;
    scheduledJobs: string[];
  } {
    return {
      running: this.isRunning,
      initialized: this.isInitialized,
      currentCycle: this.currentCycle,
      health: Object.fromEntries(this.serviceHealth),
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
    };
  }

  // Private helper methods

  private initializeHealthMonitoring(): void {
    // Monitor service health every 5 minutes
    const healthCheck = cron.schedule('*/5 * * * *', async () => {
      await this.performHealthCheck();
    });
    this.scheduledJobs.set('health-check', healthCheck);
  }

  private schedulePeriodicTasks(): void {
    // Schedule learning cycles every hour
    const learningCycle = cron.schedule('0 * * * *', async () => {
      await this.runLearningCycle();
    });
    this.scheduledJobs.set('learning-cycle', learningCycle);

    // Schedule optimization every 6 hours
    const optimization = cron.schedule('0 */6 * * *', async () => {
      await this.runOptimizationCycle();
    });
    this.scheduledJobs.set('optimization-cycle', optimization);
  }

  private async performHealthCheck(): Promise<void> {
    // Implementation would check health of each service
    logger.info('Performing health check on continuous learning components...');
  }

  private async runLearningCycle(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Cannot run learning cycle - service not fully initialized');
      return;
    }

    // Implementation would run a full learning cycle
    logger.info('Starting new learning cycle...');
  }

  private async runOptimizationCycle(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Cannot run optimization cycle - service not fully initialized');
      return;
    }

    // Implementation would optimize the knowledge base
    logger.info('Starting optimization cycle...');
  }

  private async waitForCycleCompletion(): Promise<void> {
    // Wait for current cycle to complete with timeout
    const timeout = 60000; // 1 minute timeout
    const startTime = Date.now();

    while (this.currentCycle && this.currentCycle.phase !== 'complete') {
      if (Date.now() - startTime > timeout) {
        logger.warn('Learning cycle did not complete within timeout');
        break;
      }
      await new Promise((resolve) => setTimeout(TIME_1000MS));
    }
  }
}

// Export singleton factory
let instance: ContinuousLearningService | null = null;

export function getContinuousLearningService(supabase: SupabaseClient): ContinuousLearningService {
  if (!instance) {
    instance = new ContinuousLearningService(supabase);
  }
  return instance;
}

// Backward compatibility export
export const continuousLearningService = {
  start: async (supabase: SupabaseClient) => {
    const service = getContinuousLearningService(supabase);
    return service.start();
  },
  stop: async (supabase: SupabaseClient) => {
    const service = getContinuousLearningService(supabase);
    return service.stop();
  },
  getStatus: (supabase: SupabaseClient) => {
    const service = getContinuousLearningService(supabase);
    return service.getStatus();
  },
};
