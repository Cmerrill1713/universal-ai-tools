import { Router } from 'express';
import { lfm2Bridge } from '@/services/lfm2-bridge';

const router = Router();

const feedbackStats = {
  total: 0,
  positive: 0,
  negative: 0,
};

router.post('/feedback', (req, res) => {
  const { verdict } = req.body || {};
  feedbackStats.total += 1;
  if (verdict === 'up') feedbackStats.positive += 1;
  else if (verdict === 'down') feedbackStats.negative += 1;
  res.json({ success: true, data: feedbackStats });
});

router.get('/summary', (req, res) => {
  const { total, positive, negative } = feedbackStats;
  res.json({ success: true, data: { total, positive, negative } });
});

router.get('/lfm2', (req, res) => {
  try {
    const metrics =
      (lfm2Bridge as any).instance?.getMetrics?.() || lfm2Bridge.getCircuitBreakerMetrics?.() || {};
    return res.json({ success: true, data: metrics });
  } catch (error) {
    return res.status(200).json({ success: true, data: { error: String(error) } });
  }
});

router.post('/lfm2/limits', (req, res) => {
  try {
    const { maxPending, timeoutMs, maxConcurrency, maxTokens, maxPromptChars } = req.body || {};
    (lfm2Bridge as any).setLimits?.({
      maxPending,
      timeoutMs,
      maxConcurrency,
      maxTokens,
      maxPromptChars,
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
