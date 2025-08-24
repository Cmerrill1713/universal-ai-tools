import { Router } from 'express';

const router = Router();

// Database health endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'database-health' });
});

// Database health monitoring
router.get('/check', (req, res) => {
  res.status(501).json({ 
    error: 'Database health check not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/health/database/' 
  });
});

router.get('/metrics', (req, res) => {
  res.status(501).json({ 
    error: 'Database metrics not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/health/database/' 
  });
});

export default router;
