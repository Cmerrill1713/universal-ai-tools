import { Router } from 'express';

const router = Router();

// External API integration endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'external-apis' });
});

// External API management
router.get('/list', (req, res) => {
  res.status(501).json({ 
    error: 'External API listing not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/integrations/' 
  });
});

router.post('/register', (req, res) => {
  res.status(501).json({ 
    error: 'External API registration not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/integrations/' 
  });
});

export default router;
