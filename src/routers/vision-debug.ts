/**
 * Vision Debug Router
 * API endpoints for vision-powered browser debugging
 */

import type { Request, Response } from 'express';
import express from 'express';
import { body, query, validationResult } from 'express-validator';
import * as fs from 'fs';
import multer from 'multer';
import * as path from 'path';
import { VisionBrowserDebugger } from '../services/vision-browser-debugger';
import {
  createSecurePath,
  safeUnlink,
  sanitizeFilename,
  validateFile,
  validatePath,
  validatePathBoundary,
} from '../utils/path-security';

const router = express.Router();

// Security: Define allowed base directories for screenshot operations
const ALLOWED_SCREENSHOT_DIRS = [
  path.resolve(process.cwd(), 'logs/screenshots'),
  path.resolve(process.cwd(), 'logs/screenshots/uploads'),
];

// Security: Ensure upload directories exist and are secure
ALLOWED_SCREENSHOT_DIRS.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
});

// Set up multer for file uploads with enhanced security
const upload = multer({
  dest: ALLOWED_SCREENSHOT_DIRS[1], // uploads subdirectory
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only allow 1 file per request
    fieldSize: 1024, // Limit field size
  },
  fileFilter: (req, file, cb) => {
    // Validate MIME type
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed') as any, false);
    }

    // Validate and sanitize filename
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
    if (
      !validatePath(file.originalname, {
        maxLength: 255,
        allowedExtensions,
        additionalAllowedChars: ' ',
      })
    ) {
      return cb(new Error('Invalid filename') as any, false);
    }

    // Sanitize the filename to prevent any injection
    file.originalname = sanitizeFilename(file.originalname, {
      maxLength: 200,
      allowedExtensions,
    });

    cb(null, true);
  },
});

// Initialize vision debugger
const visionDebugger = new VisionBrowserDebugger();

/**
 * @route GET /api/v1/vision-debug/status
 * @desc Get vision debugger status
 * @access Public
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = visionDebugger.getStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get vision debugger status',
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/start
 * @desc Start vision debugging service
 * @access Public
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    await visionDebugger.start();
    return res.json({
      success: true,
      message: 'Vision debugger started successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to start vision debugger',
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/stop
 * @desc Stop vision debugging service
 * @access Public
 */
