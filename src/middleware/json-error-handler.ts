import { Request, Response, NextFunction } from 'express';

export const jsonErrorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // Migration stub - error handling moved to Go API Gateway
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON',
      migration: true,
      redirect: 'http://localhost:8082'
    });
    return;
  }
  
  next(err);
};

export default jsonErrorHandler;