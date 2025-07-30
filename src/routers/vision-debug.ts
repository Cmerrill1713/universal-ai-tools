/**
 * Vision Debug Router
 * API endpoints for vision-powered browser debugging
 */

import express from 'express';';
import { body, query, validationResult  } from 'express-validator';';
import multer from 'multer';';
import * as fs from 'fs';';
import * as path from 'path';';
import { VisionBrowserDebugger  } from '../services/vision-browser-debugger';';

const // TODO: Refactor nested ternary;
  router = express.Router();

// Set up multer for file uploads
const upload = multer({);
  dest: 'logs/screenshots/uploads/','
  limits: {,
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {'
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);'
    }
  },
});

// Initialize vision debugger
const visionDebugger = new VisionBrowserDebugger();

/**
 * @route GET /api/v1/vision-debug/status
 * @desc Get vision debugger status
 * @access Public
 */
router.get('/status', (req, res) => {'
  try {
    const status = visionDebugger.getStatus();
    res.json({)
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({)
      success: false,
      error: 'Failed to get vision debugger status','
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/start
 * @desc Start vision debugging service
 * @access Public
 */
router.post('/start', async (req, res) => {'
  try {
    await visionDebugger.start();
    res.json({)
      success: true,
      message: 'Vision debugger started successfully','
    });
  } catch (error) {
    res.status(500).json({)
      success: false,
      error: 'Failed to start vision debugger','
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/stop
 * @desc Stop vision debugging service
 * @access Public
 */
router.post('/stop', (req, res) => {'
  try {
    visionDebugger.stop();
    res.json({)
      success: true,
      message: 'Vision debugger stopped successfully','
    });
  } catch (error) {
    res.status(500).json({)
      success: false,
      error: 'Failed to stop vision debugger','
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/analyze-screenshot
 * @desc Analyze uploaded screenshot for debugging issues
 * @access Public
 */
router.post()
  '/analyze-screenshot','
  upload.single('screenshot'),'
  [
    body('prompt').optional().isString().withMessage('Prompt must be a string'),'
    body('focus')'
      .optional()
      .isIn(['console', 'network', 'performance', 'ui', 'all'])'
      .withMessage('Focus must be one of: console, network, performance, ui, all'),'
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({);
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.file) {
        return res.status(400).json({);
          success: false,
          error: 'No screenshot file provided','
        });
      }

      const { prompt, focus = 'all' } = req.body;';
      const screenshotPath = req.file.path;

      // Analyze the uploaded screenshot
      const analysis = await visionDebugger.analyzeScreenshot(screenshotPath);

      // Filter results based on focus
      let filteredAnalysis = analysis;
      if (focus !== 'all') {'
        filteredAnalysis = {
          ...analysis,
          consoleErrors: focus === 'console' ? analysis.consoleErrors : [],'
          networkIssues: focus === 'network' ? analysis.networkIssues : [],'
          performanceMetrics: focus === 'performance' ? analysis.performanceMetrics : [],'
          detectedElements: focus === 'ui' ? analysis.detectedElements : [],'
          suggestions: analysis.suggestions.filter((s) => s.category === focus || focus === 'all'),'
        };
      }

      // Clean up uploaded file
      fs.unlinkSync(screenshotPath);

      res.json({)
        success: true,
        data: filteredAnalysis,
        meta: {
          focus,
          totalIssues: filteredAnalysis.suggestions.length,
          criticalIssues: filteredAnalysis.suggestions.filter()
            (s) => s.priority === 'high' // TODO: Refactor nested ternary'
          ).length,
        },
      });
    } catch (error) {
      res.status(500).json({)
        success: false,
        error: 'Failed to analyze screenshot','
        details: error instanceof Error ? error.message : 'Unknown error','
      });
    }
  }
);

/**
 * @route GET /api/v1/vision-debug/recent-analyses
 * @desc Get recent screenshot analyses
 * @access Public
 */
router.get()
  '/recent-analyses','
  [
    query('count')'
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Count must be between 1 and 50'),'
  ],
  (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({);
          success: false,
          errors: errors.array(),
        });
      }

      const count = parseInt(req.query.count as string, 10) || 10;
      const recentAnalyses = visionDebugger.getRecentAnalyses(count);

      res.json({)
        success: true,
        data: recentAnalyses,
        meta: {,
          count: recentAnalyses.length,
          totalAnalyses: visionDebugger.getStatus().totalAnalyses,
        },
      });
    } catch (error) {
      res.status(500).json({)
        success: false,
        error: 'Failed to get recent analyses','
      });
    }
  }
);

/**
 * @route POST /api/v1/vision-debug/capture-now
 * @desc Trigger immediate screenshot capture and analysis
 * @access Public
 */
