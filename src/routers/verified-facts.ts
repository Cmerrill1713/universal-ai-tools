import { Router } from 'express';
import { verifiedFactsService } from '@/services/verified-facts-service';

const router = Router();

router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    if (!q) return res.json({ success: true, data: [] });
    const fact = await verifiedFactsService.findFact(q);
    return res.json({ success: true, data: fact ? [fact] : [] });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: String((error as Error).message || error) });
  }
});

router.post('/', async (req, res) => {
  try {
    const { question, answer, citations = [] } = req.body || {};
    if (!question || !answer)
      return res.status(400).json({ success: false, error: 'Missing fields' });
    const id = await verifiedFactsService.upsertFact({ question, answer, citations });
    return res.json({ success: true, id });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: String((error as Error).message || error) });
  }
});

export default router;
