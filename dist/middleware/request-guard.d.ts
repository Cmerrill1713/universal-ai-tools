import type { NextFunction, Request, Response } from 'express';
export declare function requestIdMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
export declare function enforceJsonMiddleware(): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function limitQueryMiddleware(options?: {
    maxKeys?: number;
    maxKeyLength?: number;
    maxValueLength?: number;
    maxQueryStringLength?: number;
}): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function jsonDepthGuardMiddleware(options?: {
    maxDepth?: number;
    maxKeysPerObject?: number;
    maxArrayLength?: number;
}): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=request-guard.d.ts.map