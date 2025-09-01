import { Router, Request, Response } from 'express';
import { EnterpriseMLDeploymentService } from '@/services/enterprise-ml-deployment-service';
import { logger } from '@/utils/logger';
import { z } from 'zod';

const router = Router();
const mlDeploymentService = new EnterpriseMLDeploymentService();

// Schema definitions for request validation
const RegisterModelSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  framework: z.string(),
  runtime: z.string(),
  modelPath: z.string(),
  configPath: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  resources: z.object({
    cpu: z.number(),
    memory: z.string(),
    gpu: z.number().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

const CreateDeploymentSchema = z.object({
  modelId: z.string(),
  name: z.string(),
  environment: z.string(),
  strategy: z.enum(['blue_green', 'canary', 'rolling']),
  replicas: z.number().min(1).optional(),
  resources: z.object({
    cpu: z.number(),
    memory: z.string(),
    gpu: z.number().optional()
  }).optional(),
  config: z.record(z.any()).optional()
});

const CreateABTestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  controlModelId: z.string(),
  experimentModelId: z.string(),
  trafficSplit: z.number().min(0).max(1),
  metrics: z.array(z.string()),
  duration: z.number().optional(),
  config: z.record(z.any()).optional()
});

/**
 * Model Management Endpoints
 */

// Register a new model
router.post('/models/register', async (req: Request, res: Response) => {
  try {
    const validatedData = RegisterModelSchema.parse(req.body);
    const modelId = await mlDeploymentService.registerModel(validatedData);
    
    logger.info('Model registered successfully', { modelId, name: validatedData.name });
    
    res.status(201).json({
      success: true,
      data: { modelId },
      message: 'Model registered successfully'
    });
  } catch (error) {
    logger.error('Failed to register model', { error: error.message });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register model'
    });
  }
});

// List all registered models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const { environment, status } = req.query as { environment?: string; status?: string };
    const models = await mlDeploymentService.getModels({ environment, status });
    
    res.json({
      success: true,
      data: { models },
      count: models.length
    });
  } catch (error) {
    logger.error('Failed to fetch models', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch models'
    });
  }
});

// Get specific model details
router.get('/models/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const model = await mlDeploymentService.getModel(modelId);
    
    if (!model) {
      return res.status(404).json({
        success: false,
        error: 'Model not found'
      });
    }
    
    res.json({
      success: true,
      data: { model }
    });
  } catch (error) {
    logger.error('Failed to fetch model', { error: error.message, modelId: req.params.modelId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch model'
    });
  }
});

/**
 * Deployment Management Endpoints
 */

// Create new deployment
router.post('/deployments', async (req: Request, res: Response) => {
  try {
    const validatedData = CreateDeploymentSchema.parse(req.body);
    const deploymentId = await mlDeploymentService.createDeployment(validatedData);
    
    logger.info('Deployment created successfully', { deploymentId, modelId: validatedData.modelId });
    
    res.status(201).json({
      success: true,
      data: { deploymentId },
      message: 'Deployment created successfully'
    });
  } catch (error) {
    logger.error('Failed to create deployment', { error: error.message });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create deployment'
    });
  }
});

// List all deployments
router.get('/deployments', async (req: Request, res: Response) => {
  try {
    const { environment, status, modelId } = req.query as { 
      environment?: string; 
      status?: string; 
      modelId?: string; 
    };
    const deployments = await mlDeploymentService.getDeployments({ environment, status, modelId });
    
    res.json({
      success: true,
      data: { deployments },
      count: deployments.length
    });
  } catch (error) {
    logger.error('Failed to fetch deployments', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch deployments'
    });
  }
});

// Get specific deployment details
router.get('/deployments/:deploymentId', async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const deployment = await mlDeploymentService.getDeployment(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        success: false,
        error: 'Deployment not found'
      });
    }
    
    res.json({
      success: true,
      data: { deployment }
    });
  } catch (error) {
    logger.error('Failed to fetch deployment', { error: error.message, deploymentId: req.params.deploymentId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch deployment'
    });
  }
});

// Update deployment (scaling, config changes)
router.put('/deployments/:deploymentId', async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { replicas, config } = req.body;
    
    await mlDeploymentService.updateDeployment(deploymentId, { replicas, config });
    
    logger.info('Deployment updated successfully', { deploymentId });
    
    res.json({
      success: true,
      message: 'Deployment updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update deployment', { error: error.message, deploymentId: req.params.deploymentId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update deployment'
    });
  }
});

// Stop deployment
router.post('/deployments/:deploymentId/stop', async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    await mlDeploymentService.stopDeployment(deploymentId);
    
    logger.info('Deployment stopped successfully', { deploymentId });
    
    res.json({
      success: true,
      message: 'Deployment stopped successfully'
    });
  } catch (error) {
    logger.error('Failed to stop deployment', { error: error.message, deploymentId: req.params.deploymentId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop deployment'
    });
  }
});

// Rollback deployment
router.post('/deployments/:deploymentId/rollback', async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { targetVersion } = req.body;
    
    await mlDeploymentService.rollbackDeployment(deploymentId, targetVersion);
    
    logger.info('Deployment rolled back successfully', { deploymentId, targetVersion });
    
    res.json({
      success: true,
      message: 'Deployment rolled back successfully'
    });
  } catch (error) {
    logger.error('Failed to rollback deployment', { error: error.message, deploymentId: req.params.deploymentId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to rollback deployment'
    });
  }
});

