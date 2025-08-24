import { Router } from 'express';

const router = Router();

// Framework inventory endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'framework-inventory' });
});

// Framework management
router.get('/list', (req, res) => {
  const page = parseInt((req.query.page as string) || '1');
  const limit = parseInt((req.query.limit as string) || '10');
  const category = req.query.category as string || '';
  
  res.json({
    frameworks: [
      { name: 'Express.js', category: 'web', language: 'JavaScript' },
      { name: 'SwiftUI', category: 'ui', language: 'Swift' },
      { name: 'Actix Web', category: 'web', language: 'Rust' },
      { name: 'Gin', category: 'web', language: 'Go' }
    ],
    pagination: { page, limit, total: 4 },
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/frameworks/' 
  });
});

router.post('/add', (req, res) => {
  res.status(501).json({ 
    error: 'Framework addition not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/frameworks/' 
  });
});

export default router;
