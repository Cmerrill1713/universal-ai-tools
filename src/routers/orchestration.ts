import express from 'express';
import { z } from 'zod';

import { dspyService } from '@/services/dspy-service';
import { log, LogContext } from '@/utils/logger';

const router = express.Router();

router.get('/status', async (_req, res) => {
  try {
    const s = await dspyService.status();
    return res.json({ success: true, data: s });
  } catch (error) {
    log.warn('DSPy status fallback', LogContext.DSPY, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.json({ success: true, data: { ready: false, note: 'DSPy not connected' } });
  }
});

router.post('/orchestrate', async (req, res) => {
  const schema = z.object({
    userRequest: z.string().min(1),
    userId: z.string().optional(),
    context: z.record(z.any()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });
  try {
    const result = await dspyService.orchestrate(parsed.data);
    return res.json({ success: true, data: result });
  } catch (error) {
    log.error('Orchestrate failed', LogContext.DSPY, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Orchestration failed' });
  }
});

router.post('/optimize/prompts', async (req, res) => {
  const schema = z.object({ examples: z.array(z.record(z.any())).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });
  try {
    const result = await dspyService.optimizePrompts(parsed.data.examples);
    return res.json({ success: true, data: result });
  } catch (error) {
    log.error('MIPROv2 optimize failed', LogContext.DSPY, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Optimization failed' });
  }
});

router.post('/knowledge', async (req, res) => {
  const schema = z.object({ operation: z.string().min(1), payload: z.record(z.any()).default({}) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });
  try {
    const result = await dspyService.manageKnowledge(parsed.data.operation, parsed.data.payload);
    return res.json({ success: true, data: result });
  } catch (error) {
    log.error('MIPROv2 knowledge op failed', LogContext.DSPY, {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, error: 'Knowledge operation failed' });
  }
});

export default router;
