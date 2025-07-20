# JWT Authentication Implementation Guide

## Overview

This guide documents the comprehensive JWT authentication system implemented for Universal AI Tools, featuring:

- **Short-lived access tokens** (15 minutes)
- **Long-lived refresh tokens** (7 days) with rotation
- **Multi-device session management**
- **Rate limiting and security features**
- **Blacklist/revocation mechanism**
- **Supabase integration**

## Architecture

### Components

1. **JWTAuthService** (`src/middleware/auth-jwt.ts`)
   - Token generation and verification
   - Refresh token management
   - Session tracking
   - Rate limiting for authentication attempts

2. **AuthRouter** (`src/routers/auth.ts`)
   - Authentication endpoints
   - Input validation
   - Rate limiting middleware
   - Session management endpoints

3. **Database Schema** (`supabase/migrations/020_jwt_auth_system.sql`)
   - Users table with security features
   - Refresh tokens with encryption
   - Authentication event logging
   - Session tracking

4. **Enhanced Server Integration** (`src/server.ts`)
   - Dual authentication (JWT + API keys)
   - Backward compatibility
   - Security middleware

## Key Features

### 1. Token Management

#### Access Tokens
- **Lifetime**: 15 minutes
- **Storage**: Client memory (recommended)
- **Purpose**: API access authorization
- **Claims**: `sub`, `email`, `role`, `type`, `jti`, `iat`, `exp`

#### Refresh Tokens
- **Lifetime**: 7 days
- **Storage**: Encrypted in database, HttpOnly cookies (production)
- **Purpose**: Generate new access tokens
- **Rotation**: New refresh token issued on each refresh
- **Revocation**: Individual and bulk revocation supported

### 2. Security Features

#### Rate Limiting
- **Authentication endpoints**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **Token refresh**: 10 attempts per 5 minutes per IP
- **IP-based blocking**: 15-minute lockout after 5 failed attempts

#### Token Security
- **Blacklist mechanism**: Revoked tokens tracked in memory and database
- **Secure generation**: `crypto.randomUUID()` for token IDs
- **Encryption**: Refresh tokens encrypted before database storage
- **Validation**: Server-side validation on every request

#### Session Management
- **Multi-device support**: Track sessions per device/browser
- **Session monitoring**: View active sessions with device info
- **Selective revocation**: Revoke individual sessions
- **Global logout**: Revoke all user sessions

### 3. Database Schema

#### Core Tables

```sql
-- Enhanced users table
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Refresh tokens with encryption
refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token_id UUID UNIQUE NOT NULL,
  encrypted_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Authentication event logging
auth_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
)
```

#### Security Functions

```sql
-- Cleanup expired tokens
cleanup_expired_refresh_tokens() RETURNS INTEGER

-- Get user security summary
get_user_security_summary(UUID) RETURNS JSONB

-- Revoke all user sessions
revoke_all_user_sessions(UUID) RETURNS INTEGER
```

## API Endpoints

### Authentication Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/auth/register` | POST | User registration | 3/hour |
| `/api/auth/login` | POST | User login | 5/15min |
| `/api/auth/refresh` | POST | Refresh access token | 10/5min |
| `/api/auth/logout` | POST | Logout current session | - |
| `/api/auth/logout-all` | POST | Logout all sessions | - |
| `/api/auth/profile` | GET | Get user profile | - |
| `/api/auth/sessions` | GET | List active sessions | - |
| `/api/auth/sessions/:id` | DELETE | Revoke specific session | - |
| `/api/auth/security-info` | GET | Security summary | - |
| `/api/auth/change-password` | POST | Change password | - |

### Request/Response Examples

#### Registration
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

# Response
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

# Response
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

#### Token Refresh
```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

# Response
{
  "message": "Token refreshed successfully",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

## Client Implementation

### JavaScript/TypeScript Client

```typescript
class JWTTokenManager {
  private tokenData: TokenData | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  // Store tokens after login
  setTokens(data: { accessToken: string; refreshToken?: string; expiresIn: number }) {
    // Implementation details in SecureTokenStorageService
  }

  // Get current access token
  getAccessToken(): string | null {
    // Automatic refresh if expired
  }

