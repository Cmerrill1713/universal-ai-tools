import { Router } from 'express';

const router = Router();

// Verified facts management endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'verified-facts' });
});

// Facts management
router.get('/list', (req, res) => {
  res.status(501).json({ 
    error: 'Verified facts listing not implemented',
    migrated: true,
    redirect: 'Use Rust AI Core at /ai-core/knowledge/' 
  });
});

router.post('/verify', (req, res) => {
  res.status(501).json({ 
    error: 'Fact verification not implemented',
    migrated: true,
    redirect: 'Use Rust AI Core at /ai-core/knowledge/' 
  });
});

export default router;
