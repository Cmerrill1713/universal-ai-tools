export function ipFilterMiddleware(allowList = []) {
    const normalized = new Set(allowList.map((s) => s.trim()).filter(Boolean));
    return (req, res, next) => {
        try {
            if (normalized.size === 0)
                return next();
            const ip = req.ip || req.connection.remoteAddress || '';
            if (normalized.has(ip))
                return next();
            res.status(403).json({ success: false, error: 'Forbidden IP' });
        }
        catch {
            return next();
        }
    };
}
//# sourceMappingURL=ip-filter.js.map