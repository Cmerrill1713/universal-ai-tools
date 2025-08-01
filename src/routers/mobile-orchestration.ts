/**
 * Mobile Orchestration Router
 * API endpoints for iOS-optimized DSPy cognitive orchestration
 */

import express from 'express';
import type { Request, Response} from 'express';
import { NextFunction } from 'express';

import type { MobileOptimizedRequest } from '../services/mobile-dspy-orchestrator';
import { mobileDSPyOrchestrator } from '../services/mobile-dspy-orchestrator';
import { contextInjectionService } from '../services/context-injection-service';
import { pyVisionBridge } from '../services/pyvision-bridge';
import { intelligentAgentSelector } from '../services/intelligent-agent-selector';
import { sendError, sendSuccess } from '../utils/api-response';
import { LogContext, log } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query } from 'express-validator';

const router = express.Router();

// Apply authentication to all routes (DISABLED FOR TESTING)
// router.use(authenticate);

/**
 * Mobile-optimized cognitive orchestration
 * POST /api/v1/mobile-orchestration/orchestrate
 */
router.post(
  '/orchestrate',
  [
    body('taskType')
      .isIn(['quick_response', 'deep_analysis', 'creative_task', 'ios_development', 'swift_coding'])
      .withMessage('Invalid task type'),
    body('userInput').notEmpty().withMessage('User input is required'),
    body('deviceContext').isObject().withMessage('Device context must be an object'),
    body('optimizationPreferences').optional().isObject(),
    body('contextEnrichment').optional().isBoolean(),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const {
        taskType,
        userInput,
        deviceContext,
        optimizationPreferences = {},
        contextEnrichment = true,
      } = req.body;

      // Add user ID from JWT token (DISABLED FOR TESTING)
      const enhancedDeviceContext = {
        ...deviceContext,
        userId: 'test-user', // req.user?.id,
      };

      log.info('📱 Mobile orchestration request received', LogContext.API, {
        taskType,
        deviceId: deviceContext.deviceId,
        batteryLevel: deviceContext.batteryLevel,
        userId: 'test-user', // req.user?.id,
      });

      const request: MobileOptimizedRequest = {
        taskType,
        userInput,
        deviceContext: enhancedDeviceContext,
        optimizationPreferences: {
          prioritizeBattery: true,
          preferCachedResults: true,
          maxProcessingTime: 30000,
          qualityLevel: 'balanced',
          ...optimizationPreferences,
        },
        contextEnrichment,
      };

      const result = await mobileDSPyOrchestrator.orchestrate(request);

      if (result.success) {
        log.info('✅ Mobile orchestration completed successfully', LogContext.API, {
          processingTime: result.metadata.totalProcessingTime,
          agentsUsed: result.metadata.agentsUsed.length,
          batteryOptimized: result.metadata.batteryOptimizations.length > 0,
        });

        return sendSuccess(res, result.result, 200, {
          metadata: result.metadata,
          performance: {
            processingTime: result.metadata.totalProcessingTime,
            agentsUsed: result.metadata.agentsUsed,
            optimizations: {
              battery: result.metadata.batteryOptimizations,
              network: result.metadata.networkOptimizations,
            },
          },
        });
      } else {
        log.error('❌ Mobile orchestration failed', LogContext.API, {
          error: result.error,
          processingTime: result.metadata.totalProcessingTime,
        });

        return sendError(res, 
          'ORCHESTRATION_ERROR',
          result.error || 'Mobile orchestration failed',
          500,
          result.metadata
        );
      }
    } catch (error) {
      log.error('❌ Mobile orchestration endpoint error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return sendError(res, 
        'INTERNAL_ERROR',
        'Internal server error during mobile orchestration',
        500
      );
    }
  }
);

/**
 * iOS-optimized image analysis with cognitive reasoning
 * POST /api/v1/mobile-orchestration/analyze-image
 */
