import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '@/middleware/auth';
import { environmentalAwarenessService } from '@/services/environmental-awareness-service';
import { log, LogContext } from '@/utils/logger';
const router = Router();
router.get('/status', authenticate, async (req, res) => {
    try {
        const status = await environmentalAwarenessService.getStatus();
        res.json({
            success: true,
            data: status,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get environmental status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get environmental status',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/context', authenticate, async (req, res) => {
    try {
        const context = await environmentalAwarenessService.getCurrentContext();
        res.json({
            success: true,
            data: context,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get environmental context', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get environmental context',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/time-context', authenticate, async (req, res) => {
    try {
        const timeContext = await environmentalAwarenessService.getTimeContext();
        res.json({
            success: true,
            data: timeContext,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get time context', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get time context',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/location', authenticate, async (req, res) => {
    try {
        const location = await environmentalAwarenessService.getLocationContext();
        res.json({
            success: true,
            data: location,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get location context', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get location context',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/device', authenticate, async (req, res) => {
    try {
        const deviceInfo = await environmentalAwarenessService.getDeviceContext();
        res.json({
            success: true,
            data: deviceInfo,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get device context', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get device context',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/activity', authenticate, async (req, res) => {
    try {
        const { activity, confidence } = req.body;
        await environmentalAwarenessService.updateActivity(activity, confidence);
        res.json({
            success: true,
            message: 'Activity updated successfully',
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to update activity', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update activity',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/recommendations', authenticate, async (req, res) => {
    try {
        const recommendations = await environmentalAwarenessService.getContextualRecommendations();
        res.json({
            success: true,
            data: recommendations,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get recommendations', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get recommendations',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            service: 'environmental-awareness',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
        res.json({
            success: true,
            data: health,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            error: 'Service unhealthy',
            metadata: { requestId: uuidv4() }
        });
    }
});
export default router;
//# sourceMappingURL=environmental-awareness.js.map