# Security Guidelines for Universal AI Tools

## Overview

This document outlines the security patterns and guidelines for the Universal AI Tools platform, with specific focus on proper secret management, authentication, and secure coding practices.

## 🚨 Critical Security Rules

### 1. **NEVER Hardcode Secrets**

❌ **NEVER DO THIS:**
```javascript
const API_KEY = 'sk-1234567890abcdef...';
const JWT_SECRET = 'my-secret-key';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIs...';
```

✅ **ALWAYS DO THIS:**
```javascript
import { SecretsManager } from '../services/secrets-manager';

const secretsManager = SecretsManager.getInstance();
const apiKey = await secretsManager.getSecret('openai_api_key');
```

### 2. **Use Supabase Vault for Secret Management**

Following the patterns established in `CLAUDE.md`, all API keys and sensitive data must be stored in Supabase Vault:

```typescript
// Store secrets in Vault (one-time setup)
await supabase.rpc('vault.create_secret', {
  secret: apiKey,
  name: 'service_name_api_key',
  description: 'API key for service integration'
});

// Retrieve secrets at runtime
const { data: secret } = await supabase.rpc('vault.read_secret', {
  secret_name: 'service_name_api_key'
});
const apiKey = secret.decrypted_secret;
```

### 3. **Implement Proper Authentication Flows**

Use the established authentication patterns:

- **Backend Services**: Use SecretsManager with Supabase Vault
- **Client Applications**: Implement OAuth/JWT flows with temporary credentials
- **Development**: Use secure environment configuration, never hardcoded values

## 📁 File-Specific Security Fixes Applied

### `/installer/payload/Users/Shared/Universal AI Tools/supabase_dashboard.html`

**Issues Fixed:**
- ❌ Hardcoded JWT token in Supabase client initialization
- ❌ XSS vulnerability in search function
- ❌ XSS vulnerability in memory display

**Solutions Implemented:**
- ✅ Dynamic authentication with localStorage-based token management
- ✅ Authentication requirement UI for proper credential setup
- ✅ XSS protection with DOM manipulation instead of innerHTML
- ✅ Input sanitization for all user-provided data

### `/examples/widget-integration-demo.html`

**Issues Fixed:**
- ❌ Hardcoded API key placeholder
- ❌ Insecure authentication pattern

**Solutions Implemented:**
- ✅ Secure authentication flow with proper error handling
- ✅ Backend credential validation pattern
- ✅ Development-only fallback with clear security warnings
- ✅ Bearer token authentication instead of custom headers

## 🔧 Security Implementation Patterns

### Pattern 1: Server-Side Secret Management

```typescript
// services/example-service.ts
import { SecretsManager } from './secrets-manager';

export class ExampleService {
  private async getApiKey(): Promise<string> {
    const secretsManager = SecretsManager.getInstance();
    return await secretsManager.getSecret('example_service_api_key');
  }
  
  async makeAPICall(data: any) {
    const apiKey = await this.getApiKey();
    // Use apiKey securely...
  }
}
```

### Pattern 2: Client-Side Authentication

```javascript
// examples/secure-client-example.js
class SecureClient {
  async initialize() {
    // 1. Authenticate user via OAuth/JWT
    const userAuth = await this.authenticateUser();
    
    // 2. Request temporary credentials from backend
    const credentials = await this.requestCredentials(userAuth.token);
    
    // 3. Use temporary credentials for API calls
    this.apiKey = credentials.temporaryKey;
  }
}
```

### Pattern 3: Environment Configuration

```bash
# .env (for development)
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ... # Public key only

# API keys stored in Supabase Vault:
# - openai_api_key
# - anthropic_api_key  
# - jwt_secret
# - Any other sensitive keys
```

## 🛡️ Security Checklist

### For All Code Changes:
- [ ] No hardcoded secrets or API keys
- [ ] Proper input validation and sanitization
- [ ] XSS protection for any HTML generation
- [ ] CSRF protection for state-changing operations
- [ ] Proper error handling without information leakage
- [ ] Secure authentication and authorization
- [ ] Rate limiting and abuse prevention

### For Client-Side Applications:
- [ ] Never store long-lived secrets in browser storage
- [ ] Use temporary, scoped credentials only
- [ ] Implement proper token rotation
- [ ] Clear sensitive data on cleanup
- [ ] Use HTTPS for all communications
- [ ] Validate all server responses

### For Server-Side Applications:
- [ ] Use SecretsManager for all API key retrieval
- [ ] Store secrets in Supabase Vault, never in environment variables
- [ ] Implement proper JWT validation
- [ ] Use principle of least privilege
- [ ] Log security events for monitoring
- [ ] Implement circuit breakers for external services

## 📚 Additional Resources

### Security Services Available:
- `SecretsManager`: Secure API key management with Supabase Vault
- `AuthenticationMiddleware`: JWT validation and user authentication  
- `RateLimiterEnhanced`: Advanced rate limiting and abuse prevention
- `CircuitBreaker`: Resilience patterns for external services

### Example Files:
- `examples/secure-authentication-example.js`: Complete authentication pattern
- `src/services/secrets-manager.ts`: Supabase Vault integration
- `src/middleware/auth.ts`: Authentication middleware patterns

### Security Migrations:
When updating existing services to use Supabase Vault:

1. Identify all hardcoded API keys
2. Store keys in Supabase Vault using consistent naming
3. Update services to use SecretsManager
4. Remove keys from environment variables and code
5. Test all authentication flows
6. Update documentation and examples

## 🚨 Incident Response

If you discover hardcoded secrets in the codebase:

1. **Immediate**: Rotate the exposed credentials
2. **Short-term**: Move secrets to Supabase Vault
3. **Long-term**: Implement proper security patterns
4. **Documentation**: Update this guide with lessons learned

Remember: Security is not optional - it's a fundamental requirement for all code in this project.