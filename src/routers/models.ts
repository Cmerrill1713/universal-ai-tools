/**
 * Models Router
 * 
 * Provides endpoints for model discovery, routing decisions, and performance monitoring
 */

import { Router } from 'express';

import { dynamicModelRouter } from '../services/dynamic-model-router.js';
import { modelDiscoveryService } from '../services/model-discovery-service.js';
import { unifiedModelService } from '../services/unified-model-service.js';
import { log, LogContext } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/models/discover
 * Force model discovery and return all available models
 */
router.get('/discover', async (req, res) => {
  try {
    const models = await modelDiscoveryService.discoverAllModels();
    
    // Group models by provider and tier
    const byProvider: Record<string, any[]> = {};
    const byTier: Record<string, any[]> = {};
    
    models.forEach(model => {
      // By provider
      const provider = model.provider || 'unknown';
      if (!Object.prototype.hasOwnProperty.call(byProvider, provider)) {
        Object.assign(byProvider, { [provider]: [] });
      }
      byProvider[provider]?.push({
        name: model.name,
        tier: model.tier,
        size: model.sizeGB ? `${model.sizeGB.toFixed(1)}GB` : 'unknown',
        speed: model.estimatedSpeed || 'unknown',
        capabilities: model.capabilities?.slice(0, 3) || [],
      });
      
      // By tier
      const tierKey = `tier${model.tier}`;
      if (!Object.prototype.hasOwnProperty.call(byTier, tierKey)) {
        Object.assign(byTier, { [tierKey]: [] });
      }
      byTier[tierKey]?.push({
        name: model.name,
        provider: model.provider,
        capabilities: model.capabilities.slice(0, 3),
      });
    });
    
    res.json({
      success: true,
      data: {
        totalModels: models.length,
        providers: Object.keys(byProvider),
        byProvider,
        byTier,
        providerStatus: Object.fromEntries(modelDiscoveryService.getProviderStatus()),
      },
    });
  } catch (error) {
    log.error('Model discovery failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to discover models',
    });
  }
});

/**
 * GET /api/v1/models/list
 * Get all currently discovered models
 */
router.get('/list', (req, res) => {
  const models = modelDiscoveryService.getModels();
  
  res.json({
    success: true,
    data: {
      count: models.length,
      models: models.map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        tier: m.tier,
        size: m.sizeGB ? `${m.sizeGB.toFixed(1)}GB` : 'unknown',
        speed: m.estimatedSpeed,
        capabilities: m.capabilities,
      })),
    },
  });
});

/**
 * POST /api/v1/models/route
 * Get routing decision for a specific task
 */
router.post('/route', async (req, res) => {
  try {
    const { taskType = 'general', prompt = '', priority = 'balanced' } = req.body;
    
    const decision = await dynamicModelRouter.route(taskType, prompt, {
      priority: priority as 'speed' | 'quality' | 'balanced',
    });
    
    res.json({
      success: true,
      data: {
        primary: {
          model: decision.primary.name,
          provider: decision.primary.provider,
          tier: decision.primary.tier,
        },
        fallbacks: decision.fallbacks.map(f => ({
          model: f.name,
          provider: f.provider,
          tier: f.tier,
        })),
        reasoning: decision.reasoning,
        estimatedLatency: `${decision.estimatedLatency}ms`,
        confidence: decision.confidence,
      },
    });
  } catch (error) {
    log.error('Routing decision failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to determine routing',
    });
  }
});

/**
 * GET /api/v1/models/performance
 * Get performance statistics for all models
 */
router.get('/performance', (req, res) => {
  const performance = dynamicModelRouter.getPerformanceReport();
  const weights = dynamicModelRouter.getRoutingWeights();
  
  res.json({
    success: true,
    data: {
      modelPerformance: performance,
      routingWeights: weights,
      providerStats: unifiedModelService.getProviderStats(),
    },
  });
});

/**
 * POST /api/v1/models/test
 * Test a specific prompt with dynamic routing
 */
router.post('/test', async (req, res) => {
  try {
    const { 
      prompt = 'Hello, how are you?',
      taskType = 'conversation',
      priority = 'balanced',
      maxTokens = 500,
    } = req.body;
    
    const startTime = Date.now();
    
    const response = await unifiedModelService.generate({
      prompt,
      taskType,
      priority: priority as 'speed' | 'quality' | 'balanced',
      maxTokens,
      temperature: 0.7,
    });
    
    const totalTime = Date.now() - startTime;
    
    res.json({
      success: true,
      data: {
        response: response.content,
        model: response.model,
        metrics: {
          ...response.metrics,
          totalTimeMs: totalTime,
        },
        routing: response.routing,
      },
    });
  } catch (error) {
    log.error('Model test failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
    });
  }
});

/**
 * GET /api/v1/models/capabilities
 * Get models grouped by capabilities
 */
router.get('/capabilities', (req, res) => {
  const models = modelDiscoveryService.getModels();
  const capabilities: Record<string, string[]> = {};
  
  models.forEach(model => {
    model.capabilities.forEach(cap => {
      if (!Object.prototype.hasOwnProperty.call(capabilities, cap)) {
        Object.assign(capabilities, { [cap]: [] });
      }
      capabilities[cap]?.push(`${model.provider}:${model.name}`);
    });
  });
  
  res.json({
    success: true,
    data: {
      capabilities,
      availableCapabilities: Object.keys(capabilities),
    },
  });
});

/**
 * POST /api/v1/models/reset-performance
 * Reset performance data for a specific model
 */
router.post('/reset-performance', (req, res) => {
  const { modelId, provider } = req.body;
  
  if (!modelId || !provider) {
    return res.status(400).json({
      success: false,
      error: 'modelId and provider are required',
    });
  }
  
  try {
    dynamicModelRouter.resetModelPerformance(modelId, provider);
    
    return res.json({
      success: true,
      message: `Performance data reset for ${provider}:${modelId}`,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Failed to reset performance data',
    });
  }
});

export default router;