  // Make authenticated requests
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Auto-retry with token refresh on 401
  }
}
```

### Storage Recommendations

#### Production (High Security)
- **Access Tokens**: Memory storage only
- **Refresh Tokens**: HttpOnly cookies
- **HTTPS**: Enforced
- **CSRF Protection**: Enabled
- **SameSite**: Strict

#### Development
- **Access Tokens**: Memory or sessionStorage
- **Refresh Tokens**: Encrypted localStorage
- **HTTPS**: Recommended
- **CORS**: Configured for localhost

## Security Considerations

### Token Security
1. **Short access token lifetime** (15 minutes) minimizes exposure
2. **Refresh token rotation** prevents replay attacks
3. **Encrypted storage** in database protects refresh tokens
4. **Blacklist mechanism** enables immediate revocation
5. **Secure generation** using cryptographic functions

### Network Security
1. **HTTPS enforcement** in production
2. **Secure cookie flags** for refresh tokens
3. **CORS configuration** restricts origins
4. **CSP headers** prevent code injection
5. **Rate limiting** prevents brute force attacks

### Application Security
1. **Input validation** on all endpoints
2. **Password requirements** enforced
3. **Account lockout** after failed attempts
4. **Session monitoring** for unusual activity
5. **Audit logging** for security events

## Deployment Guide

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secure-secret-key-minimum-256-bits
JWT_REFRESH_SECRET=different-secret-for-refresh-tokens

# Database Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-key

# Security Configuration
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
SECURE_COOKIES=true
CSRF_PROTECTION=true
```

### Database Migration
```bash
# Apply the JWT authentication schema
supabase db push

# Or manually apply migration
psql -d your_database -f supabase/migrations/020_jwt_auth_system.sql
```

### Production Checklist
- [ ] HTTPS enforced
- [ ] Secure environment variables set
- [ ] Database migrations applied
- [ ] CORS origins configured
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Backup procedures established
- [ ] Security audit completed

## Monitoring and Maintenance

### Key Metrics to Monitor
1. **Authentication success rate**
2. **Token refresh frequency**
3. **Failed login attempts**
4. **Active session count**
5. **Security event frequency**

### Maintenance Tasks
1. **Token cleanup**: Automated via database functions
2. **Security audits**: Regular review of auth logs
3. **Key rotation**: Periodic JWT secret rotation
4. **Performance monitoring**: Track auth endpoint response times
5. **Capacity planning**: Monitor user growth and session count

### Troubleshooting

#### Common Issues
1. **Token expired**: Check client-side refresh logic
2. **CORS errors**: Verify origin configuration
3. **Rate limiting**: Check IP whitelisting
4. **Database errors**: Monitor connection pool
5. **Cookie issues**: Verify domain and path settings

#### Debug Commands
```bash
# Check active sessions
SELECT * FROM active_user_sessions;

# View recent auth events
SELECT * FROM auth_events ORDER BY timestamp DESC LIMIT 100;

# Check security alerts
SELECT * FROM security_alerts;

# Monitor authentication statistics
SELECT * FROM auth_statistics;
```

## Integration with Existing Systems

### API Key Compatibility
The new system maintains backward compatibility with existing API key authentication:

```typescript
// Enhanced middleware supports both authentication methods
const authenticateAI = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Try JWT first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // JWT authentication logic
  }
  
  // Fallback to API key
  if (apiKey && aiService) {
    // API key authentication logic
  }
}
```

### Migration Strategy
1. **Phase 1**: Deploy new auth system alongside existing API keys
2. **Phase 2**: Update client applications to use JWT
3. **Phase 3**: Deprecate API key authentication (optional)
4. **Phase 4**: Remove API key support (if desired)

## Support and Resources

### Documentation
- API documentation: `/api/docs`
- Security guide: Generated by `SecureTokenStorageService`
- Client implementation examples: In service file

### Testing
- Unit tests: `src/tests/unit/auth/`
- Integration tests: `src/tests/integration/auth/`
- Security tests: `src/tests/security/auth/`

### Support
- GitHub Issues: For bug reports and feature requests
- Security Issues: Use private security reporting
- Documentation: Keep this guide updated with changes

---

This implementation provides enterprise-grade JWT authentication with comprehensive security features, session management, and production-ready deployment capabilities.