/**
 * Vision Debug Router - Integrated with VisionBrowserDebugger;
 * API endpoints for vision-powered browser debugging with real integration;
 */

import express from 'express';
import { VisionBrowserDebugger } from '../services/vision-browser-debugger';

const   router = express?.Router();

// Initialize the vision debugger service;
let visionDebugger: VisionBrowserDebugger;

try {
  visionDebugger = new VisionBrowserDebugger();
  visionDebugger?.start().catch(console?.error);
} catch (error) {
  console?.error('Failed to initialize VisionBrowserDebugger:', error);
}

/**
 * @route GET /api/v1/vision-debug/health;
 * @desc Health check for vision debugging service;
 * @access Public;
 */
router?.get('/health', (req, res) => {
  try {
    const status = visionDebugger ? visionDebugger?.getStatus() as unknown : null;

    res?.json({
      success: true,
      status: 'healthy',
      service: 'vision-debug',
      timestamp: new Date().toISOString(),
      debugger: status;
        ? {
            isRunning: status?.isRunning,
            totalAnalyses: status?.totalAnalyses,
            visionServiceUrl: status?.visionServiceUrl,
            lastAnalysis: status?.lastAnalysis,
          }
        : {
            isRunning: false,
            error: 'VisionBrowserDebugger not initialized',
          },
    });
  } catch (error) {
    res?.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Vision debugger health check failed',
      details: error instanceof Error ? error?.message : String(error),
    });
  }
});

/**
 * @route GET /api/v1/vision-debug/status;
 * @desc Get detailed vision debugger status;
 * @access Public;
 */
router?.get('/status', (req, res) => {
  try {
    if (!visionDebugger) {
      return res?.status(503).json({
        success: false,
        error: 'VisionBrowserDebugger not available',
      });
    }

    const       status = visionDebugger?.getStatus();

    return res?.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({
      success: false,
      error: 'Failed to get vision debugger status',
      details: error instanceof Error ? error?.message : String(error),
    });
  }
});

/**
 * @route GET /api/v1/vision-debug/analyses;
 * @desc Get recent analysis results;
 * @access Public;
 */
router?.get('/analyses', (req, res) => {
  try {
    if (!visionDebugger) {
      return res?.status(503).json({
        success: false,
        error: 'VisionBrowserDebugger not available',
      });
    }

    const count = parseInt(req?.query?.count as string, 10) || 10,
    const analyses = visionDebugger?.getRecentAnalyses(count);

    return res?.json({
      success: true,
      data: {
        analyses,
        count: analyses?.length,
        requested: count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({
      success: false,
      error: 'Failed to get analysis results',
      details: error instanceof Error ? error?.message : String(error),
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/capture-now;
 * @desc Trigger immediate screenshot capture and analysis;
 * @access Public;
 */
router?.post('/capture-now', async (req, res) => {
  try {
    if (!visionDebugger) {
      return res?.status(503).json({
        success: false,
        error: 'VisionBrowserDebugger not available',
      });
    }

    // Trigger immediate analysis;
    await visionDebugger?.captureAndAnalyzeBrowser();

    return res?.json({
      success: true,
      message: 'Screenshot capture and analysis triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res?.status(500).json({
      success: false,
      error: 'Failed to capture and analyze screenshot',
      details: error instanceof Error ? error?.message : String(error),
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/start;
 * @desc Start the vision debugger service;
 * @access Public;
 */
router?.post('/start', async (req, res) => {
  try {
    if (!visionDebugger) {
            visionDebugger = new VisionBrowserDebugger();
    }

    await visionDebugger?.start();

    res?.json({
      success: true,
      message: 'Vision debugger started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res?.status(500).json({
      success: false,
      error: 'Failed to start vision debugger',
      details: error instanceof Error ? error?.message : String(error),
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/stop;
 * @desc Stop the vision debugger service;
 * @access Public;
 */
router?.post('/stop', (req, res) => {
  try {
    if (visionDebugger) {
      visionDebugger?.stop();
    }

    res?.json({
      success: true,
      message: 'Vision debugger stopped',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res?.status(500).json({
      success: false,
      error: 'Failed to stop vision debugger',
      details: error instanceof Error ? error?.message : String(error),
    });
  }
});

export default router;
