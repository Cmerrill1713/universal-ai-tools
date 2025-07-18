# Security Implementation Guide

This document describes the comprehensive security measures implemented in the Universal AI Tools system.

## Table of Contents
1. [Authentication & Authorization](#authentication--authorization)
2. [Rate Limiting](#rate-limiting)
3. [Input Validation & Sanitization](#input-validation--sanitization)
4. [CSRF Protection](#csrf-protection)
5. [SQL Injection Protection](#sql-injection-protection)
6. [Security Headers](#security-headers)
7. [HTTPS Enforcement](#https-enforcement)
8. [Environment Security](#environment-security)
9. [API Security Best Practices](#api-security-best-practices)
10. [Security Monitoring](#security-monitoring)

## Authentication & Authorization

### JWT Implementation
- **Access Tokens**: 15-minute expiry, signed with HS256
- **Refresh Tokens**: 7-day expiry, stored encrypted in database
- **Token Rotation**: New token pair issued on refresh
- **Session Management**: Track active sessions per user

```typescript
// Login example
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "secure_password"
}

// Response
{
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900
  }
}
```

### API Key Authentication
- Encrypted storage in database
- Permission-based access control
- Usage tracking and monitoring

## Rate Limiting

### Tier-based Limits
- **Anonymous**: 100 requests per 15 minutes
- **Authenticated**: 1000 requests per 15 minutes
- **Premium**: 5000 requests per 15 minutes
- **Admin**: 10000 requests per 15 minutes

### Endpoint-specific Limits
- **Authentication**: 5 attempts per 15 minutes
- **Password Reset**: 3 attempts per hour
- **API Key Generation**: 10 per day
- **File Uploads**: 100 per hour
- **Export/Import**: 10 per hour

### DDoS Protection
- Automatic IP blocking after suspicious patterns
- Request pattern analysis
- Distributed rate limiting with Redis/Supabase

## Input Validation & Sanitization

### Zod Schema Validation
All API endpoints use Zod schemas for input validation:

```typescript
// Example validation schema
const memorySchema = z.object({
  content: z.string().min(1).max(10000),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(0).max(1).optional(),
});
```

### SQL Injection Protection
- Pattern-based detection
- Parameterized queries
- Input sanitization
- NoSQL injection prevention

```typescript
// Safe query example
const { query, params } = SQLInjectionProtection.parameterize(
  "SELECT * FROM users WHERE email = ? AND active = ?",
  [email, true]
);
```

## CSRF Protection

### Implementation Details
- Double Submit Cookie pattern
- Token generation per session
- Automatic token injection in forms
- Header and cookie validation

```typescript
// CSRF token in forms
<form method="POST">
  <%= csrfInput() %>
  <!-- form fields -->
</form>

// CSRF token in AJAX
fetch('/api/endpoint', {
  headers: {
    'X-CSRF-Token': getCsrfToken(),
  }
});
```

## Security Headers

### Helmet.js Configuration
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)
- X-XSS-Protection: 1; mode=block

### Custom Headers
- X-Request-ID for tracking
- Rate limit headers
- Cache control headers

## HTTPS Enforcement

### Production Requirements
- Automatic HTTP to HTTPS redirect
- HSTS with preload
- Secure cookies
- Certificate validation

## Environment Security

### Startup Validation
- Required variables check
- Format validation
- Secure defaults generation
- File permission checks

### Secret Management
- Encrypted storage
- Key rotation support
- Audit logging

```bash
# Required environment variables
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=64-character-secret
ENCRYPTION_KEY=32-character-key
```

## API Security Best Practices

### Request Security
1. **Authentication Required**: All API endpoints except public ones
2. **Input Validation**: Every request validated with Zod
3. **Output Sanitization**: Prevent XSS in responses
4. **Error Handling**: No sensitive data in error messages

### Response Security
- Consistent error format
- Rate limit headers
- CORS headers
- Cache prevention

## Security Monitoring

### Event Logging
- Failed login attempts
- Rate limit violations
- SQL injection attempts
- Authentication failures

### Security Metrics
```sql
-- View security metrics
SELECT * FROM security_metrics;

-- Active sessions
SELECT * FROM active_sessions;

-- Recent security events
SELECT * FROM security_events 
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY severity DESC;
```

### Automated Responses
- Account lockout after failed attempts
- IP blocking for repeated violations
- Token revocation
- Alert notifications

## Migration Guide

### From Basic Auth to Secure Server

1. **Update Environment Variables**
```bash
# Add required security variables
JWT_SECRET=$(openssl rand -base64 64)
ENCRYPTION_KEY=$(openssl rand -hex 32)
```

2. **Run Database Migrations**
```bash
# Apply security tables
psql $DATABASE_URL < migrations/004_security_enhancements.sql
```

3. **Update Server Startup**
```javascript
// Old
npm run dev

// New (with security)
npm run dev:secure
```

4. **Update Client Code**
```javascript
// Add authentication headers
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrfToken,
  }
});
```

## Security Checklist

- [ ] Environment variables validated on startup
- [ ] JWT tokens implemented with refresh mechanism
- [ ] Rate limiting applied to all endpoints
- [ ] CSRF protection on state-changing operations
- [ ] SQL injection protection enabled
- [ ] Security headers configured
- [ ] HTTPS enforced in production
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive data
- [ ] Security events logged
- [ ] Automated security responses configured
- [ ] Regular security audits scheduled

## Incident Response

### Security Breach Protocol
1. Identify affected systems
2. Revoke compromised tokens
3. Reset affected user passwords
4. Review security logs
5. Patch vulnerabilities
6. Notify affected users
7. Document lessons learned

### Contact
For security concerns or vulnerability reports, please contact:
- Security Team: security@universal-ai-tools.com
- Emergency: Use the security hotline

## Regular Maintenance

### Daily Tasks
- Review security metrics dashboard
- Check for failed login patterns
- Monitor rate limit violations

### Weekly Tasks
- Review security event logs
- Update IP block lists
- Check for unusual access patterns

### Monthly Tasks
- Rotate API keys
- Review and update rate limits
- Security dependency updates
- Penetration testing

## Compliance

This implementation follows:
- OWASP Top 10 recommendations
- GDPR requirements for data protection
- SOC 2 security standards
- Industry best practices for API security