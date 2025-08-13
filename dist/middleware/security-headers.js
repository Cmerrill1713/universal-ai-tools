export function securityHeadersMiddleware() {
    return (_req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '0');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        next();
    };
}
export default securityHeadersMiddleware;
//# sourceMappingURL=security-headers.js.map