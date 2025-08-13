import express from 'express';
import * as fs from 'fs';
import multer from 'multer';
import * as path from 'path';
import { z } from 'zod';
import { zodValidate } from '@/middleware/zod-validate';
import { VisionBrowserDebugger } from '../services/vision-browser-debugger';
import { createSecurePath, safeUnlink, sanitizeFilename, validateFile, validatePath, validatePathBoundary, } from '../utils/path-security';
const router = express.Router();
const ALLOWED_SCREENSHOT_DIRS = [
    path.resolve(process.cwd(), 'logs/screenshots'),
    path.resolve(process.cwd(), 'logs/screenshots/uploads'),
];
ALLOWED_SCREENSHOT_DIRS.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }
});
const upload = multer({
    dest: ALLOWED_SCREENSHOT_DIRS[1],
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
        fieldSize: 1024,
    },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'), false);
        }
        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
        if (!validatePath(file.originalname, {
            maxLength: 255,
            allowedExtensions,
            additionalAllowedChars: ' ',
        })) {
            return cb(new Error('Invalid filename'), false);
        }
        file.originalname = sanitizeFilename(file.originalname, {
            maxLength: 200,
            allowedExtensions,
        });
        cb(null, true);
    },
});
const visionDebugger = new VisionBrowserDebugger();
router.get('/status', (req, res) => {
    try {
        const status = visionDebugger.getStatus();
        return res.json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to get vision debugger status',
        });
    }
});
router.post('/start', async (req, res) => {
    try {
        await visionDebugger.start();
        return res.json({
            success: true,
            message: 'Vision debugger started successfully',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to start vision debugger',
        });
    }
});
router.post('/stop', (req, res) => {
    try {
        visionDebugger.stop();
        return res.json({
            success: true,
            message: 'Vision debugger stopped successfully',
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to stop vision debugger',
        });
    }
});
router.post('/analyze-screenshot', upload.single('screenshot'), zodValidate(z.object({
    prompt: z.string().optional(),
    focus: z.enum(['console', 'network', 'performance', 'ui', 'all']).optional(),
})), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No screenshot file provided',
            });
        }
        const { prompt, focus = 'all' } = req.body;
        const screenshotPath = req.file.path;
        if (!validatePathBoundary(screenshotPath, ALLOWED_SCREENSHOT_DIRS)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid upload path',
            });
        }
        const analysis = await visionDebugger.analyzeScreenshot(screenshotPath);
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to analyze screenshot',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/recent-analyses', zodValidate(z.object({ count: z.coerce.number().int().min(1).max(50).optional() })), (req, res) => {
    try {
        const count = parseInt(req.query.count, 10) || 10;
        const recentAnalyses = visionDebugger.getRecentAnalyses(count);
        return res.json({
            success: true,
            data: recentAnalyses,
            meta: {
                count: recentAnalyses.length,
                totalAnalyses: visionDebugger.getStatus().totalAnalyses,
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to get recent analyses',
        });
    }
});
router.post('/capture-now', async (req, res) => {
    try {
        await visionDebugger.captureAndAnalyzeBrowser();
        return res.json({
            success: true,
            message: 'Screenshot captured and analyzed',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to capture screenshot',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/auto-fix', zodValidate(z.object({
    analysisId: z
        .string()
        .min(1)
        .max(100)
        .regex(/^analysis-\d+-[\w\-]+$/, 'Invalid analysis ID format'),
    suggestionIds: z.array(z.string().min(1).max(100)).max(10).optional(),
})), async (req, res) => {
    try {
        const { analysisId, suggestionIds } = req.body;
        console.log(`🔒 Auto-fix attempt for analysis: ${analysisId}, suggestions: ${suggestionIds ? suggestionIds.join(',') : 'all-auto-fixable'}`);
        const recentAnalyses = visionDebugger.getRecentAnalyses(50);
        const analysis = recentAnalyses.find((a) => a.id === analysisId);
        if (!analysis) {
            console.log(`🔒 Analysis not found for auto-fix: ${analysisId}`);
            return res.status(404).json({
                success: false,
                error: 'Analysis not found',
            });
        }
        const suggestionsToFix = suggestionIds
            ? analysis.suggestions.filter((s) => suggestionIds.includes(s.id))
            : analysis.suggestions.filter((s) => s.autoFixable);
        if (suggestionsToFix.length > 10) {
            console.log(`🔒 Too many suggestions for auto-fix (${suggestionsToFix.length}), limiting to 10`);
            suggestionsToFix.splice(10);
        }
        const results = [];
        for (const suggestion of suggestionsToFix) {
            if (suggestion.autoFixable && suggestion.fixCommand) {
                try {
                    console.log(`🔒 Executing auto-fix for suggestion: ${suggestion.id} with command: ${suggestion.fixCommand}`);
                    await visionDebugger.executeAutoFix(suggestion);
                    results.push({
                        suggestionId: suggestion.id,
                        success: true,
                        message: `Applied fix: ${suggestion.solution}`,
                    });
                    console.log(`🔒 Auto-fix successful for suggestion: ${suggestion.id}`);
                }
                catch (error) {
                    console.log(`🔒 Auto-fix failed for suggestion: ${suggestion.id} - ${error}`);
                    results.push({
                        suggestionId: suggestion.id,
                        success: false,
                        error: `Failed to apply fix: ${error}`,
                    });
                }
            }
            else {
                results.push({
                    suggestionId: suggestion.id,
                    success: false,
                    error: 'Suggestion is not auto-fixable',
                });
            }
        }
        console.log(`🔒 Auto-fix completed: ${results.filter((r) => r.success).length} successful, ${results.filter((r) => !r.success).length} failed`);
        return res.json({
            success: true,
            data: results,
            meta: {
                totalAttempted: suggestionsToFix.length,
                successful: results.filter((r) => r.success).length,
                failed: results.filter((r) => !r.success).length,
            },
        });
    }
    catch (error) {
        console.log(`🔒 Vision debug auto-fix error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return res.status(500).json({
            success: false,
            error: 'Failed to apply auto-fixes',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
function validateFilename(filename) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return false;
    }
    if (!/^[a-zA-Z0-9\-_.]+\.(png|jpg|jpeg)$/i.test(filename)) {
        return false;
    }
    if (filename.length > 255) {
        return false;
    }
    return true;
}
router.get('/screenshots', (req, res) => {
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
            .filter((file) => validateFilename(file))
            .map((file) => {
            const filePath = path.resolve(screenshotsPath, file);
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
            .filter(Boolean)
            .sort((a, b) => {
            if (!a || !b)
                return 0;
            return b.created.getTime() - a.created.getTime();
        });
        return res.json({
            success: true,
            data: files,
            meta: {
                count: files.length,
                totalSize: files.reduce((sum, file) => sum + (file ? file.size : 0), 0),
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to list screenshots',
        });
    }
});
router.delete('/cleanup', zodValidate(z.object({ keepDays: z.coerce.number().int().min(1).optional() })), (req, res) => {
    try {
        const keepDays = parseInt(req.query.keepDays, 10) || 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - keepDays);
        const screenshotsPath = ALLOWED_SCREENSHOT_DIRS[0];
        if (!screenshotsPath) {
            return res.status(500).json({
                success: false,
                error: 'No screenshot directory configured',
            });
        }
        let deletedCount = 0;
        let totalSize = 0;
        let skippedCount = 0;
        if (!validatePath(screenshotsPath, {
            allowedDirectories: ALLOWED_SCREENSHOT_DIRS,
        })) {
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
                    if (!validatePath(file, {
                        maxLength: 255,
                        allowedExtensions,
                        additionalAllowedChars: ' -',
                    })) {
                        console.warn(`🔒 Cleanup: Skipping invalid filename: ${file}`);
                        skippedCount++;
                        continue;
                    }
                    const filePath = createSecurePath(screenshotsPath, file);
                    if (!validatePathBoundary(filePath, ALLOWED_SCREENSHOT_DIRS)) {
                        console.warn(`🔒 Cleanup: Skipping file outside boundary: ${file}`);
                        skippedCount++;
                        continue;
                    }
                    if (!validateFile(filePath, {
                        allowedExtensions,
                        allowedDirectories: ALLOWED_SCREENSHOT_DIRS,
                        mustExist: true,
                    })) {
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
                }
                catch (error) {
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to cleanup screenshots',
        });
    }
});
router.get('/health', (req, res) => {
    try {
        const status = visionDebugger.getStatus();
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
    }
    catch (error) {
        return res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: 'Vision debugger health check failed',
        });
    }
});
export default router;
//# sourceMappingURL=vision-debug.js.map