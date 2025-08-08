/**
 * Mobile Orchestration Router;
 * API endpoints for iOS-optimized DSPy cognitive orchestration;
 */

import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import type { MobileOptimizedRequest } from '../types';
import { mobileDSPyOrchestrator } from '../services/mobile-dspy-orchestrator';
import { contextInjectionService } from '../services/context-injection-service';
import { pyVisionBridge } from '../services/pyvision-bridge';
import { intelligentAgentSelector } from '../services/intelligent-agent-selector';
import { sendError, sendSuccess } from '../utils/api-response';
import { LogContext, log } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validate-request';
import { body, query } from 'express-validator';

const router = express?.Router();

// Apply authentication to all routes (DISABLED FOR TESTING)
// router?.use(authenticate);

/**
 * Mobile-optimized cognitive orchestration;
 * POST /api/v1/mobile-orchestration/orchestrate;
 */
router?.post()
  '/orchestrate','
  [
    body('taskType')'
      .isIn(['quick_response', 'deep_analysis', 'creative_task', 'ios_development', 'swift_coding'])'
      .withMessage('Invalid task type'),'
    body('userInput').notEmpty().withMessage('User input is required'),'
    body('deviceContext').isObject().withMessage('Device context must be an object'),'
    body('optimizationPreferences').optional().isObject(),'
    body('contextEnrichment').optional().isBoolean()'
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const {
        taskType,
        userInput,
        deviceContext,
        optimizationPreferences = {},
        contextEnrichment = true;
      } = req?.body;

      // Add user ID from JWT token (DISABLED FOR TESTING)
      const enhancedDeviceContext = {
        ...deviceContext,
        userId: 'test-user' // req?.user?.id;'
      };

      log?.info('Mobile orchestration request received', LogContext?.API, {')
        taskType,
        deviceId: deviceContext?.deviceId,
        batteryLevel: deviceContext?.batteryLevel,
        userId: 'test-user' // req?.user?.id;'
      });

      const request: MobileOptimizedRequest = {
        taskType,
        userInput,
        deviceContext: enhancedDeviceContext,
        optimizationPreferences: {,
          prioritizeBattery: true,
          preferCachedResults: true,
          maxProcessingTime: 30000,
          qualityLevel: 'balanced','
          ...optimizationPreferences;
        },
        contextEnrichment;
      };

      const result = await mobileDSPyOrchestrator?.orchestrate(request);

      if (result?.success) {
        log?.info('Mobile orchestration completed successfully', LogContext?.API, {')
          taskType,
          processingTime: result?.metadata?.totalProcessingTime,
          agentsUsed: result?.metadata?.agentsUsed;
        });

        return sendSuccess(res, result?.result, 200, {);
          metadata: result?.metadata,
          performance: {,
            processingTime: result?.metadata?.totalProcessingTime,
            agentsUsed: result?.metadata?.agentsUsed,
            optimizations: {,
              battery: result?.metadata?.batteryOptimizations,
              network: result?.metadata?.networkOptimizations;
            }
          }
        });
      } else {
        log?.error('Mobile orchestration failed', LogContext?.API, {')
          error: result?.error,
          processingTime: result?.metadata?.totalProcessingTime;
        });

        return sendError();
          res,
          'ORCHESTRATION_ERROR','
          result?.error || 'Mobile orchestration failed','
          500,
          result?.metadata;
        );
      }
    } catch (error) {
      log?.error('Mobile orchestration endpoint error', LogContext?.API, {')
        error: error instanceof Error ? error?.message : String(error)
      });

      return sendError();
        res,
        'INTERNAL_ERROR','
        'Internal server error during mobile orchestration','
        500,
      );
    }
  }
);

/**
 * iOS-optimized image analysis with cognitive reasoning;
 * POST /api/v1/mobile-orchestration/analyze-image;
 */
