import { Router } from 'express';

const router = Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Vision router is working!' });
});

export default router;
