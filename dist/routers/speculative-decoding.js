import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '@/middleware/auth';
import { speculativeDecodingService } from '@/services/speculative-decoding-service';
import { log, LogContext } from '@/utils/logger';
const router = Router();
router.get('/status', authenticate, async (req, res) => {
    try {
        const status = await speculativeDecodingService.getStatus();
        res.json({
            success: true,
            data: status,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get speculative decoding status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get status',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/generate', authenticate, async (req, res) => {
    try {
        const { prompt, config } = req.body;
        const result = await speculativeDecodingService.generate({
            prompt,
            ...config
        });
        res.json({
            success: true,
            data: result,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to generate with speculative decoding', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to generate',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/performance', authenticate, async (req, res) => {
    try {
        const metrics = await speculativeDecodingService.getPerformanceMetrics();
        res.json({
            success: true,
            data: metrics,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get performance metrics', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get metrics',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/optimize', authenticate, async (req, res) => {
    try {
        const { draftModelId, targetModelId } = req.body;
        if (!draftModelId || !targetModelId) {
            return res.status(400).json({
                success: false,
                error: 'Both draftModelId and targetModelId are required',
                metadata: { requestId: uuidv4() }
            });
        }
        const optimization = await speculativeDecodingService.optimizeModel(draftModelId, targetModelId);
        return res.json({
            success: true,
            data: optimization,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to optimize model', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to optimize',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/pairs', authenticate, async (req, res) => {
    try {
        const pairs = await speculativeDecodingService.getModelPairs();
        res.json({
            success: true,
            data: pairs,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get model pairs', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get pairs',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/benchmark', authenticate, async (req, res) => {
    try {
        const { draftModel, targetModel, prompts } = req.body;
        if (!draftModel || !targetModel) {
            return res.status(400).json({
                success: false,
                error: 'Both draftModel and targetModel are required',
                metadata: { requestId: uuidv4() }
            });
        }
        const results = await speculativeDecodingService.benchmark(draftModel, targetModel, prompts);
        return res.json({
            success: true,
            data: results,
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to run benchmark', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to benchmark',
            metadata: { requestId: uuidv4() }
        });
    }
});
export default router;
//# sourceMappingURL=speculative-decoding.js.map