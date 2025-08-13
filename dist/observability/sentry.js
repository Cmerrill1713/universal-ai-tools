let Sentry = null;
let initialized = false;
export function initSentry() {
    if (initialized)
        return;
    const dsn = process.env.SENTRY_DSN;
    if (!dsn)
        return;
    try {
        Sentry = require('@sentry/node');
        Sentry.init({
            dsn,
            tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
            _experiments: { enableLogs: true },
        });
        initialized = true;
    }
    catch {
        Sentry = null;
    }
}
export { Sentry };
//# sourceMappingURL=sentry.js.map