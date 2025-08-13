import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';
export declare const metricsRegistry: client.Registry;
export declare function metricsMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
export declare function getMetricsText(): Promise<string>;
export default metricsMiddleware;
//# sourceMappingURL=metrics.d.ts.map