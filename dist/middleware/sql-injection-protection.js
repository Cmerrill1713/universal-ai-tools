const SUSPICIOUS_PATTERN = /(;|--|\/\*|\*\/|\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bALTER\b)/i;
function containsSuspicious(input) {
    if (typeof input === 'string') {
        if (input.length <= 2)
            return false;
        return SUSPICIOUS_PATTERN.test(input);
    }
    if (Array.isArray(input)) {
        return input.some((v) => containsSuspicious(v));
    }
    if (input && typeof input === 'object') {
        for (const value of Object.values(input)) {
            if (containsSuspicious(value))
                return true;
        }
    }
    return false;
}
export function sqlInjectionProtection() {
    return function sqlInjectionProtectionMiddleware(req, res, next) {
        try {
            if (containsSuspicious(req.originalUrl) ||
                containsSuspicious(req.path) ||
                containsSuspicious(req.params) ||
                containsSuspicious(req.query)) {
                res.setHeader('X-Security-Event', 'sql-injection-detected');
                return res.status(400).json({ success: false, error: 'Invalid request' });
            }
        }
        catch {
        }
        return next();
    };
}
export default sqlInjectionProtection;
//# sourceMappingURL=sql-injection-protection.js.map