// Migration stub for parameters router
import { Router } from 'express';

const router = Router();

router.all('*', (req, res) => {
  res.status(503).json({
    error: 'Service Migrated',
    message: 'Parameters service has been migrated to Rust AI Core',
    migration: true,
    redirect: 'http://localhost:8083'
  });
});

export default router;