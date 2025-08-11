import type { NextFunction, Request, Response } from 'express';

// Minimal Casbin scaffolding with lazy import
export async function createCasbinEnforcer() {
  try {
    const { newEnforcer, newModel } = await import('casbin');
    const modelText = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
`;
    const model = newModel(modelText);

    const e = await newEnforcer(model);
    await e.addPolicy('admin', '/api/*', 'WRITE');
    await e.addPolicy('user', '/api/*', 'READ');
    await e.addGroupingPolicy('admin_user', 'admin');
    return e;
  } catch (err) {
    return null;
  }
}

export function casbinMiddleware(enforcer: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!enforcer) return next();
    try {
      const subject = (req as any).user?.role || 'anonymous';
      const object = req.path.startsWith('/api') ? '/api/*' : req.path;
      const action = req.method === 'GET' ? 'READ' : 'WRITE';
      const allowed = await enforcer.enforce(subject, object, action);
      if (!allowed) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
      return next();
    } catch {
      return res.status(500).json({ success: false, error: 'AUTHZ_ERROR' });
    }
  };
}



