import { Router } from 'express';

const router = Router();

// Speech recognition and synthesis endpoints
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'speech' });
});

// Speech recognition migrated to Go API Gateway
router.post('/recognize', (req, res) => {
  res.status(501).json({ 
    error: 'Speech recognition not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/voice/' 
  });
});

// Text-to-speech migrated to Go API Gateway
router.post('/synthesize', (req, res) => {
  res.status(501).json({ 
    error: 'Speech synthesis not implemented',
    migrated: true,
    redirect: 'Use Go API Gateway at /api/v1/voice/' 
  });
});

export default router;
