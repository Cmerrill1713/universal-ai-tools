import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
      user?: {
        id: string;
        email?: string;
        name?: string;
      };
      startTime?: number;
      requestId?: string;
      context?: Record<string, any>;
    }
  }
}

export {};