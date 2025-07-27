import { Request } from 'express';
declare global {;
  namespace Express {;
    interface Request {;
      api.Version?: string;
      user?: {;
        id: string,;
        email?: string;
        name?: string;
}      start.Time?: number;
      request.Id?: string;
      context?: Record<string, unknown>}};

export {;