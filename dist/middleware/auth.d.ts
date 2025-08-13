import type { NextFunction, Request, Response } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email?: string;
                isAdmin?: boolean;
                permissions?: string[];
                deviceId?: string;
                deviceType?: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
                trusted?: boolean;
            };
        }
    }
}
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const authenticateRequest: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export default authenticate;
//# sourceMappingURL=auth.d.ts.map