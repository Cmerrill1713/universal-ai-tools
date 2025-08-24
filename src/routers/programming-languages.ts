import { Router } from 'express';

const router = Router();

// Programming language support endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'programming-languages' });
});

// Language support
router.get('/supported', (req, res) => {
  res.json({
    languages: ['TypeScript', 'JavaScript', 'Python', 'Swift', 'Rust', 'Go'],
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/languages/' 
  });
});

router.post('/analyze', (req, res) => {
  res.status(501).json({ 
    error: 'Language analysis not implemented',
    migrated: true,
    redirect: 'Use Rust AI Core at /ai-core/languages/' 
  });
});

export default router;
