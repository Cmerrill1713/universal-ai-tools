# Security Integration Guide

## Quick Integration Steps

### 1. Update Server.ts

Replace the existing input sanitization middleware in `src/server.ts`:

**Find this section (around line 848-854):**
```typescript
// Input sanitization middleware - Apply globally for security
try {
  const { sanitizers } = await import('./middleware/input-sanitization');
  this.app.use(sanitizers.general);
  log.info('✅ Input sanitization middleware enabled globally', LogContext.SERVER);
} catch (error) {
  log.error('Failed to load input sanitization middleware', LogContext.SERVER, { error });
}
```

**Replace with:**
```typescript
// Enhanced comprehensive security middleware
try {
  const { setupSecurity } = await import('./middleware/security-integration');
  await setupSecurity(this.app, {
    strictMode: process.env.NODE_ENV === 'production',
    enablePerRouteProtection: true,
    productionMode: process.env.NODE_ENV === 'production',
    logSecurityEvents: true,
    blockHighRiskRequests: true,
  });
  log.info('✅ Comprehensive security middleware enabled globally', LogContext.SERVER);
} catch (error) {
  log.error('Failed to load comprehensive security middleware', LogContext.SERVER, { error });
}
```

### 2. Environment Variables (Optional)

Add to your `.env` file:
```env
# Security Configuration
SECURITY_STRICT_MODE=true
SECURITY_LOG_EVENTS=true
SECURITY_BLOCK_HIGH_RISK=true
SECURITY_MAX_REQUEST_SIZE=10mb
```

### 3. Install Missing Dependencies

```bash
npm install helmet express-rate-limit
```

### 4. Test Security Status

After starting your server, test the security endpoint:
```bash
curl http://localhost:9999/api/v1/security/status
```

## Manual Route Protection (Advanced)

For specific routes that need extra protection:

```typescript
import { enhancedSanitizers, routeSpecificSecurity } from './middleware/security-integration';

// High-security routes
app.use('/api/v1/auth/*', routeSpecificSecurity.highSecurity);

// Database routes
app.use('/api/v1/database/*', routeSpecificSecurity.database);

// File upload routes
app.use('/api/v1/upload/*', routeSpecificSecurity.fileUpload);
```

## Testing Security

Run the comprehensive security tests:
```bash
npm test src/middleware/__tests__/enhanced-input-sanitization.test.ts
```

## Security Features Enabled

✅ **SQL Injection Prevention** - All database inputs  
✅ **XSS Protection** - HTML/script injection prevention  
✅ **Command Injection Prevention** - System command protection  
✅ **NoSQL Injection Prevention** - MongoDB/Neo4j protection  
✅ **GraphQL Injection Prevention** - Query depth limiting  
✅ **Path Traversal Prevention** - File system protection  
✅ **Prototype Pollution Prevention** - Object safety  
✅ **Header Injection Prevention** - HTTP header validation  
✅ **Template Injection Prevention** - Template engine safety  
✅ **File Upload Validation** - Magic number checking  
✅ **Rate Limiting** - Adaptive request throttling  
✅ **Security Headers** - Helmet integration  

## Monitoring

Security events are automatically logged to your configured logger with structured data including:
- Attack type and severity
- IP address and user agent
- Risk score (0-100)
- Timestamp and request details

Critical security events (risk score ≥70) are automatically blocked and logged as errors.

## Support

If you encounter any issues:
1. Check the security status endpoint: `/api/v1/security/status`
2. Review logs for security events
3. Verify middleware is properly applied to routes
4. Test with known attack vectors to validate protection

The security system is designed to be fail-safe - if there are any configuration issues, it will default to blocking suspicious requests rather than allowing them through.