router.post('/stop', (req: Request, res: Response) => {
  try {
    visionDebugger.stop();
    return res.json({
      success: true,
      message: 'Vision debugger stopped successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to stop vision debugger',
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/analyze-screenshot
 * @desc Analyze uploaded screenshot for debugging issues
 * @access Public
 */
router.post(
  '/analyze-screenshot',
  upload.single('screenshot'),
  [
    body('prompt').optional().isString().withMessage('Prompt must be a string'),
    body('focus')
      .optional()
      .isIn(['console', 'network', 'performance', 'ui', 'all'])
      .withMessage('Focus must be one of: console, network, performance, ui, all'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No screenshot file provided',
        });
      }

      const { prompt, focus = 'all' } = req.body;
      const screenshotPath = req.file.path;

      // Security: verify uploaded file path stays within allowed boundaries
      if (!validatePathBoundary(screenshotPath, ALLOWED_SCREENSHOT_DIRS)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid upload path',
        });
      }

      // Analyze the uploaded screenshot
      const analysis = await visionDebugger.analyzeScreenshot(screenshotPath);

      // Filter results based on focus
      let filteredAnalysis = analysis;
      if (focus !== 'all') {
        filteredAnalysis = {
          ...analysis,
          consoleErrors: focus === 'console' ? analysis.consoleErrors : [],
          networkIssues: focus === 'network' ? analysis.networkIssues : [],
          performanceMetrics: focus === 'performance' ? analysis.performanceMetrics : [],
          detectedElements: focus === 'ui' ? analysis.detectedElements : [],
          suggestions: analysis.suggestions.filter((s) => s.category === focus || focus === 'all'),
        };
      }

      // Clean up uploaded file
      safeUnlink(screenshotPath, ALLOWED_SCREENSHOT_DIRS);

      return res.json({
        success: true,
        data: filteredAnalysis,
        meta: {
          focus,
          totalIssues: filteredAnalysis.suggestions.length,
          criticalIssues: filteredAnalysis.suggestions.filter((s) => s.priority === 'high').length,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to analyze screenshot',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route GET /api/v1/vision-debug/recent-analyses
 * @desc Get recent screenshot analyses
 * @access Public
 */
router.get(
  '/recent-analyses',
  [
    query('count')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Count must be between 1 and 50'),
  ],
  (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const count = parseInt(req.query.count as string, 10) || 10;
      const recentAnalyses = visionDebugger.getRecentAnalyses(count);

      return res.json({
        success: true,
        data: recentAnalyses,
        meta: {
          count: recentAnalyses.length,
          totalAnalyses: (visionDebugger.getStatus() as any).totalAnalyses,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get recent analyses',
      });
    }
  }
);

/**
 * @route POST /api/v1/vision-debug/capture-now
 * @desc Trigger immediate screenshot capture and analysis
 * @access Public
 */
router.post('/capture-now', async (req: Request, res: Response) => {
  try {
    await visionDebugger.captureAndAnalyzeBrowser();

    return res.json({
      success: true,
      message: 'Screenshot captured and analyzed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to capture screenshot',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @route POST /api/v1/vision-debug/auto-fix
 * @desc Apply automatic fixes for detected issues (SECURITY: Commands are whitelisted in VisionBrowserDebugger)
 * @access Public
 */
router.post(
  '/auto-fix',
  [
    body('analysisId')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Analysis ID is required and must be valid'),
    body('suggestionIds')
      .optional()
      .isArray({ max: 10 })
      .withMessage('Suggestion IDs must be an array with max 10 items'),
    body('suggestionIds.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Each suggestion ID must be a valid string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(
          `🔒 Vision debug auto-fix validation failed: ${JSON.stringify(errors.array())}`
        );
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { analysisId, suggestionIds } = req.body;

      // Security: Additional validation of analysisId format
      if (!/^analysis-\d+-[\w\-]+$/.test(analysisId)) {
        console.log(`🔒 Invalid analysis ID format rejected: ${analysisId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid analysis ID format',
        });
      }

      // Security: Log auto-fix attempt
      console.log(
        `🔒 Auto-fix attempt for analysis: ${analysisId}, suggestions: ${suggestionIds ? suggestionIds.join(',') : 'all-auto-fixable'}`
      );

      // Get the analysis
      const recentAnalyses = visionDebugger.getRecentAnalyses(50);
      const analysis = recentAnalyses.find((a) => a.id === analysisId);

      if (!analysis) {
        console.log(`🔒 Analysis not found for auto-fix: ${analysisId}`);
        return res.status(404).json({
          success: false,
          error: 'Analysis not found',
        });
      }

      // Filter suggestions to fix with additional security validation
      const suggestionsToFix = suggestionIds
        ? analysis.suggestions.filter((s) => suggestionIds.includes(s.id))
        : analysis.suggestions.filter((s) => s.autoFixable);

      // Security: Limit number of suggestions to process in one request
      if (suggestionsToFix.length > 10) {
        console.log(
          `🔒 Too many suggestions for auto-fix (${suggestionsToFix.length}), limiting to 10`
        );
        suggestionsToFix.splice(10);
      }

      const results = [];
      for (const suggestion of suggestionsToFix) {
        if (suggestion.autoFixable && suggestion.fixCommand) {
          try {
            // Security: The executeAutoFix method in VisionBrowserDebugger handles command whitelisting
            console.log(
              `🔒 Executing auto-fix for suggestion: ${suggestion.id} with command: ${suggestion.fixCommand}`
            );
            await visionDebugger.executeAutoFix(suggestion);
            results.push({
              suggestionId: suggestion.id,
              success: true,
              message: `Applied fix: ${suggestion.solution}`,
            });
            console.log(`🔒 Auto-fix successful for suggestion: ${suggestion.id}`);
          } catch (error) {
            console.log(`🔒 Auto-fix failed for suggestion: ${suggestion.id} - ${error}`);
            results.push({
              suggestionId: suggestion.id,
              success: false,
              error: `Failed to apply fix: ${error}`,
            });
          }
        } else {
          results.push({
            suggestionId: suggestion.id,
            success: false,
            error: 'Suggestion is not auto-fixable',
          });
        }
      }

      console.log(
        `🔒 Auto-fix completed: ${results.filter((r) => r.success).length} successful, ${results.filter((r) => !r.success).length} failed`
      );

      return res.json({
        success: true,
        data: results,
        meta: {
          totalAttempted: suggestionsToFix.length,
          successful: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      });
    } catch (error) {
      console.log(
        `🔒 Vision debug auto-fix error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return res.status(500).json({
        success: false,
        error: 'Failed to apply auto-fixes',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Security: Validate filename to prevent path traversal attacks
 */
function validateFilename(filename: string): boolean {
  // Reject any filename containing path traversal sequences
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }
  // Only allow alphanumeric, dash, underscore, dot, and common image extensions
  if (!/^[a-zA-Z0-9\-_.]+\.(png|jpg|jpeg)$/i.test(filename)) {
    return false;
  }
  // Reasonable length limit
  if (filename.length > 255) {
    return false;
  }
  return true;
}

/**
 * @route GET /api/v1/vision-debug/screenshots
 * @desc List available screenshots
 * @access Public
 */
router.get('/screenshots', (req: Request, res: Response) => {
  try {
    const screenshotsPath = 'logs/screenshots';

    if (!fs.existsSync(screenshotsPath)) {
      return res.json({
        success: true,
        data: [],
        meta: { count: 0 },
      });
    }

    const files = fs
      .readdirSync(screenshotsPath)
      .filter((file) => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
      .filter((file) => validateFilename(file)) // Security: Validate filename to prevent path traversal
      .map((file) => {
        // Security: Use path.resolve to get absolute path and prevent traversal
        const filePath = path.resolve(screenshotsPath, file);

        // Security: Verify the resolved path is still within the screenshots directory
        const normalizedScreenshotsPath = path.resolve(screenshotsPath);
        if (!filePath.startsWith(normalizedScreenshotsPath)) {
          console.warn(`Security: Attempted path traversal blocked: ${file}`);
          return null;
        }

        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .filter(Boolean) // Remove null entries from security validation
      .sort((a, b) => {
        if (!a || !b) return 0;
        return b.created.getTime() - a.created.getTime();
      }); // Sort by newest first

    return res.json({
      success: true,
      data: files,
      meta: {
        count: files.length,
        totalSize: files.reduce((sum, file) => sum + (file ? file.size : 0), 0),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to list screenshots',
    });
  }
});

/**
 * @route DELETE /api/v1/vision-debug/cleanup
 * @desc Clean up old screenshots and analyses
 * @access Public
 */
router.delete(
  '/cleanup',
  [
    query('keepDays')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Keep days must be a positive integer'),
  ],
  (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const keepDays = parseInt(req.query.keepDays as string, 10) || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      const screenshotsPath = ALLOWED_SCREENSHOT_DIRS[0]; // Use main screenshots directory
      if (!screenshotsPath) {
        return res.status(500).json({
          success: false,
          error: 'No screenshot directory configured',
        });
      }

      let deletedCount = 0;
      let totalSize = 0;
      let skippedCount = 0;

      // Security: Validate cleanup directory
      if (
        !validatePath(screenshotsPath, {
          allowedDirectories: ALLOWED_SCREENSHOT_DIRS,
        })
      ) {
        return res.status(403).json({
          success: false,
          error: 'Invalid cleanup directory path',
        });
      }

      if (fs.existsSync(screenshotsPath)) {
        const files = fs.readdirSync(screenshotsPath);
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

        for (const file of files) {
          try {
            // Security: Validate each file before processing
            if (
              !validatePath(file, {
                maxLength: 255,
                allowedExtensions,
                additionalAllowedChars: ' -',
              })
            ) {
              console.warn(`🔒 Cleanup: Skipping invalid filename: ${file}`);
              skippedCount++;
              continue;
            }

            // Security: Create secure file path
            const filePath = createSecurePath(screenshotsPath, file);

            // Security: Verify path boundary
            if (!validatePathBoundary(filePath, ALLOWED_SCREENSHOT_DIRS)) {
              console.warn(`🔒 Cleanup: Skipping file outside boundary: ${file}`);
              skippedCount++;
              continue;
            }

            // Security: Validate file properties
            if (
              !validateFile(filePath, {
                allowedExtensions,
                allowedDirectories: ALLOWED_SCREENSHOT_DIRS,
                mustExist: true,
              })
            ) {
              console.warn(`🔒 Cleanup: Skipping invalid file: ${file}`);
              skippedCount++;
              continue;
            }

            const stats = fs.statSync(filePath);

            if (stats.birthtime < cutoffDate) {
              totalSize += stats.size;
              if (safeUnlink(filePath, ALLOWED_SCREENSHOT_DIRS)) {
                deletedCount++;
                console.log(`🔒 Cleanup: Deleted old screenshot: ${file}`);
              }
            }
          } catch (error) {
            console.warn(`🔒 Cleanup: Error processing ${file}: ${error}`);
            skippedCount++;
          }
        }
      }

      return res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old screenshots`,
        meta: {
          deletedCount,
          skippedCount,
          freedSpace: totalSize,
          keepDays,
          cutoffDate,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cleanup screenshots',
      });
    }
  }
);

/**
 * @route GET /api/v1/vision-debug/health
 * @desc Health check for vision debugging service
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const status = visionDebugger.getStatus() as any;
    const isHealthy = status.isRunning;

    return res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      data: {
        isRunning: status.isRunning,
        lastAnalysis: status.lastAnalysis,
        visionServiceUrl: status.visionServiceUrl,
        screenshotsPath: status.screenshotsPath,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Vision debugger health check failed',
    });
  }
});

export default router;
