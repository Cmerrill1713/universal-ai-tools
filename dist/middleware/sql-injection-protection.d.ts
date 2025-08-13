import type { NextFunction, Request, Response } from 'express';
export declare function sqlInjectionProtection(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export default sqlInjectionProtection;
//# sourceMappingURL=sql-injection-protection.d.ts.map