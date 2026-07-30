import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
  });
}
