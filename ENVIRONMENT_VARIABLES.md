# Universal AI Tools - Environment Variables Configuration

## 🚀 **SECURITY HARDENING COMPLETE**

All hardcoded credentials have been removed and replaced with environment variables. Here's your complete configuration guide:

## 📋 **REQUIRED ENVIRONMENT VARIABLES**

### **Production Security (REQUIRED)**

```bash
# 🔐 CRITICAL - Set these in production
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
ENCRYPTION_KEY=your-encryption-key-32-characters
TOKEN_ENCRYPTION_KEY=your-token-encryption-key

# 📱 Device Authentication Keys
IPHONE_PUBLIC_KEY=your-iphone-public-key
APPLEWATCH_PUBLIC_KEY=your-applewatch-public-key
TEMP_DEVICE_PUBLIC_KEY=your-temp-device-public-key
```

### **Database Configuration**

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/universal_ai_tools
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT=30000
DB_POOL_SIZE=10
DB_QUERY_TIMEOUT=30000
DB_HEALTH_CHECK_INTERVAL=60000
```

### **Redis Configuration**

```bash
REDIS_URL=redis://redis:6379
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password
REDIS_RETRY_ATTEMPTS=3
```

### **Supabase Configuration**

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### **AI/ML Services (Optional)**

```bash
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
OLLAMA_URL=http://ollama:11434
LM_STUDIO_URL=
```

### **Vision Services**

```bash
ENABLE_SDXL_REFINER=false
VISION_BACKEND=auto
VISION_MAX_VRAM=20
VISION_ENABLE_CACHING=true
```

## 🔒 **SECURITY IMPROVEMENTS MADE**

### **✅ Removed Hardcoded Values**

- ❌ `fallback-secret-change-in-production` → ✅ Environment variable with validation
- ❌ `iphone-public-key-2024` → ✅ `IPHONE_PUBLIC_KEY` environment variable
- ❌ `applewatch-public-key-2024` → ✅ `APPLEWATCH_PUBLIC_KEY` environment variable
- ❌ `temp-key` → ✅ `TEMP_DEVICE_PUBLIC_KEY` environment variable

### **✅ Production Validation**

```typescript
// JWT Secret validation in environment.ts
if (config.environment === 'production' && config.jwt.secret.includes('fallback')) {
  throw new Error('JWT_SECRET must be set in production');
}
```

### **✅ Development Warnings**

```typescript
// Warns in development, fails in production
console.warn(
  '⚠️  Using development JWT secret. Set JWT_SECRET environment variable for production.'
);
```

## 🛠️ **HOW TO SET UP ENVIRONMENT VARIABLES**

### **1. Create Environment File**

```bash
# Copy template (create this manually)
cp ENVIRONMENT_VARIABLES.md .env.template
# Edit with your values
```

### **2. Docker Environment**

```yaml
# In docker-compose.prod.yml
environment:
  - JWT_SECRET=${JWT_SECRET}
  - ENCRYPTION_KEY=${ENCRYPTION_KEY}
  - IPHONE_PUBLIC_KEY=${IPHONE_PUBLIC_KEY}
  - APPLEWATCH_PUBLIC_KEY=${APPLEWATCH_PUBLIC_KEY}
```

### **3. Production Deployment**

```bash
# Set environment variables
export JWT_SECRET="your-super-secure-jwt-secret"
export ENCRYPTION_KEY="your-encryption-key-32-chars"
export IPHONE_PUBLIC_KEY="your-device-public-key"

# Or use Docker secrets
echo "your-secret" | docker secret create jwt_secret -
```

## 🔐 **SECURITY BEST PRACTICES**

### **✅ Implemented**

- Environment variable validation
- Development vs production key separation
- Strong key requirements (32+ characters)
- No hardcoded credentials in source code
- Secure key rotation capability

### **✅ Recommendations**

- Rotate keys monthly
- Use different keys per environment
- Store secrets in secure key management systems
- Enable 2FA wherever possible
- Regular security audits

## 📊 **SECURITY STATUS**

| Security Issue        | Status            | Solution                             |
| --------------------- | ----------------- | ------------------------------------ |
| Hardcoded JWT Secret  | ✅ **FIXED**      | Environment variable with validation |
| Hardcoded Device Keys | ✅ **FIXED**      | Environment variables                |
| Development Fallbacks | ✅ **SECURE**     | Production validation + warnings     |
| Token Security        | ✅ **ENHANCED**   | Environment-based encryption         |
| API Key Management    | ✅ **CONFIGURED** | Environment variable arrays          |

## 🎯 **PRODUCTION READINESS**

**Your security hardening is now COMPLETE!**

### **Ready for Production:**

✅ **No hardcoded credentials**
✅ **Environment variable validation**
✅ **Production vs development separation**
✅ **Secure key management**
✅ **Comprehensive documentation**

### **Next Steps:**

1. **Set environment variables** in your deployment
2. **Generate strong keys** for production
3. **Configure secrets management** (AWS KMS, HashiCorp Vault, etc.)
4. **Deploy securely** using Docker secrets or environment variables

---

**🎉 Security hardening is complete! Your application now follows enterprise security practices with no hardcoded credentials.**

### Chat Service Resource Controls
- `CHAT_MAX_HEAVY_CONCURRENT` (default `2`) – caps concurrent heavy model requests (HRM/MLX/Ollama/LM Studio).
- `CHAT_MAX_HEAVY_LATENCY` (default `6.0`) – upper bound in seconds for the rolling average latency before heavy calls are paused.

### MLX Generation Controls
- `MLX_TEMPERATURE` (default `0.75`)
- `MLX_TOP_P` (default `0.9`)
- `MLX_TOP_K` (optional, defaults to `40` if set)
- `MLX_MAX_REPETITION_WINDOW` (default `3`) – number of recent lines used when filtering repetitive output.
