import { Router } from 'express';

const router = Router();

// System metrics endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'metrics' });
});

// Metrics collection and reporting
router.get('/system', (req, res) => {
  res.status(501).json({ 
    error: 'System metrics not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/health/' 
  });
});

router.get('/performance', (req, res) => {
  res.status(501).json({ 
    error: 'Performance metrics not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/health/' 
  });
});

export default router;