router.post(
  '/analyze-image',
  [
    body('imageData').notEmpty().withMessage('Image data is required'),
    body('deviceContext').isObject().withMessage('Device context required'),
    body('analysisType').optional().isIn(['quick', 'detailed', 'reasoning']),
    body('question').optional().isString(),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const {
        imageData,
        deviceContext,
        analysisType = 'detailed',
        question,
      } = req.body;

      // Add user ID from JWT token (DISABLED FOR TESTING)
      const enhancedDeviceContext = {
        ...deviceContext,
        userId: 'test-user', // req.user?.id,
      };

      log.info('📷 Mobile image analysis request', LogContext.API, {
        analysisType,
        hasQuestion: !!question,
        deviceId: deviceContext.deviceId,
        batteryLevel: deviceContext.batteryLevel,
      });

      // Convert base64 image data to buffer
      const imageBuffer = Buffer.from(imageData, 'base64');

      let result;
      
      if (analysisType === 'reasoning' && question) {
        // Use PyVision reasoning with mobile optimization
        result = await pyVisionBridge.reason(imageBuffer, question);
      } else {
        // Use iOS-optimized image analysis
        result = await pyVisionBridge.analyzeImageForIOS(imageBuffer, enhancedDeviceContext);
      }

      if (result.success) {
        // Enhance with cognitive reasoning if requested
        if (analysisType === 'detailed' && result.data) {
          const cognitiveRequest: MobileOptimizedRequest = {
            taskType: 'deep_analysis',
            userInput: `Analyze this image analysis result and provide insights: ${JSON.stringify(result.data)}`,
            deviceContext: enhancedDeviceContext,
            optimizationPreferences: {
              prioritizeBattery: deviceContext.isLowPowerMode,
              preferCachedResults: true,
              qualityLevel: deviceContext.isLowPowerMode ? 'fast' : 'balanced',
            },
            contextEnrichment: true,
          };

          const cognitiveResult = await mobileDSPyOrchestrator.orchestrate(cognitiveRequest);
          
          if (cognitiveResult.success) {
            (result.data as any).cognitiveInsights = cognitiveResult.result;
            (result.data as any).orchestrationMetadata = cognitiveResult.metadata;
          }
          
          return undefined;
          
          return undefined;
        }

        return sendSuccess(res, result.data, 200, {
          visionMetadata: {
            processingTime: result.processingTime,
            model: result.model,
            cached: result.cached,
          },
          deviceOptimizations: (result.data as any)?.deviceOptimizations,
        });
      } else {
        return sendError(res, 
          'ANALYSIS_ERROR',
          result.error || 'Image analysis failed',
          500
        );
      }
    } catch (error) {
      log.error('❌ Mobile image analysis error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return sendError(res, 
        'INTERNAL_ERROR',
        'Internal server error during image analysis',
        500
      );
    }
  }
);

/**
 * iOS-optimized image refinement with MLX backend
 * POST /api/v1/mobile-orchestration/refine-image
 */
router.post(
  '/refine-image',
  [
    body('imageData').notEmpty().withMessage('Image data is required'),
    body('deviceContext').isObject().withMessage('Device context required'),
    body('parameters').optional().isObject(),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const {
        imageData,
        deviceContext,
        parameters = {},
      } = req.body;

      // Add user ID from JWT token (DISABLED FOR TESTING)
      const enhancedDeviceContext = {
        ...deviceContext,
        userId: 'test-user', // req.user?.id,
      };

      log.info('🎨 Mobile image refinement request', LogContext.API, {
        deviceId: deviceContext.deviceId,
        batteryLevel: deviceContext.batteryLevel,
        mlxOptimized: true,
      });

      // Convert base64 image data to buffer
      const imageBuffer = Buffer.from(imageData, 'base64');

      const result = await pyVisionBridge.refineImageForIOS(
        imageBuffer,
        enhancedDeviceContext,
        parameters
      );

      if (result.success) {
        return sendSuccess(res, result.data, 200, {
          visionMetadata: {
            processingTime: result.processingTime,
            model: result.model,
            mlxOptimized: result.data?.mlxOptimized,
          },
          deviceOptimizations: (result.data as any)?.deviceOptimizations,
        });
      } else {
        return sendError(res, 
          'REFINEMENT_ERROR',
          result.error || 'Image refinement failed',
          500
        );
      }
    } catch (error) {
      log.error('❌ Mobile image refinement error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return sendError(res, 
        'INTERNAL_ERROR',
        'Internal server error during image refinement',
        500
      );
    }
  }
);

