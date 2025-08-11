import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function zodValidate(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    // Replace body with parsed/typed data
    (req as any).body = result.data;
    return next();
  };
}
