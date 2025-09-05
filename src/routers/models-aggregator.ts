/**
 * Models Aggregator Router - Unified model listing across all ML services
 * Provides a single endpoint to discover all available models
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { LogContext, log } from '../utils/logger';

const router = Router();

// Unified models endpoint - aggregates models from all services
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get models from different services with fallback
    const models = [];

    // Try to get MLX models
    try {
      const mlxResponse = await fetch('http://localhost:8080/api/v1/mlx/models');
      if (mlxResponse.ok) {
        const mlxData = await mlxResponse.json();
        if (mlxData.success && mlxData.data && mlxData.data.models) {
          models.push(...mlxData.data.models.map((m: any) => ({ ...m, provider: 'mlx' })));
        }
      }
    } catch (error) {
      log.warn('Failed to fetch MLX models', LogContext.API, { error });
    }

    // Try to get LFM2 models
    try {
      const lfm2Response = await fetch('http://localhost:8080/api/v1/lfm2/models');
      if (lfm2Response.ok) {
        const lfm2Data = await lfm2Response.json();
        if (lfm2Data.success && lfm2Data.data && lfm2Data.data.models) {
          models.push(...lfm2Data.data.models.map((m: any) => ({ ...m, provider: 'lfm2' })));
        }
      }
    } catch (error) {
      log.warn('Failed to fetch LFM2 models', LogContext.API, { error });
    }

    // Try to get LLM models
    try {
      const llmResponse = await fetch('http://localhost:8080/api/v1/llm/models');
      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        if (llmData.success && llmData.data && llmData.data.models) {
          models.push(...llmData.data.models.map((m: any) => ({ ...m, provider: 'llm' })));
        }
      }
    } catch (error) {
      log.warn('Failed to fetch LLM models', LogContext.API, { error });
    }

    // Group by provider
    const modelsByProvider = models.reduce(
      (acc, model) => {
        const provider = model.provider || 'unknown';
        if (!acc[provider]) {
          acc[provider] = [];
        }
        acc[provider].push(model);
        return acc;
      },
      {} as Record<string, any[]>
    );

    res.json({
      success: true,
      data: {
        total: models.length,
        providers: Object.keys(modelsByProvider).length,
        models,
        byProvider: modelsByProvider,
        services: [
          {
            name: 'MLX',
            endpoint: '/api/v1/mlx/models',
            count: modelsByProvider.mlx?.length || 0,
          },
          {
            name: 'LFM2',
            endpoint: '/api/v1/lfm2/models',
            count: modelsByProvider.lfm2?.length || 0,
          },
          {
            name: 'LLM',
            endpoint: '/api/v1/llm/models',
            count: modelsByProvider.llm?.length || 0,
          },
        ],
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    });
  } catch (error) {
    log.error('Failed to aggregate models', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'AGGREGATION_ERROR',
        message: 'Failed to aggregate models from services',
      },
    });
  }
});

// Get models by provider
router.get('/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    let models: any[] = [];
    let endpoint = '';

    switch (provider.toLowerCase()) {
      case 'mlx':
        endpoint = 'http://localhost:8080/api/v1/mlx/models';
        break;
      case 'lfm2':
        endpoint = 'http://localhost:8080/api/v1/lfm2/models';
        break;
      case 'llm':
        endpoint = 'http://localhost:8080/api/v1/llm/models';
        break;
      default:
        return res.status(404).json({
          success: false,
          error: {
            code: 'PROVIDER_NOT_FOUND',
            message: `Provider '${provider}' not found. Available providers: mlx, lfm2, llm`,
          },
        });
    }

    // Fetch from the provider's endpoint
    const response = await fetch(endpoint);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        models = data.data || [];
      }
    }

    res.json({
      success: true,
      data: {
        provider,
        count: models.length,
        models,
        endpoint,
      },
    });
  } catch (error) {
    log.error('Failed to get models by provider', LogContext.API, {
      error,
      provider: req.params.provider,
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: `Failed to get models for provider '${req.params.provider}'`,
      },
    });
  }
});

export default router;
