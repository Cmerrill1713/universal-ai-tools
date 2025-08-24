// Migration stub for context router
import { Router } from 'express';

const router = Router();

router.all('*', (req, res) => {
  res.status(503).json({
    error: 'Service Migrated',
    message: 'Context service has been migrated to Go API Gateway',
    migration: true,
    redirect: 'http://localhost:8082/api/context'
  });
});

export default router;