/**
 * Get mobile orchestration metrics
 * GET /api/v1/mobile-orchestration/metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const orchestrationMetrics = mobileDSPyOrchestrator.getMetrics();
    const visionMetrics = pyVisionBridge.getMetrics();

    return sendSuccess(res, {
      orchestration: orchestrationMetrics,
      vision: {
        avgResponseTime: visionMetrics.avgResponseTime,
        totalRequests: visionMetrics.totalRequests,
        successRate: visionMetrics.successRate,
        mlxOptimized: visionMetrics.mlxOptimized,
        iOSOptimizations: visionMetrics.iOSOptimizations,
        deviceContextUsed: visionMetrics.deviceContextUsed,
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      },
    }, 200);
  } catch (error) {
    log.error('❌ Failed to get mobile orchestration metrics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });

    return sendError(res, 
      'SERVICE_ERROR',
      'Failed to retrieve metrics',
      500
    );
  }
});

/**
 * Test mobile optimization with device context
 * POST /api/v1/mobile-orchestration/test
 */
router.post(
  '/test',
  [
    body('deviceContext').isObject().withMessage('Device context required'),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { deviceContext } = req.body;

      const testRequest: MobileOptimizedRequest = {
        taskType: 'quick_response',
        userInput: 'Test mobile orchestration with device optimization',
        deviceContext: {
          ...deviceContext,
          userId: 'test-user', // req.user?.id,
        },
        optimizationPreferences: {
          prioritizeBattery: true,
          preferCachedResults: false, // Force fresh processing for test
          maxProcessingTime: 10000,
          qualityLevel: 'fast',
        },
        contextEnrichment: false,
      };

      const result = await mobileDSPyOrchestrator.orchestrate(testRequest);

      return sendSuccess(res, {
        test_result: result.success ? 'PASS' : 'FAIL',
        orchestration_result: result,
        system_status: {
          mobile_orchestrator: 'active',
          vision_bridge: pyVisionBridge.getMetrics().isInitialized ? 'active' : 'inactive',
          context_injection: 'active',
        },
      }, 200);

    } catch (error) {
      log.error('❌ Mobile orchestration test failed', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return sendError(res, 
        'SERVICE_ERROR',
        'Mobile orchestration test failed',
        500
      );
    }
  }
);

/**
 * Intelligent Agent Selection - No manual selection needed!
 * POST /api/v1/mobile-orchestration/select-agent
 */
router.post(
  '/select-agent',
  [
    body('userInput').notEmpty().withMessage('User input is required'),
    body('deviceContext').optional().isObject(),
    body('conversationHistory').optional().isArray(),
    body('userPreferences').optional().isObject(),
    body('urgency').optional().isIn(['low', 'medium', 'high']),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const {
        userInput,
        deviceContext = {},
        conversationHistory = [],
        userPreferences = {},
        urgency = 'medium',
      } = req.body;

      log.info('🤖 Intelligent agent selection request', LogContext.API, {
        userInput: userInput.substring(0, 100),
        hasDeviceContext: Object.keys(deviceContext).length > 0,
        historyLength: conversationHistory.length,
      });

      const recommendation = await intelligentAgentSelector.selectAgent({
        userInput,
        deviceContext: {
          ...deviceContext,
          userId: 'test-user', // req.user?.id,
        },
        conversationHistory,
        userPreferences,
        urgency,
      });

      return sendSuccess(res, {
        recommendation,
        metadata: {
          selectionMethod: 'intelligent_athena_powered',
          automaticSelection: true,
          manualSelectionRequired: false,
          timestamp: new Date().toISOString(),
        },
      }, 200);

    } catch (error) {
      log.error('❌ Intelligent agent selection failed', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return sendError(res, 
        'SELECTION_ERROR',
        'Intelligent agent selection failed',
        500
      );
    }
  }
);

/**
 * Smart Chat - Combines agent selection + execution in one call
 * POST /api/v1/mobile-orchestration/smart-chat
 */
