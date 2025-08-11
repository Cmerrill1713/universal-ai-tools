/**
 * Knowledge Ingestion Router
 * API endpoints for ingesting external knowledge sources into Supabase
 * Focused on Hugging Face Hub integration with Universal AI Tools
 */

import { Router } from 'express';
import { z } from 'zod';

import { zodValidate } from '@/middleware/zod-validate';
import { huggingFaceIngestionService } from '@/services/huggingface-ingestion-service';
import { log, LogContext } from '@/utils/logger';

const router = Router();

/**
 * POST /api/v1/knowledge-ingestion/huggingface
 * Trigger Hugging Face data ingestion
 */
router.post(
  '/huggingface',
  zodValidate(
    z.object({
      includeModels: z.boolean().optional(),
      includeDatasets: z.boolean().optional(),
      includePapers: z.boolean().optional(),
      modelLimit: z.number().int().min(1).max(1000).optional(),
      datasetLimit: z.number().int().min(1).max(1000).optional(),
      paperLimit: z.number().int().min(1).max(1000).optional(),
      popularOnly: z.boolean().optional(),
    })
  ),
  async (req, res) => {
    try {
      const {
        includeModels = true,
        includeDatasets = true,
        includePapers = true,
        modelLimit = 100,
        datasetLimit = 50,
        paperLimit = 25,
        popularOnly = true,
      } = req.body;

      log.info('🤗 Starting Hugging Face ingestion via API', LogContext.AI, {
        includeModels,
        includeDatasets,
        includePapers,
        modelLimit,
        datasetLimit,
        paperLimit,
        popularOnly,
      });

      // Start ingestion (this may take several minutes)
      const stats = await huggingFaceIngestionService.ingestHuggingFaceData({
        includeModels,
        includeDatasets,
        includePapers,
        modelLimit,
        datasetLimit,
        paperLimit,
        popularOnly,
      });

      // Return comprehensive results
      res.json({
        success: true,
        message: 'Hugging Face ingestion completed',
        stats,
        duration:
          stats.endTime && stats.startTime
            ? `${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`
            : 'Unknown',
        recommendations: [
          'Use GET /api/v1/knowledge-ingestion/stats to monitor ingestion progress',
          'Consider running incremental updates daily',
          'Check ingestion errors if any occurred',
        ],
      });
    } catch (error) {
      log.error('❌ Hugging Face ingestion failed via API', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(500).json({
        success: false,
        error: 'Hugging Face ingestion failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * POST /api/v1/knowledge-ingestion/huggingface/models
 * Ingest only Hugging Face models
 */
router.post(
  '/huggingface/models',
  zodValidate(
    z.object({
      limit: z.number().int().min(1).max(1000).optional(),
      popularOnly: z.boolean().optional(),
    })
  ),
  async (req, res) => {
    try {
      const { limit = 50, popularOnly = true } = req.body;

      log.info('📦 Starting Hugging Face models ingestion', LogContext.AI, { limit, popularOnly });

      const stats = await huggingFaceIngestionService.ingestHuggingFaceData({
        includeModels: true,
        includeDatasets: false,
        includePapers: false,
        modelLimit: limit,
        popularOnly,
      });

      res.json({
        success: true,
        message: 'Hugging Face models ingestion completed',
        modelsProcessed: stats.modelsProcessed,
        errors: stats.errors,
        duration:
          stats.endTime && stats.startTime
            ? `${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`
            : 'Unknown',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Models ingestion failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * POST /api/v1/knowledge-ingestion/huggingface/datasets
 * Ingest only Hugging Face datasets
 */
router.post(
  '/huggingface/datasets',
  zodValidate(
    z.object({
      limit: z.number().int().min(1).max(1000).optional(),
      popularOnly: z.boolean().optional(),
    })
  ),
  async (req, res) => {
    try {
      const { limit = 25, popularOnly = true } = req.body;

      log.info('📊 Starting Hugging Face datasets ingestion', LogContext.AI, {
        limit,
        popularOnly,
      });

      const stats = await huggingFaceIngestionService.ingestHuggingFaceData({
        includeModels: false,
        includeDatasets: true,
        includePapers: false,
        datasetLimit: limit,
        popularOnly,
      });

      res.json({
        success: true,
        message: 'Hugging Face datasets ingestion completed',
        datasetsProcessed: stats.datasetsProcessed,
        errors: stats.errors,
        duration:
          stats.endTime && stats.startTime
            ? `${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`
            : 'Unknown',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Datasets ingestion failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * POST /api/v1/knowledge-ingestion/huggingface/papers
 * Ingest only Hugging Face papers
 */
router.post(
  '/huggingface/papers',
  zodValidate(z.object({ limit: z.number().int().min(1).max(1000).optional() })),
  async (req, res) => {
    try {
      const { limit = 15 } = req.body;

      log.info('📚 Starting Hugging Face papers ingestion', LogContext.AI, { limit });

      const stats = await huggingFaceIngestionService.ingestHuggingFaceData({
        includeModels: false,
        includeDatasets: false,
        includePapers: true,
        paperLimit: limit,
      });

      res.json({
        success: true,
        message: 'Hugging Face papers ingestion completed',
        papersProcessed: stats.papersProcessed,
        errors: stats.errors,
        duration:
          stats.endTime && stats.startTime
            ? `${((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(2)}s`
            : 'Unknown',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Papers ingestion failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * GET /api/v1/knowledge-ingestion/stats
 * Get ingestion statistics and monitoring data
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await huggingFaceIngestionService.getIngestionStats();

    res.json({
      success: true,
      data: stats,
      recommendations: [
        stats.totalModels === 0 ? 'Run initial model ingestion' : 'Models loaded ✅',
        stats.totalDatasets === 0 ? 'Run initial dataset ingestion' : 'Datasets loaded ✅',
        stats.totalPapers === 0 ? 'Run initial papers ingestion' : 'Papers loaded ✅',
        stats.lastIngestion
          ? `Last update: ${stats.lastIngestion.toLocaleDateString()}`
          : 'No previous ingestion found',
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get ingestion stats',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/v1/knowledge-ingestion/test
 * Test ingestion with minimal data (for development)
 */
router.post('/test', async (req, res) => {
  try {
    log.info('🧪 Running test ingestion with minimal data', LogContext.AI);

    // Test with very small limits
    const stats = await huggingFaceIngestionService.ingestHuggingFaceData({
      includeModels: true,
      includeDatasets: true,
      includePapers: true,
      modelLimit: 5,
      datasetLimit: 3,
      paperLimit: 2,
      popularOnly: true,
    });

    res.json({
      success: true,
      message: 'Test ingestion completed successfully',
      stats,
      note: 'This was a test run with minimal data',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test ingestion failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/v1/knowledge-ingestion/clear
 * Clear all Hugging Face data from knowledge base (for development)
 */
router.delete('/clear', async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== 'DELETE_ALL_HUGGINGFACE_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Send {"confirm": "DELETE_ALL_HUGGINGFACE_DATA"} to confirm deletion',
      });
    }

    log.warn('🗑️  Clearing all Hugging Face data from knowledge base', LogContext.AI);

    // This would require implementing a clear method in the service
    // For now, return a placeholder response
    return res.json({
      success: true,
      message: 'Hugging Face data clearing initiated',
      note: 'Clear functionality needs to be implemented in the service',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to clear data',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
