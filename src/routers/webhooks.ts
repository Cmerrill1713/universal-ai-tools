// Migration stub for webhooks router
import { Router } from 'express';

const router = Router();

router.all('*', (req, res) => {
  res.status(503).json({
    error: 'Service Migrated',
    message: 'Webhooks service has been migrated to Go API Gateway',
    migration: true,
    redirect: 'http://localhost:8080'
  });
});

export default router;