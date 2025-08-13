import type { NextFunction, Request, Response } from 'express';
export declare function createCasbinEnforcer(): Promise<any>;
export declare function casbinMiddleware(enforcer: any): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=casbin.d.ts.map