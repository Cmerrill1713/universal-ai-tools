let Sentry: any = null;
let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // optional

  try {
    // Lazy-load; if dependency missing, skip
     
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      _experiments: { enableLogs: true } as any,
    });
    initialized = true;
  } catch {
    Sentry = null;
  }
}

export { Sentry };