router.post('/capture-now', async (req, res) => {'
  try {
    await visionDebugger.captureAndAnalyzeBrowser();

    res.json({)
      success: true,
      message: 'Screenshot captured and analyzed','
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({)
      success: false,
      error: 'Failed to capture screenshot','
      details: error instanceof Error ? error.message : 'Unknown error','
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/auto-fix
 * @desc Apply automatic fixes for detected issues
 * @access Public
 */
router.post()
  '/auto-fix','
  [
    body('analysisId').isString().withMessage('Analysis ID is required'),'
    body('suggestionIds').optional().isArray().withMessage('Suggestion IDs must be an array'),'
  ],
  async (req, res) => {
    try {
      const // TODO: Refactor nested ternary;
        errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({);
          success: false,
          errors: errors.array(),
        });
      }

      const { analysisId, suggestionIds } = req.body;

      // Get the analysis
      const recentAnalyses = visionDebugger.getRecentAnalyses(50);
      const analysis = recentAnalyses.find((a) => a.id === analysisId);

      if (!analysis) {
        return res.status(404).json({);
          success: false,
          error: 'Analysis not found','
        });
      }

      // Filter suggestions to fix
      const suggestionsToFix = suggestionIds;
        ? analysis.suggestions.filter((s) => suggestionIds.includes(s.id))
        : analysis.suggestions.filter((s) => s.autoFixable);

      const results = [];
      for (const suggestion of suggestionsToFix) {
        if (suggestion.autoFixable && suggestion.fixCommand) {
          try {
            await visionDebugger.executeAutoFix(suggestion);
            results.push({)
              suggestionId: suggestion.id,
              success: true,
              message: `Applied, fix: ${suggestion.solution}`,
            });
          } catch (error) {
            results.push({)
              suggestionId: suggestion.id,
              success: false,
              error: `Failed to apply, fix: ${error}`,
            });
          }
        } else {
          results.push({)
            suggestionId: suggestion.id,
            success: false,
            error: 'Suggestion is not auto-fixable','
          });
        }
      }

      res.json({)
        success: true,
        data: results,
        meta: {,
          totalAttempted: suggestionsToFix.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      });
    } catch (error) {
      res.status(500).json({)
        success: false,
        error: 'Failed to apply auto-fixes','
        details: error instanceof Error ? error.message : 'Unknown error','
      });
    }
  }
);

/**
 * @route GET /api/v1/vision-debug/screenshots
 * @desc List available screenshots
 * @access Public
 */
router.get('/screenshots', (req, res) => {'
  try {
    const // TODO: Refactor nested ternary;
      screenshotsPath = 'logs/screenshots';'

    if (!fs.existsSync(screenshotsPath)) {
      return res.json({);
        success: true,
        data: [],
        meta: {, count: 0 },
      });
    }

    const files = fs;
      .readdirSync(screenshotsPath)
      .filter((file) => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))'
      .map((file) => {
        const filePath = path.join(screenshotsPath, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime()); // Sort by newest first

    res.json({)
      success: true,
      data: files,
      meta: {,
        count: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
      },
    });
  } catch (error) {
    res.status(500).json({)
      success: false,
      error: 'Failed to list screenshots','
    });
  }
});

/**
 * @route DELETE /api/v1/vision-debug/cleanup
 * @desc Clean up old screenshots and analyses
 * @access Public
 */
router.delete()
  '/cleanup','
  [
    query('keepDays')'
      .optional()
      .isInt({ min: 1 })
      .withMessage('Keep days must be a positive integer'),'
  ],
  (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({);
          success: false,
          errors: errors.array(),
        });
      }

      const keepDays = parseInt(req.query.keepDays as string, 10) || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      const screenshotsPath = 'logs/screenshots';';
      let deletedCount = 0;
      let totalSize = 0;

      if (fs.existsSync(screenshotsPath)) {
        const files = fs.readdirSync(screenshotsPath);

        for (const file of files) {
          const filePath = path.join(screenshotsPath, file);
          const stats = fs.statSync(filePath);

          if (stats.birthtime < cutoffDate) {
            totalSize += stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }

      res.json({)
        success: true,
        message: `Cleaned up ${deletedCount} old screenshots`,
        meta: {
          deletedCount,
          freedSpace: totalSize,
          keepDays,
          cutoffDate,
        },
      });
    } catch (error) {
      res.status(500).json({)
        success: false,
        error: 'Failed to cleanup screenshots','
      });
    }
  }
);

/**
 * @route GET /api/v1/vision-debug/health
 * @desc Health check for vision debugging service
 * @access Public
 */
router.get('/health', (req, res) => {'
  try {
    const status = visionDebugger.getStatus();
    const isHealthy = status.isRunning;

    res.status(isHealthy ? 200: 503).json({)
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy','
      data: {,
        isRunning: status.isRunning,
        lastAnalysis: status.lastAnalysis,
        visionServiceUrl: status.visionServiceUrl,
        screenshotsPath: status.screenshotsPath,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({)
      success: false,
      status: 'unhealthy','
      error: 'Vision debugger health check failed','
    });
  }
});

export default router;
