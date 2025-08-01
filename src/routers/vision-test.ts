import { Router } from 'express';
import type { Request, Response} from 'express';
import { NextFunction } from 'express';


const router = Router();

router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Vision router is working!' });
});

export default router;