router?.post()
  '/analyze-image','
  [
    body('imageData').notEmpty().withMessage('Image data is required'),'
    body('analysisType')'
      .isIn(['object_detection', 'scene_understanding', 'text_extraction', 'creative_analysis'])'
      .withMessage('Invalid analysis type'),'
    body('deviceContext').isObject().withMessage('Device context must be an object'),'
    body('cognitiveDepth').optional().isIn(['shallow', 'moderate', 'deep']),'
    body('contextualPrompt').optional().isString()'
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const {
        imageData,
        analysisType,
        deviceContext,
        cognitiveDepth = 'moderate','
        contextualPrompt;
      } = req?.body;

      log?.info('iOS image analysis request received', LogContext?.API, {')
        analysisType,
        cognitiveDepth,
        deviceId: deviceContext?.deviceId,
        batteryLevel: deviceContext?.batteryLevel;
      });

      // First, perform vision analysis;
      const visionResult = await pyVisionBridge?.analyzeImage(imageData, {);
        analysisType,
        backend: deviceContext?.preferredBackend || 'mlx','
        optimization: {,
          maxMemory: deviceContext?.availableMemory,
          targetQuality: cognitiveDepth === 'deep' ? 'high' : 'balanced''
        }
      });

      if (!visionResult?.success) {
        return sendError();
          res,
          'VISION_ANALYSIS_ERROR','
          'Failed to analyze image','
          500,
          visionResult;
        );
      }

      // Then, apply cognitive reasoning to the vision results;
      const cognitiveRequest: MobileOptimizedRequest = {,;
        taskType: 'creative_task','
        userInput: contextualPrompt || `Analyze and interpret the following vision analysis, results: ${JSON?.stringify(visionResult?.analysis)}`,
        deviceContext,
        optimizationPreferences: {,
          prioritizeBattery: true,
          preferCachedResults: false,
          maxProcessingTime: 20000,
          qualityLevel: cognitiveDepth;
        },
        contextEnrichment: true;
      };

      const cognitiveResult = await mobileDSPyOrchestrator?.orchestrate(cognitiveRequest);

      if (cognitiveResult?.success) {
        return sendSuccess(res, {);
          visionAnalysis: visionResult?.analysis,
          cognitiveInterpretation: cognitiveResult?.result,
          metadata: {,
            vision: visionResult?.metadata,
            cognitive: cognitiveResult?.metadata,
            totalProcessingTime: (visionResult?.metadata?.processingTime || 0) + (cognitiveResult?.metadata?.totalProcessingTime || 0)
          }
        });
      } else {
        return sendError();
          res,
          'COGNITIVE_ANALYSIS_ERROR','
          'Failed to interpret vision results','
          500,
          cognitiveResult?.metadata;
        );
      }
    } catch (error) {
      log?.error('Image analysis endpoint error', LogContext?.API, {')
        error: error instanceof Error ? error?.message : String(error)
      });

      return sendError();
        res,
        'INTERNAL_ERROR','
        'Internal server error during image analysis','
        500,
      );
    }
  }
);

/**
 * Swift/iOS code generation with cognitive assistance;
 * POST /api/v1/mobile-orchestration/generate-swift;
 */
