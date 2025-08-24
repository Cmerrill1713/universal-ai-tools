import { Router } from 'express';

const router = Router();

// Autonomous actions endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'autonomous-actions' });
});

// Autonomous action management
router.get('/list', (req, res) => {
  res.status(501).json({ 
    error: 'Autonomous actions listing not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/agents/actions/' 
  });
});

router.post('/execute', (req, res) => {
  res.status(501).json({ 
    error: 'Autonomous action execution not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/agents/actions/' 
  });
});

export default router;
