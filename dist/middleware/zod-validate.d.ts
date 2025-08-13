import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
export declare function zodValidate(schema: ZodSchema<any>): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=zod-validate.d.ts.map