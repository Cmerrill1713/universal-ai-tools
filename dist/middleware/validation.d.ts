import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';
export declare const validateRequest: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateQuery: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateParams: (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => void;
export default validateRequest;
//# sourceMappingURL=validation.d.ts.map