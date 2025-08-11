// Optional: only load Sentry if package and DSN are available
let Sentry: any = null;
try {
   
  Sentry = require('@sentry/node');
} catch {
  Sentry = null;
}
import type express from 'express';

type InitOptions = {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
};

let initialized = false;

export function init(options: InitOptions = {}): void {
  if (initialized) return;

  const dsn = options.dsn ?? process.env.SENTRY_DSN;
  const environment = options.environment ?? process.env.NODE_ENV ?? 'development';
  const tracesSampleRate =
    options.tracesSampleRate ?? Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.2);

  if (!dsn || !Sentry) {
    // No DSN configured; skip initialization silently
    return;
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate,
  });

  initialized = true;
}

export function instrumentExpress(app: express.Application): void {
  if (!initialized || !Sentry) return;

  // Must be the first middleware on the app
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

export function errorHandler(): express.ErrorRequestHandler | undefined {
  if (!initialized || !Sentry) return undefined;
  return Sentry.Handlers.errorHandler();
}

export { Sentry };
