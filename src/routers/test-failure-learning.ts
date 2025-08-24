import { Router } from 'express';
import { testFailureLearningService } from '../middleware/test-failure-learning';

const router = Router();

// Test failure learning endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'test-failure-learning' });
});

// Learning insights
router.get('/insights', (req, res) => {
  try {
    const insights = testFailureLearningService.getLearningInsights();
    res.json(insights);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get learning insights',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Failure patterns
router.get('/patterns', (req, res) => {
  try {
    const insights = testFailureLearningService.getLearningInsights();
    res.json({ patterns: insights.topPatterns });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get failure patterns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Record failure
router.post('/failures', (req, res) => {
  try {
    const { testName, error, stackTrace, context } = req.body;
    testFailureLearningService.recordFailure({
      testName: testName || 'unknown',
      error: error || 'unknown error',
      stackTrace,
      context: context || {}
    });
    res.json({ success: true, message: 'Failure recorded' });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to record failure',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
