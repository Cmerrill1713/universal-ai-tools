# Claude Security Fixes Guide

This guide provides specific instructions for fixing security vulnerabilities in the Universal AI Tools codebase. Follow these guidelines precisely when addressing security issues.

## 1. Security Vulnerabilities Inventory

### Critical Vulnerabilities

#### 1.1 Hard-coded Development Keys
**Severity: CRITICAL**
**Files Affected:**
- `/src/middleware/auth.ts` (line 15): `const devKey = 'local-dev-key'`
- `/src/middleware/auth-jwt.ts` (line 8): `process.env.JWT_SECRET || 'dev-secret'`
- `/src/config/environment.ts` (line 45): `JWT_SECRET: 'dev-jwt-secret'`

**Issue:**
```typescript
// VULNERABLE CODE
const authenticateRequest = (req: Request) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === 'local-dev-key') { // NEVER DO THIS
    return { authenticated: true };
  }
};
```

**Fix:**
```typescript
// SECURE CODE
const authenticateRequest = (req: Request) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    throw new Error('API_KEY not configured');
  }
  
  if (!apiKey || apiKey !== validApiKey) {
    return { authenticated: false, error: 'Invalid API key' };
  }
  
  return { authenticated: true };
};
```

#### 1.2 Development Mode Bypasses
**Severity: HIGH**
**Files Affected:**
- `/src/middleware/auth-enhanced.ts` (line 32): Development bypass
- `/src/server.ts` (line 89): Skip auth in development

**Issue:**
```typescript
// VULNERABLE CODE
if (process.env.NODE_ENV === 'development') {
  next(); // Skip authentication
  return;
}
```

**Fix:**
```typescript
// SECURE CODE
// Remove ALL development bypasses
// Use proper test credentials in development
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = await verifyJWT(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### High Severity Issues

#### 1.3 SQL Injection Vulnerabilities
**Files Affected:**
- `/src/services/supabase_service.ts` (multiple locations)
- `/src/routers/memory.ts` (line 45): Direct query concatenation

**Issue:**
```typescript
// VULNERABLE CODE
const query = `SELECT * FROM memories WHERE user_id = '${userId}'`;
```

**Fix:**
```typescript
// SECURE CODE
const { data, error } = await supabase
  .from('memories')
  .select('*')
  .eq('user_id', userId);
```

#### 1.4 Missing Input Validation
**Files Affected:**
- All API endpoints in `/src/routers/`
- WebSocket handlers in `/src/server.ts`

**Issue:**
```typescript
// VULNERABLE CODE
app.post('/api/memory', async (req, res) => {
  const { content, metadata } = req.body; // No validation
  await createMemory(content, metadata);
});
```

**Fix:**
```typescript
// SECURE CODE
import { z } from 'zod';

const memorySchema = z.object({
  content: z.string().min(1).max(10000),
  metadata: z.object({
    tags: z.array(z.string()).optional(),
    source: z.string().optional()
  }).optional()
});

app.post('/api/memory', async (req, res) => {
  try {
    const validatedData = memorySchema.parse(req.body);
    await createMemory(validatedData.content, validatedData.metadata);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input', 
        details: error.errors 
      });
    }
    throw error;
  }
});
```

## 2. Authentication Issues

### 2.1 All 'local-dev-key' Instances

**Complete List:**
1. `/src/middleware/auth.ts:15` - Main auth middleware
2. `/src/middleware/auth-enhanced.ts:28` - Enhanced auth check
3. `/src/services/supabase_service.ts:42` - Service initialization
4. `/src/config/environment.ts:45` - Config defaults
5. `/ui/src/lib/api.ts:12` - Frontend API client

**Removal Template:**
```typescript
// Replace ALL instances with environment variable checks
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('API_KEY environment variable is required');
}
```

### 2.2 Missing Authentication Endpoints

**Unprotected Endpoints:**
- `GET /api/health` (OK - public endpoint)
- `POST /api/orchestrate` (NEEDS AUTH)
- `GET /api/agents` (NEEDS AUTH)
- `WebSocket /ws` (NEEDS AUTH)

**Fix Template:**
```typescript
// Apply to ALL protected routes
import { authenticate } from './middleware/auth';

// Individual route
app.post('/api/orchestrate', authenticate, async (req, res) => {
  // Route handler
});

// Router-level
const router = express.Router();
router.use(authenticate); // Protects all routes in this router
```

### 2.3 JWT Implementation Issues

**Current Issues:**
- Weak secret in development
- No token expiration
- Missing refresh token logic
- No token revocation

**Secure JWT Implementation:**
```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

