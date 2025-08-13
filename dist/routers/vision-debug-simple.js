import express from 'express';
import { VisionBrowserDebugger } from '../services/vision-browser-debugger';
const router = express.Router();
let visionDebugger;
try {
    visionDebugger = new VisionBrowserDebugger();
    visionDebugger.start().catch(console.error);
}
catch (error) {
    console.error('Failed to initialize VisionBrowserDebugger:', error);
}
router.get('/health', (req, res) => {
    try {
        const status = visionDebugger ? visionDebugger.getStatus() : null;
        res.json({
            success: true,
            status: 'healthy',
            service: 'vision-debug',
            timestamp: new Date().toISOString(),
            debugger: status
                ? {
                    isRunning: status.isRunning,
                    totalAnalyses: status.totalAnalyses,
                    visionServiceUrl: status.visionServiceUrl,
                    lastAnalysis: status.lastAnalysis,
                }
                : {
                    isRunning: false,
                    error: 'VisionBrowserDebugger not initialized',
                },
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            error: 'Vision debugger health check failed',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/status', (req, res) => {
    try {
        if (!visionDebugger) {
            return res.status(503).json({
                success: false,
                error: 'VisionBrowserDebugger not available',
            });
        }
        const status = visionDebugger.getStatus();
        return res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to get vision debugger status',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.get('/analyses', (req, res) => {
    try {
        if (!visionDebugger) {
            return res.status(503).json({
                success: false,
                error: 'VisionBrowserDebugger not available',
            });
        }
        const count = parseInt(req.query.count, 10) || 10;
        const analyses = visionDebugger.getRecentAnalyses(count);
        return res.json({
            success: true,
            data: {
                analyses,
                count: analyses.length,
                requested: count,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to get analysis results',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/capture-now', async (req, res) => {
    try {
        if (!visionDebugger) {
            return res.status(503).json({
                success: false,
                error: 'VisionBrowserDebugger not available',
            });
        }
        await visionDebugger.captureAndAnalyzeBrowser();
        return res.json({
            success: true,
            message: 'Screenshot capture and analysis triggered',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to capture and analyze screenshot',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/start', async (req, res) => {
    try {
        if (!visionDebugger) {
            visionDebugger = new VisionBrowserDebugger();
        }
        await visionDebugger.start();
        res.json({
            success: true,
            message: 'Vision debugger started',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to start vision debugger',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
router.post('/stop', (req, res) => {
    try {
        if (visionDebugger) {
            visionDebugger.stop();
        }
        res.json({
            success: true,
            message: 'Vision debugger stopped',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to stop vision debugger',
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
export default router;
//# sourceMappingURL=vision-debug-simple.js.map