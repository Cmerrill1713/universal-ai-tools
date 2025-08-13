/**
 * Context Analytics Router
 * Exposes the powerful context analytics service via API endpoints
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { authenticate } from '@/middleware/auth';
import { contextAnalyticsService } from '@/services/context-analytics-service';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// GET /api/v1/context-analytics/status
router.get('/status', authenticate, async (req, res) => {
  try {
    const status = await contextAnalyticsService.getSystemHealth();
    res.json({
      success: true,
      data: status,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get context analytics status', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics status',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/context-analytics/metrics
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const metrics = await contextAnalyticsService.getCurrentMetrics();
    res.json({
      success: true,
      data: metrics,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get context metrics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/context-analytics/user/:userId
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        metadata: { requestId: uuidv4() }
      });
    }
    const analytics = await contextAnalyticsService.getUserAnalytics(userId);
    
    return res.json({
      success: true,
      data: analytics,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get user analytics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to get user analytics',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/context-analytics/compression
router.get('/compression', authenticate, async (req, res) => {
  try {
    const compressionStats = await contextAnalyticsService.getCompressionAnalytics();
    res.json({
      success: true,
      data: compressionStats,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get compression analytics', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get compression analytics',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/context-analytics/patterns
router.get('/patterns', authenticate, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const patterns = await contextAnalyticsService.getUsagePatterns(timeRange as string);
    
    res.json({
      success: true,
      data: patterns,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to get usage patterns', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get usage patterns',
      metadata: { requestId: uuidv4() }
    });
  }
});

// POST /api/v1/context-analytics/optimize
router.post('/optimize', authenticate, async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
    const recommendations = await contextAnalyticsService.optimizeContextForUser(userId, sessionId);
    
    res.json({
      success: true,
      data: recommendations,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    log.error('Failed to optimize context', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to optimize context',
      metadata: { requestId: uuidv4() }
    });
  }
});

// GET /api/v1/context-analytics/health
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      service: 'context-analytics',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: health,
      metadata: { requestId: uuidv4() }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: 'Service unhealthy',
      metadata: { requestId: uuidv4() }
    });
  }
});

export default router;