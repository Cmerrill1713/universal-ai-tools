import { log, LogContext } from './utils/logger.js';
async function setAutoFlags() {
    try {
        const dns = await import('node:dns/promises');
        const hasInternet = await dns.lookup('www.google.com').then(() => true, () => false);
        let hfOk = false;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const res = await globalThis.fetch('https://huggingface.co', {
                signal: controller.signal,
            });
            clearTimeout(timeout);
            hfOk = !!res && res.ok;
        }
        catch {
            hfOk = false;
        }
        if (!process.env.OFFLINE_MODE) {
            process.env.OFFLINE_MODE = (!hasInternet).toString();
        }
        if (!process.env.DISABLE_EXTERNAL_CALLS) {
            process.env.DISABLE_EXTERNAL_CALLS = (!hfOk || !hasInternet).toString();
        }
        if (!process.env.ENABLE_GRAPHQL && process.env.NODE_ENV !== 'production') {
            process.env.ENABLE_GRAPHQL = 'true';
        }
    }
    catch {
    }
}
async function loadVaultSentryDsn() {
    if (process.env.SENTRY_DSN)
        return;
    try {
        const { secretsManager } = await import('./services/secrets-manager');
        const dsn = await secretsManager.getSecret('sentry_dsn');
        if (dsn) {
            process.env.SENTRY_DSN = dsn;
        }
    }
    catch {
    }
}
async function main() {
    try {
        await import('./telemetry/otel.js');
    }
    catch { }
    await setAutoFlags();
    await loadVaultSentryDsn();
    try {
        const { initSentry } = await import('./observability/sentry.js');
        initSentry();
    }
    catch { }
    const { default: UniversalAIToolsServer } = await import('./server.js');
    const server = new UniversalAIToolsServer();
    await server.start();
    if (process.env.ENABLE_OPENAPI === 'true') {
        try {
            const { wireOpenAPIDocs } = await import('./api/openapi.js');
            await wireOpenAPIDocs(server.getApp());
        }
        catch { }
    }
    if (process.env.ENABLE_GRAPHQL === 'true') {
        try {
            const { mountGraphQL } = await import('./graphql/server.js');
            await mountGraphQL(server.getApp());
            log.info('✅ GraphQL server mounted at /graphql', LogContext.API);
        }
        catch (error) {
            log.warn('⚠️ GraphQL server not mounted', LogContext.API, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
main().catch((error) => {
    import('./utils/logger.js').then(({ log, LogContext }) => {
        log.error('❌ Server bootstrap failed', LogContext.SERVER, {
            error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
    });
});
//# sourceMappingURL=server-bootstrap.js.map