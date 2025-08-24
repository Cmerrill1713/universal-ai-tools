import { Router } from 'express';

const router = Router();

// Repository ML analysis endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'repository-ml' });
});

// Repository analysis
router.post('/analyze', (req, res) => {
  res.status(501).json({ 
    error: 'Repository ML analysis not implemented',
    migrated: true,
    redirect: 'Use Rust AI Core at /ai-core/analysis/' 
  });
});

router.get('/insights', (req, res) => {
  res.status(501).json({ 
    error: 'Repository insights not implemented',
    migrated: true,
    redirect: 'Use Rust AI Core at /ai-core/analysis/' 
  });
});

export default router;
