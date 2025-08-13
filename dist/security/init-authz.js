export async function wireCasbin(app) {
    try {
        const { createCasbinEnforcer, casbinMiddleware } = await import('./casbin');
        const enforcer = await createCasbinEnforcer();
        if (enforcer) {
            app.use(casbinMiddleware(enforcer));
        }
    }
    catch {
    }
}
//# sourceMappingURL=init-authz.js.map