export const generateToken = (userId: string): string => {
  return jwt.sign(
    { 
      userId,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID() // Token ID for revocation
    },
    JWT_SECRET,
    { 
      expiresIn: '1h',
      issuer: 'universal-ai-tools',
      audience: 'api'
    }
  );
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET, {
    issuer: 'universal-ai-tools',
    audience: 'api'
  });
};
```

## 3. Configuration Security

### 3.1 CORS Misconfiguration

**Current Issue:**
```typescript
// VULNERABLE in /src/middleware/security.ts
app.use(cors({
  origin: '*', // Allows any origin
  credentials: true // With credentials!
}));
```

**Secure Configuration:**
```typescript
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://your-production-domain.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

### 3.2 Security Headers

**Missing Headers:**
```typescript
// Add to /src/middleware/security-enhanced.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Avoid unsafe-inline in production
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

### 3.3 Environment Variable Security

**Validation Template:**
```typescript
// /src/config/environment.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  API_KEY: z.string().min(32),
  FRONTEND_URL: z.string().url()
});

export const validateEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
};

export const env = validateEnv();
```

## 4. Database Security

### 4.1 SECURITY DEFINER Functions Audit

**Functions to Review:**
```sql
-- List all SECURITY DEFINER functions
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true
  AND n.nspname NOT IN ('pg_catalog', 'information_schema');
```

**Secure Pattern:**
```sql
-- Only use SECURITY DEFINER when necessary
-- Always validate inputs
CREATE OR REPLACE FUNCTION get_user_memories(p_user_id uuid)
RETURNS TABLE (id uuid, content text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate user exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = p_user_id 
    AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;
  
  -- Return only user's own memories
  RETURN QUERY
  SELECT m.id, m.content, m.created_at
  FROM memories m
  WHERE m.user_id = p_user_id
  AND m.deleted_at IS NULL;
END;
$$;

-- Set proper permissions
REVOKE ALL ON FUNCTION get_user_memories FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_memories TO authenticated;
```

### 4.2 Input Validation Patterns

**SQL Injection Prevention:**
```typescript
// NEVER do string concatenation
// ALWAYS use parameterized queries

// Using Supabase client
const { data, error } = await supabase
  .from('memories')
  .select('*')
  .eq('user_id', userId)
  .ilike('content', `%${searchTerm}%`);

// Using raw SQL (when necessary)
const { data, error } = await supabase.rpc('search_memories', {
  p_user_id: userId,
  p_search_term: searchTerm
});
```

### 4.3 Error Message Security

**Vulnerable Error Handling:**
```typescript
// NEVER expose internal errors
catch (error) {
  res.status(500).json({ 
    error: error.message, // Exposes internal details
    stack: error.stack    // Exposes file paths
  });
}
```

**Secure Error Handling:**
```typescript
import { logger } from './utils/logger';

catch (error) {
  // Log full error internally
  logger.error('Database error', {
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    endpoint: req.path
  });
  
  // Return generic error to client
  res.status(500).json({ 
    error: 'An error occurred processing your request',
    requestId: req.id // For support reference
  });
}
```

## 5. Fix Templates

### 5.1 Authentication Middleware Template

```typescript
// /src/middleware/secure-auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    
    // Additional validation
    if (!decoded.userId || !decoded.iat) {
      throw new Error('Invalid token structure');
    }
    
    // Check token age (optional)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    if (tokenAge > 86400) { // 24 hours
      throw new Error('Token too old');
    }
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Invalid authentication token' 
    });
  }
};

// Role-based access control
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required' 
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};
```

### 5.2 Input Validation Template

```typescript
// /src/validators/index.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Common schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20)
});

// Validation middleware factory
export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
};

// Example usage
const createMemorySchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(['text', 'code', 'image']),
  metadata: z.record(z.unknown()).optional()
});

router.post('/memory', 
  authenticate,
  validate(createMemorySchema),
  async (req, res) => {
    // req.body is now validated
  }
);
```

### 5.3 Secure Configuration Template

```typescript
// /src/config/secure-config.ts
import { z } from 'zod';

// Configuration schema with validation
const configSchema = z.object({
  server: z.object({
    port: z.number().int().positive(),
    host: z.string(),
    trustProxy: z.boolean()
  }),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().int().positive().max(100),
    ssl: z.boolean()
  }),
  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiry: z.string(),
    bcryptRounds: z.number().int().min(10).max(15)
  }),
  security: z.object({
    rateLimitWindow: z.number(),
    rateLimitMax: z.number(),
    allowedOrigins: z.array(z.string().url()),
    sessionSecret: z.string().min(32)
  })
});

