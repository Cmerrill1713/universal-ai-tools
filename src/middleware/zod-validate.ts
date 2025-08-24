import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

export function zodValidate(schema: ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
    }
    // Replace body with parsed/typed data
    (req as any).body = result.data;
    return next();
  };
}

export function validateRequest(schemas: { body?: ZodSchema<any>; query?: ZodSchema<any>; params?: ZodSchema<any> }) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate body if schema provided
    if (schemas.body) {
      const bodyResult = schemas.body.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Body validation failed',
            details: bodyResult.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        });
      }
      (req as any).body = bodyResult.data;
    }

    // Validate query if schema provided
    if (schemas.query) {
      const queryResult = schemas.query.safeParse(req.query);
      if (!queryResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Query validation failed',
            details: queryResult.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        });
      }
      (req as any).query = queryResult.data;
    }

    // Validate params if schema provided
    if (schemas.params) {
      const paramsResult = schemas.params.safeParse(req.params);
      if (!paramsResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Params validation failed',
            details: paramsResult.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          },
        });
      }
      (req as any).params = paramsResult.data;
    }

    return next();
  };
}
