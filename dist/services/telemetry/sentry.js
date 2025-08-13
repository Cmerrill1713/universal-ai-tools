let Sentry = null;
try {
    Sentry = require('@sentry/node');
}
catch {
    Sentry = null;
}
let initialized = false;
export function init(options = {}) {
    if (initialized)
        return;
    const dsn = options.dsn ?? process.env.SENTRY_DSN;
    const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
    const tracesSampleRate = options.tracesSampleRate ?? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2);
    if (!dsn || !Sentry) {
        return;
    }
    Sentry.init({
        dsn,
        environment,
        tracesSampleRate,
    });
    initialized = true;
}
export function instrumentExpress(app) {
    if (!initialized || !Sentry)
        return;
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
}
export function errorHandler() {
    if (!initialized || !Sentry)
        return undefined;
    return Sentry.Handlers.errorHandler();
}
export { Sentry };
//# sourceMappingURL=sentry.js.map