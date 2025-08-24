import { Router } from 'express';

const router = Router();

// Xcode Vision integration endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'xcode-vision' });
});

// Xcode Vision analysis
router.post('/analyze', (req, res) => {
  res.status(501).json({ 
    error: 'Xcode Vision analysis not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/vision/' 
  });
});

router.get('/capabilities', (req, res) => {
  res.json({
    capabilities: ['UI element detection', 'Code structure analysis', 'Layout optimization'],
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/vision/' 
  });
});

export default router;