router?.post()
  '/generate-swift','
  [
    body('requirement').notEmpty().withMessage('Code requirement is required'),'
    body('contextCode').optional().isString(),'
    body('targetPlatform').isIn(['iOS', 'macOS', 'watchOS', 'tvOS', 'all']).withMessage('Invalid target platform'),'
    body('swiftVersion').optional().isString(),'
    body('includeTests').optional().isBoolean(),'
    body('deviceContext').isObject().withMessage('Device context must be an object')'
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const {
        requirement,
        contextCode,
        targetPlatform,
        swiftVersion = '5?.9','
        includeTests = false,
        deviceContext;
      } = req?.body;

      log?.info('Swift code generation request received', LogContext?.API, {')
        targetPlatform,
        swiftVersion,
        includeTests,
        deviceId: deviceContext?.deviceId;
      });

      // Build enhanced prompt for code generation;
      const enhancedPrompt = `;
        Generate Swift code for ${targetPlatform} with the following requirement: ${requirement}
        
        Target Swift version: ${swiftVersion}
        Include unit tests: ${includeTests}
        
        ${contextCode ? `Existing code context: n${contextCode}` : ''}'
        
        Requirements: - Follow Swift best practices and naming conventions;
        - Use modern Swift features where appropriate;
        - Include proper error handling;
        - Add comprehensive documentation comments;
        ${includeTests ? '- Include XCTest unit tests' : ''}'
      `;

      const request: MobileOptimizedRequest = {,;
        taskType: 'swift_coding','
        userInput: enhancedPrompt,
        deviceContext,
        optimizationPreferences: {,
          prioritizeBattery: false,
          preferCachedResults: false,
          maxProcessingTime: 45000,
          qualityLevel: 'high''
        },
        contextEnrichment: true;
      };

      const result = await mobileDSPyOrchestrator?.orchestrate(request);

      if (result?.success) {
        // Parse and structure the generated code;
        const codeStructure = {
          mainCode: result?.result,
          platform: targetPlatform,
          swiftVersion,
          includesTests: includeTests,
          metadata: result?.metadata;
        };

        return sendSuccess(res, codeStructure, 200, {);
          performance: {,
            processingTime: result?.metadata?.totalProcessingTime,
            agentsUsed: result?.metadata?.agentsUsed;
          }
        });
      } else {
        return sendError();
          res,
          'CODE_GENERATION_ERROR','
          'Failed to generate Swift code','
          500,
          result?.metadata;
        );
      }
    } catch (error) {
      log?.error('Swift code generation error', LogContext?.API, {')
        error: error instanceof Error ? error?.message : String(error)
      });

      return sendError();
        res,
        'INTERNAL_ERROR','
        'Internal server error during code generation','
        500,
      );
    }
  }
);

/**
 * Get mobile orchestration status and metrics;
 * GET /api/v1/mobile-orchestration/status;
 */
router?.get('/status', async (req: Request, res: Response) => {'
  try {
    const status = await mobileDSPyOrchestrator?.getStatus();
    const agentStatus = await intelligentAgentSelector?.getStatus();
    const contextStatus = await contextInjectionService?.getStatus();
    const visionStatus = await pyVisionBridge?.getStatus();

    const combinedStatus = {
      orchestrator: status,
      agents: agentStatus,
      context: contextStatus,
      vision: visionStatus,
      overall: {,
        healthy: status?.isHealthy && agentStatus?.healthy && contextStatus?.healthy && visionStatus?.healthy,
        timestamp: new Date().toISOString()
      }
    };

    return sendSuccess(res, combinedStatus);
  } catch (error) {
    log?.error('Failed to get mobile orchestration status', LogContext?.API, {')
      error: error instanceof Error ? error?.message : String(error)
    });

    return sendError();
      res,
      'STATUS_ERROR','
      'Failed to retrieve orchestration status','
      500,
    );
  }
});

/**
 * Get cached results for battery optimization;
 * GET /api/v1/mobile-orchestration/cache;
 */
router?.get()
  '/cache','
  [
    query('deviceId').notEmpty().withMessage('Device ID is required'),'
    query('taskType').optional().isString(),'
    query('limit').optional().isInt({ min: 1, max: 100) })'
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { deviceId, taskType, limit = 10 } = req?.query;

      const cachedResults = await mobileDSPyOrchestrator?.getCachedResults(deviceId as string);

      return sendSuccess(res, cachedResults);
    } catch (error) {
      log?.error('Failed to retrieve cached results', LogContext?.API, {')
        error: error instanceof Error ? error?.message : String(error)
      });

      return sendError();
        res,
        'CACHE_ERROR','
        'Failed to retrieve cached results','
        500,
      );
    }
  }
);

export default router;