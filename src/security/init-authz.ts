import type { Application } from 'express';

export async function wireCasbin(app: Application): Promise<void> {
  try {
    const { createCasbinEnforcer, casbinMiddleware } = await import('./casbin');
    const enforcer = await createCasbinEnforcer();
    if (enforcer) {
      app.use(casbinMiddleware(enforcer));
    }
  } catch {
    // Casbin optional; skip if not installed
  }
}