router.post(
  '/smart-chat',
  [
    body('userInput').notEmpty().withMessage('User input is required'),
    body('deviceContext').optional().isObject(),
    body('conversationHistory').optional().isArray(),
    body('userPreferences').optional().isObject(),
  ],
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const {
        userInput,
        deviceContext = {},
        conversationHistory = [],
        userPreferences = {},
      } = req.body;

      const enhancedDeviceContext = {
        ...deviceContext,
        userId: 'test-user', // req.user?.id,
      };

      log.info('💬 Smart chat request received', LogContext.API, {
        userInput: userInput.substring(0, 100),
        deviceId: deviceContext.deviceId,
        batteryLevel: deviceContext.batteryLevel,
      });

      // Step 1: Intelligent agent selection
      const startTime = Date.now();
      const recommendation = await intelligentAgentSelector.selectAgent({
        userInput,
        deviceContext: enhancedDeviceContext,
        conversationHistory,
        userPreferences,
      });

      const selectionTime = Date.now() - startTime;

      // Step 2: Execute with selected agent using mobile orchestration
      const orchestrationRequest: MobileOptimizedRequest = {
        taskType: recommendation.processingComplexity === 'simple' ? 'quick_response' : 
                  recommendation.processingComplexity === 'complex' ? 'deep_analysis' : 'creative_task',
        userInput,
        deviceContext: enhancedDeviceContext,
        optimizationPreferences: {
          prioritizeBattery: recommendation.batteryImpact !== 'low',
          preferCachedResults: recommendation.batteryImpact === 'high',
          maxProcessingTime: recommendation.estimatedResponseTime,
          qualityLevel: enhancedDeviceContext.isLowPowerMode ? 'fast' : 'balanced',
        },
        contextEnrichment: true,
      };

      const executionStartTime = Date.now();
      const result = await mobileDSPyOrchestrator.orchestrate(orchestrationRequest);
      const executionTime = Date.now() - executionStartTime;

      // Step 3: Update performance metrics
      intelligentAgentSelector.updatePerformanceMetrics(
        recommendation.primaryAgent,
        result.success,
        executionTime,
        undefined, // User satisfaction - would be provided by user feedback
        recommendation.batteryImpact === 'low' ? 0.9 : recommendation.batteryImpact === 'medium' ? 0.7 : 0.5
      );

      const response = {
        success: result.success,
        response: result.success ? result.result : null,
        error: result.error,
        agentSelection: {
          selectedAgent: recommendation.primaryAgent,
          confidence: recommendation.confidence,
          reasoning: recommendation.reasoning,
          fallbackAgents: recommendation.fallbackAgents,
          selectionTime: `${selectionTime}ms`,
          automaticSelection: true,
        },
        execution: {
          processingTime: `${executionTime}ms`,
          agentsUsed: result.metadata?.agentsUsed || [],
          batteryOptimizations: result.metadata?.batteryOptimizations || [],
          networkOptimizations: result.metadata?.networkOptimizations || [],
          deviceOptimized: true,
        },
        performance: {
          totalTime: `${Date.now() - startTime}ms`,
          batteryImpact: recommendation.batteryImpact,
          networkImpact: recommendation.networkImpact,
          cacheHit: result.metadata?.cacheHit || false,
        },
      };

      if (result.success) {
        log.info('✅ Smart chat completed successfully', LogContext.API, {
          selectedAgent: recommendation.primaryAgent,
          confidence: recommendation.confidence,
          totalTime: response.performance.totalTime,
          batteryOptimized: result.metadata?.batteryOptimizations.length > 0,
        });

        return sendSuccess(res, response, 200);
      } else {
        log.warn('⚠️ Smart chat partially failed', LogContext.API, {
          selectedAgent: recommendation.primaryAgent,
          error: result.error,
        });

        return sendError(res, 
          'EXECUTION_ERROR',
          result.error || 'Smart chat execution failed',
          500,
          response
        );
      }

    } catch (error) {
      log.error('❌ Smart chat failed', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });

      return sendError(res, 
        'SMART_CHAT_ERROR',
        'Smart chat system failed',
        500
      );
    }
  }
);

export default router;