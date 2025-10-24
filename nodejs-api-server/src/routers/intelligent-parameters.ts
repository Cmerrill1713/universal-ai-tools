/**
 * Intelligent Parameters Router
 * API endpoints for ML-based parameter optimization
 */

import express, { Request, Response } from 'express';
import { IntelligentParameterService, ParameterOptimizationRequest } from '../services/intelligent-parameter-service';

const router = express.Router();

// Initialize Intelligent Parameter Service
const intelligentParameterService = new IntelligentParameterService(
  process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
);

// Initialize service
intelligentParameterService.initialize().catch(error => {
  console.error('Failed to initialize Intelligent Parameter Service:', error);
});

/**
 * POST /api/parameters/optimize
 * Optimize parameters for a given request
 */
router.post('/optimize', async (req: Request, res: Response) => {
  try {
    const { 
      model, 
      modelProvider,
      taskType, 
      context, 
      userPreferences, 
      performanceGoals, 
      historicalData 
    } = req.body;

    if (!model || !taskType || !context) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: model, taskType, context'
      });
    }

    const request: ParameterOptimizationRequest = {
      model: model || process.env.DEFAULT_LLM_MODEL,
      modelProvider: modelProvider || (process.env.DEFAULT_LLM_PROVIDER as 'ollama' | 'mlx' | 'openai' | 'anthropic') || 'ollama',
      taskType,
      context,
      userPreferences,
      performanceGoals: performanceGoals || ['accuracy'],
      historicalData: historicalData || []
    };

    const response = await intelligentParameterService.optimizeParameters(request);

    res.json({
      success: response.success,
      data: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Parameter optimization error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/parameters/feedback
 * Provide feedback on parameter performance
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { learningDataId, actualPerformance, userFeedback } = req.body;

    if (!learningDataId || !actualPerformance) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: learningDataId, actualPerformance'
      });
    }

    await intelligentParameterService.updatePerformanceData(
      learningDataId,
      actualPerformance,
      userFeedback
    );

    res.json({
      success: true,
      message: 'Performance data updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Parameter feedback error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parameters/analytics
 * Get parameter optimization analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = intelligentParameterService.getAnalytics();

    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Parameter analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parameters/task-types
 * Get available task types
 */
router.get('/task-types', async (req: Request, res: Response) => {
  try {
    const taskTypes = [
      {
        id: 'text_generation',
        name: 'Text Generation',
        description: 'General text generation tasks',
        defaultParams: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          num_predict: 2000,
          num_ctx: 4000
        }
      },
      {
        id: 'chat',
        name: 'Chat',
        description: 'Conversational AI tasks',
        defaultParams: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          repeat_penalty: 1.1,
          num_predict: 1000,
          num_ctx: 4000
        }
      },
      {
        id: 'analysis',
        name: 'Analysis',
        description: 'Text analysis and reasoning tasks',
        defaultParams: {
          temperature: 0.3,
          top_p: 0.8,
          top_k: 20,
          repeat_penalty: 1.2,
          num_predict: 1500,
          num_ctx: 4000
        }
      },
      {
        id: 'code_generation',
        name: 'Code Generation',
        description: 'Programming and code generation tasks',
        defaultParams: {
          temperature: 0.2,
          top_p: 0.8,
          top_k: 20,
          repeat_penalty: 1.3,
          num_predict: 2000,
          num_ctx: 6000
        }
      },
      {
        id: 'summarization',
        name: 'Summarization',
        description: 'Text summarization tasks',
        defaultParams: {
          temperature: 0.3,
          top_p: 0.8,
          top_k: 20,
          repeat_penalty: 1.1,
          num_predict: 500,
          num_ctx: 4000
        }
      },
      {
        id: 'translation',
        name: 'Translation',
        description: 'Language translation tasks',
        defaultParams: {
          temperature: 0.1,
          top_p: 0.7,
          top_k: 10,
          repeat_penalty: 1.2,
          num_predict: 1000,
          num_ctx: 4000
        }
      }
    ];

    res.json({
      success: true,
      data: taskTypes,
      count: taskTypes.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Task types error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parameters/performance-goals
 * Get available performance goals
 */
router.get('/performance-goals', async (req: Request, res: Response) => {
  try {
    const performanceGoals = [
      {
        id: 'accuracy',
        name: 'Accuracy',
        description: 'Optimize for response accuracy and correctness',
        impact: 'Reduces temperature, focuses sampling'
      },
      {
        id: 'speed',
        name: 'Speed',
        description: 'Optimize for faster response times',
        impact: 'Reduces context length and response length'
      },
      {
        id: 'creativity',
        name: 'Creativity',
        description: 'Optimize for creative and diverse responses',
        impact: 'Increases temperature and sampling diversity'
      },
      {
        id: 'consistency',
        name: 'Consistency',
        description: 'Optimize for consistent and reliable responses',
        impact: 'Reduces temperature, increases repeat penalty'
      }
    ];

    res.json({
      success: true,
      data: performanceGoals,
      count: performanceGoals.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Performance goals error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/parameters/batch-optimize
 * Optimize parameters for multiple requests
 */
router.post('/batch-optimize', async (req: Request, res: Response) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid requests array'
      });
    }

    const results = [];
    for (const request of requests) {
      try {
        const response = await intelligentParameterService.optimizeParameters(request);
        results.push({
          success: true,
          data: response
        });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          request: request
        });
      }
    }

    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch parameter optimization error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parameters/status
 * Get service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await intelligentParameterService.getStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Parameter service status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/parameters/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'Intelligent Parameter Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/parameters/optimize',
      'POST /api/parameters/feedback',
      'GET /api/parameters/analytics',
      'GET /api/parameters/task-types',
      'GET /api/parameters/performance-goals',
      'POST /api/parameters/batch-optimize',
      'GET /api/parameters/status',
      'GET /api/parameters/health'
    ]
  });
});

export default router;