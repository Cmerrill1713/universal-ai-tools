declare let Sentry: any;
import type express from 'express';
type InitOptions = {
    dsn?: string;
    environment?: string;
    tracesSampleRate?: number;
};
export declare function init(options?: InitOptions): void;
export declare function instrumentExpress(app: express.Application): void;
export declare function errorHandler(): express.ErrorRequestHandler | undefined;
export { Sentry };
//# sourceMappingURL=sentry.d.ts.map