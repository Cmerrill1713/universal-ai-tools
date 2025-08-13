import type { NextFunction,Request, Response } from 'express';

/**
 * Async handler wrapper for Express routes
 * Catches async errors and passes them to Express error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;