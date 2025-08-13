export function createCsrfProtection() {
    try {
        const csurf = require('csurf');
        const middleware = csurf({ cookie: true });
        return middleware;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=csurf.js.map