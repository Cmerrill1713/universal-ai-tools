# Security Headers Configuration Guide
This guide documents the security headers and CORS configuration implemented in the Universal AI Tools platform.
## Overview
The security middleware provides environment-aware configuration that enforces strict security policies in production while allowing flexibility during development.
## Environment-Aware Configuration
### Development Mode

- Allows localhost origins for CORS

- Permits `unsafe-inline` and `unsafe-eval` in CSP for easier development

- Relaxed cache control headers

- HTTPS enforcement disabled
### Production Mode

- Strict CORS policy with explicitly configured origins only

- Secure CSP without unsafe directives

- Enhanced security headers

- HTTPS enforcement enabled

- Comprehensive cache control
## Security Headers
### Content Security Policy (CSP)
The CSP implementation varies by environment:

#### Production CSP

```typescript

{

  defaultSrc: ["'self'"],

  scriptSrc: ["'self'"], // No unsafe-inline or unsafe-eval

  styleSrc: ["'self'", "https://fonts.googleapis.com"],

  imgSrc: ["'self'", "data:", "https:", "blob:"],

  fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],

  connectSrc: [

    "'self'",

    "https://api.openai.com",

    "https://api.anthropic.com", 

    "https://*.supabase.co",

    "wss://*.supabase.co"

  ],

  objectSrc: ["'none'"],

  frameAncestors: ["'none'"],

  upgradeInsecureRequests: []

}

```

#### Development CSP

```typescript

{

  // ... same as production but with additions:

  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],

  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],

  connectSrc: [

    // ... production sources plus:

    "http://localhost:*",

    "ws://localhost:*"

  ]

}

```
### CORS Configuration

#### Production CORS

- Only explicitly configured origins allowed

- No wildcard origins

- No localhost origins

- Credentials enabled

- 24-hour preflight cache

#### Development CORS

- Configured origins plus common localhost ports

- Automatic localhost detection

- Credentials enabled  

- 5-minute preflight cache
### Security Headers Reference
| Header | Value | Purpose |

|--------|-------|---------|

| `X-Frame-Options` | `DENY` | Prevent clickjacking attacks |

| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |

| `X-XSS-Protection` | `1; mode=block` | Enable XSS protection |

| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer information |

| `Permissions-Policy` | Restrictive feature policy | Disable unnecessary browser features |

| `X-DNS-Prefetch-Control` | `off` | Disable DNS prefetching |

| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Enforce HTTPS (production only) |
## CORS Configuration
### Allowed Origins
Origins are configured via the `CORS_ORIGINS` environment variable in production:
```bash
# Production

CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Development (automatic)
# localhost variations are automatically allowed

```
### Allowed Methods

- `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`
### Allowed Headers

- `Content-Type`

- `Authorization` 

- `X-API-Key`

- `X-CSRF-Token`

- `X-Session-ID`

- `X-Request-ID`

- `Accept`

- `Origin`

- `User-Agent`
### Exposed Headers

- `X-RateLimit-*` headers

- `X-Response-Time`

- `X-Request-ID`

- `X-API-Version`
## Implementation Files
### Main Security Middleware

- `/src/middleware/security.ts` - Legacy security middleware

- `/src/middleware/security-enhanced.ts` - Enhanced security middleware

- `/src/config/security.ts` - Security configuration
### Usage Example
```typescript

import { EnhancedSecurityMiddleware } from './middleware/security-enhanced';

import { supabaseServiceClient } from './services/supabase';
const securityMiddleware = new EnhancedSecurityMiddleware(supabaseServiceClient, {

  enableHelmet: true,

  enableCORS: true,

  enableRateLimit: true,

  enableCSRF: true,

  enableHTTPS: process.env.NODE_ENV === 'production'

});
// Apply to Express app

securityMiddleware.applyTo(app);

```
## Security Considerations
### Production Deployment
1. **CORS Origins**: Ensure `CORS_ORIGINS` environment variable contains only trusted domains

2. **HTTPS**: Always use HTTPS in production

3. **CSP**: Add specific script/style hashes instead of unsafe directives

4. **Headers**: All security headers are automatically applied
### CSP Nonce Implementation
For inline scripts/styles in production, use nonces:
```html

<!-- In your templates -->

<script nonce="<%= res.locals.nonce %>">

  // Your inline script

</script>
<style nonce="<%= res.locals.nonce %>">

  /* Your inline styles */

</style>

```
### Monitoring
Security events are logged with context:

- CORS violations

- CSP violations  

- Authentication failures

- Rate limit violations
## Testing Security
### Development Testing

```bash
# Test CORS

curl -H "Origin: http://localhost:3000" http://localhost:9999/api/health

# Test security headers

curl -I http://localhost:9999/api/health

```
### Production Testing

```bash
# Test CORS rejection

curl -H "Origin: http://malicious-site.com" https://yourapi.com/api/health

# Test HTTPS enforcement

curl -I http://yourapi.com/api/health

# Test security headers

curl -I https://yourapi.com/api/health

```
## Troubleshooting
### Common Issues
1. **CORS Errors in Development**

   - Ensure your frontend origin is in the development whitelist

   - Check browser console for specific CORS error
2. **CSP Violations**

   - Check browser console for CSP violation reports

   - Add specific hashes for inline scripts/styles
3. **HTTPS Enforcement Issues**

   - Ensure proper reverse proxy configuration

   - Check `x-forwarded-proto` header
### Security Logs
Security events are logged with the `SECURITY` context:

```typescript

logger.warn('CORS violation', LogContext.SECURITY, {

  origin: 'http://malicious-site.com',

  allowedOrigins: ['https://trusted-site.com']

});

```
## Security Checklist
### Pre-Production

- [ ] Configure production CORS origins

- [ ] Remove development-only CSP directives

- [ ] Enable HTTPS enforcement

- [ ] Test all security headers

- [ ] Verify CSP compliance

- [ ] Test CORS policy
### Production Monitoring

- [ ] Monitor security logs

- [ ] Track CSP violations

- [ ] Monitor CORS violations

- [ ] Review security headers regularly

- [ ] Update security policies as needed