/**
 * A/B Testing Endpoints
 */

// Create A/B test
router.post('/ab-tests', async (req: Request, res: Response) => {
  try {
    const validatedData = CreateABTestSchema.parse(req.body);
    const testId = await mlDeploymentService.createABTest(validatedData);
    
    logger.info('A/B test created successfully', { testId, name: validatedData.name });
    
    res.status(201).json({
      success: true,
      data: { testId },
      message: 'A/B test created successfully'
    });
  } catch (error) {
    logger.error('Failed to create A/B test', { error: error.message });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create A/B test'
    });
  }
});

// List all A/B tests
router.get('/ab-tests', async (req: Request, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const tests = await mlDeploymentService.getABTests({ status });
    
    res.json({
      success: true,
      data: { tests },
      count: tests.length
    });
  } catch (error) {
    logger.error('Failed to fetch A/B tests', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch A/B tests'
    });
  }
});

// Get A/B test results
router.get('/ab-tests/:testId/results', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    const results = await mlDeploymentService.getABTestResults(testId);
    
    if (!results) {
      return res.status(404).json({
        success: false,
        error: 'A/B test not found or no results available'
      });
    }
    
    res.json({
      success: true,
      data: { results }
    });
  } catch (error) {
    logger.error('Failed to fetch A/B test results', { error: error.message, testId: req.params.testId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch A/B test results'
    });
  }
});

// Stop A/B test
router.post('/ab-tests/:testId/stop', async (req: Request, res: Response) => {
  try {
    const { testId } = req.params;
    await mlDeploymentService.stopABTest(testId);
    
    logger.info('A/B test stopped successfully', { testId });
    
    res.json({
      success: true,
      message: 'A/B test stopped successfully'
    });
  } catch (error) {
    logger.error('Failed to stop A/B test', { error: error.message, testId: req.params.testId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop A/B test'
    });
  }
});

/**
 * Health and Monitoring Endpoints
 */

// Get deployment health
router.get('/deployments/:deploymentId/health', async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const health = await mlDeploymentService.getDeploymentHealth(deploymentId);
    
    res.json({
      success: true,
      data: { health }
    });
  } catch (error) {
    logger.error('Failed to fetch deployment health', { error: error.message, deploymentId: req.params.deploymentId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch deployment health'
    });
  }
});

// Get deployment metrics
router.get('/deployments/:deploymentId/metrics', async (req: Request, res: Response) => {
  try {
    const { deploymentId } = req.params;
    const { startTime, endTime, interval } = req.query as { 
      startTime?: string; 
      endTime?: string; 
      interval?: string; 
    };
    
    const metrics = await mlDeploymentService.getDeploymentMetrics(deploymentId, {
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      interval: interval || '1h'
    });
    
    res.json({
      success: true,
      data: { metrics }
    });
  } catch (error) {
    logger.error('Failed to fetch deployment metrics', { error: error.message, deploymentId: req.params.deploymentId });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch deployment metrics'
    });
  }
});

// Get system overview
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const overview = await mlDeploymentService.getSystemOverview();
    
    res.json({
      success: true,
      data: { overview }
    });
  } catch (error) {
    logger.error('Failed to fetch system overview', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch system overview'
    });
  }
});

/**
 * WebSocket Endpoints for Real-time Updates
 */

// Initialize WebSocket connections (called from main server)
export function initMLDeploymentWebSocket(server: any): void {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ 
    server, 
    path: '/ws/ml-deployment'
  });

  wss.on('connection', (ws: any) => {
    logger.info('ML Deployment WebSocket connection established');

    // Subscribe to deployment events
    const onDeploymentEvent = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'deployment_event',
          timestamp: new Date().toISOString(),
          ...data
        }));
      }
    };

    const onHealthAlert = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'health_alert',
          timestamp: new Date().toISOString(),
          ...data
        }));
      }
    };

    const onABTestUpdate = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ab_test_update',
          timestamp: new Date().toISOString(),
          ...data
        }));
      }
    };

    // Subscribe to events
    mlDeploymentService.on('deployment_status_changed', onDeploymentEvent);
    mlDeploymentService.on('health_alert', onHealthAlert);
    mlDeploymentService.on('ab_test_result', onABTestUpdate);

    // Handle client messages
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        logger.info('Received ML deployment WebSocket message', { type: data.type });
        
        // Handle subscribe/unsubscribe requests
        if (data.type === 'subscribe' && data.deploymentId) {
          // TODO: Implement deployment-specific subscriptions
        }
      } catch (error) {
        logger.error('Invalid WebSocket message', { error: error.message });
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      logger.info('ML Deployment WebSocket connection closed');
      mlDeploymentService.removeListener('deployment_status_changed', onDeploymentEvent);
      mlDeploymentService.removeListener('health_alert', onHealthAlert);
      mlDeploymentService.removeListener('ab_test_result', onABTestUpdate);
    });

    // Send initial connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connection_established',
      timestamp: new Date().toISOString(),
      message: 'Connected to ML Deployment service'
    }));
  });
}

export default router;