// Load and validate configuration
export const loadConfig = () => {
  const config = {
    server: {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      trustProxy: process.env.TRUST_PROXY === 'true'
    },
    database: {
      url: process.env.DATABASE_URL!,
      poolSize: parseInt(process.env.DB_POOL_SIZE || '10'),
      ssl: process.env.DB_SSL !== 'false'
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET!,
      jwtExpiry: process.env.JWT_EXPIRY || '1h',
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
    },
    security: {
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      sessionSecret: process.env.SESSION_SECRET!
    }
  };
  
  return configSchema.parse(config);
};
```

## 6. Testing Security Fixes

### 6.1 Security Test Cases

```typescript
// /src/tests/security/auth.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('Authentication Security', () => {
  test('should reject requests without token', async () => {
    const res = await request(app)
      .get('/api/protected')
      .expect(401);
    
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Authentication required');
  });
  
  test('should reject invalid tokens', async () => {
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
    
    expect(res.body.error).toBe('Invalid authentication token');
  });
  
  test('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    const res = await request(app)
      .get('/api/protected')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
  
  test('should not expose sensitive error details', async () => {
    const res = await request(app)
      .post('/api/memory')
      .send({ invalid: 'data' })
      .expect(400);
    
    expect(res.body).not.toHaveProperty('stack');
    expect(res.body).not.toMatch(/database/i);
    expect(res.body).not.toMatch(/sql/i);
  });
});
```

### 6.2 SQL Injection Tests

```typescript
// /src/tests/security/sql-injection.test.ts
describe('SQL Injection Prevention', () => {
  const injectionPayloads = [
    "'; DROP TABLE users; --",
    "1' OR '1'='1",
    "admin'--",
    "1; UPDATE users SET role='admin' WHERE id=1; --"
  ];
  
  test.each(injectionPayloads)(
    'should handle SQL injection attempt: %s',
    async (payload) => {
      const res = await request(app)
        .get('/api/search')
        .query({ q: payload })
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      // Should return empty results, not error
      expect(res.body.results).toEqual([]);
    }
  );
});
```

### 6.3 Security Checklist

```markdown
## Pre-Deployment Security Checklist

### Environment & Configuration
- [ ] All environment variables are set (no defaults)
- [ ] JWT_SECRET is at least 32 characters
- [ ] API_KEY is strong and unique
- [ ] Database connection uses SSL
- [ ] CORS is properly configured
- [ ] Security headers are enabled

### Authentication & Authorization
- [ ] No hardcoded credentials anywhere
- [ ] All endpoints require authentication (except public ones)
- [ ] JWT tokens have expiration
- [ ] Role-based access control is implemented
- [ ] Password reset tokens expire

### Input Validation & Sanitization
- [ ] All inputs are validated with Zod schemas
- [ ] SQL queries use parameterization
- [ ] File uploads are restricted by type and size
- [ ] User-generated content is sanitized

### Error Handling
- [ ] No stack traces in production
- [ ] Generic error messages for clients
- [ ] Detailed logging for debugging
- [ ] Rate limiting on error endpoints

### Database Security
- [ ] SECURITY DEFINER functions are audited
- [ ] RLS policies are enabled
- [ ] Database roles have minimal permissions
- [ ] Sensitive data is encrypted

### Testing
- [ ] Security test suite passes
- [ ] Penetration testing completed
- [ ] Dependency vulnerabilities scanned
- [ ] Code security analysis run
```

## 7. Common Mistakes to Avoid

### 7.1 Development Shortcuts

**NEVER DO:**
```typescript
// Skip auth in development
if (process.env.NODE_ENV === 'development') {
  return next();
}

// Use weak secrets
const secret = process.env.JWT_SECRET || 'dev-secret';

// Disable security features
app.use(cors({ origin: '*' }));

// Log sensitive data
console.log('User password:', password);
```

### 7.2 Quick Fixes That Create Problems

**Avoid These Patterns:**
1. **Disabling Security**: Don't disable CORS, CSP, or other security features to "fix" issues
2. **Weakening Validation**: Don't remove input validation to make requests work
3. **Exposing Internals**: Don't add debug endpoints that expose system information
4. **Bypassing Auth**: Don't add backdoors or special keys for testing

### 7.3 Security Decision Documentation

**Document All Security Decisions:**
```typescript
/**
 * Security Decision: Public Health Endpoint
 * Reason: Required for load balancer health checks
 * Risk: Minimal - only returns status
 * Mitigation: Rate limited, no sensitive data
 * Approved by: Security Team
 * Date: 2024-01-20
 */
router.get('/health', rateLimiter, (req, res) => {
  res.json({ status: 'ok' });
});
```

### 7.4 Testing in Production-like Environment

**Security Testing Requirements:**
1. Use real authentication tokens (not dev keys)
2. Test with HTTPS enabled
3. Verify security headers are present
4. Check error messages don't leak information
5. Ensure rate limiting works
6. Validate CORS restrictions

## Quick Reference Commands

```bash
# Find all hardcoded secrets
grep -r "local-dev-key\|dev-secret\|test-key" src/

# Check for SQL concatenation
grep -r "query.*\+.*\${" src/

# Find missing authentication
grep -r "router\.\(get\|post\|put\|delete\)" src/ | grep -v authenticate

# List SECURITY DEFINER functions
psql $DATABASE_URL -c "SELECT proname FROM pg_proc WHERE prosecdef = true;"

# Run security tests
npm run test:security

# Check dependencies for vulnerabilities
npm audit
```

Remember: Security is not optional. Every fix must maintain or improve the security posture of the application.