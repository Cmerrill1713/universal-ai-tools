import type { NextFunction, Request, Response } from 'express';
export declare function uploadGuard(options?: {
    maxSize?: number;
}): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export default uploadGuard;
//# sourceMappingURL=upload-guard.d.ts.map