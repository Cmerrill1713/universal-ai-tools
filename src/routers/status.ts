import { Router } from 'express';

const router = Router();

// System status endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'status' });
});

// System status reporting
router.get('/overview', (req, res) => {
  res.status(501).json({ 
    error: 'Status overview not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/health/' 
  });
});

router.get('/services', (req, res) => {
  res.status(501).json({ 
    error: 'Service status not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/health/services/' 
  });
});

export default router;
