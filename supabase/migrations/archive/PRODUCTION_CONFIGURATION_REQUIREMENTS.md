# Universal AI Tools - Production Configuration Requirements

## Table of Contents
1. [Environment Configuration Standards](#environment-configuration-standards)
2. [Service Configuration Requirements](#service-configuration-requirements)
3. [Security Configuration Standards](#security-configuration-standards)
4. [Infrastructure Requirements](#infrastructure-requirements)
5. [Deployment Templates](#deployment-templates)
6. [Configuration Validation](#configuration-validation)

---

## 1. Environment Configuration Standards

### 1.1 Required Environment Variables

These environment variables MUST be set for production deployment:

```bash
# Core Configuration
NODE_ENV=production
PORT=9999
HOST=0.0.0.0

# Database Configuration (REQUIRED)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Never commit!
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Public key

# Security Keys (REQUIRED - Must be generated, not default values)
JWT_SECRET=<64-character-base64-string> # Generate with: openssl rand -base64 64
ENCRYPTION_KEY=<32-character-hex-string> # Generate with: openssl rand -hex 32

# Redis Configuration (REQUIRED for production)
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=<strong-password> # Generate with: openssl rand -base64 32
```

### 1.2 Optional Environment Variables

```bash
# AI Service API Keys (At least one required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
GROQ_API_KEY=gsk_...
COHERE_API_KEY=...

# Local LLM Configuration
OLLAMA_URL=http://ollama:11434
LM_STUDIO_URL=http://localhost:1234
USE_LOCAL_MODELS=true

# Performance Tuning
MAX_CONCURRENT_REQUESTS=20
REQUEST_TIMEOUT=60000
MEMORY_CACHE_SIZE=2000
WORKER_THREADS=4
NODE_OPTIONS=--max-old-space-size=4096

# Monitoring
ENABLE_TELEMETRY=true
LOG_LEVEL=info
ENABLE_METRICS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Resource Limits
MAX_MEMORY_MB=4096
MAX_CPU_PERCENT=90
MAX_CONNECTIONS=200

# Database Pool Configuration
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_ACQUIRE_TIMEOUT=30000
DB_IDLE_TIMEOUT=10000

# Redis Pool Configuration
REDIS_POOL_MIN=2
REDIS_POOL_MAX=10
REDIS_ACQUIRE_TIMEOUT=30000

# Backup Configuration
BACKUP_ENCRYPTION_PASSWORD=<strong-password>
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BACKUP_BUCKET=your-backup-bucket

# Monitoring Services
GRAFANA_USER=admin
GRAFANA_PASSWORD=<strong-password>
PROMETHEUS_RETENTION_DAYS=30
```

### 1.3 Environment Variable Security Rules

1. **Never commit secrets to version control**
2. **Use a secrets management service** (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Rotate keys regularly** (90 days for JWT, 180 days for encryption keys)
4. **Use strong, unique passwords** (minimum 32 characters for production)
5. **Implement key versioning** for zero-downtime rotation

### 1.4 Environment File Template

Create `.env.production` (never commit):

```bash
# Copy from .env.example and fill with production values
# This file should be managed by your deployment system

# Generate secure values with provided scripts:
# ./scripts/generate-production-secrets.sh
```

---

## 2. Service Configuration Requirements

### 2.1 API Service Configuration

```yaml
# Production API Configuration
api:
  replicas: 3  # Minimum for high availability
  resources:
    limits:
      cpu: 2000m
      memory: 4Gi
    requests:
      cpu: 1000m
      memory: 2Gi
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80
  healthCheck:
    path: /api/health
    initialDelaySeconds: 30
    periodSeconds: 10
    timeoutSeconds: 5
    successThreshold: 1
    failureThreshold: 3
  readinessCheck:
    path: /api/ready
    initialDelaySeconds: 5
    periodSeconds: 5
```

### 2.2 Database Configuration

```yaml
# Supabase Connection Configuration
database:
  connection:
    ssl: true
    sslmode: require
    statement_timeout: 30000
    idle_in_transaction_session_timeout: 60000
  pool:
    min: 5
    max: 20
    idleTimeoutMillis: 10000
    connectionTimeoutMillis: 30000
  migrations:
    autoRun: false  # Manual control in production
    validateOnStartup: true
```

### 2.3 Redis Configuration

```yaml
# Redis Cache Configuration
redis:
  cluster:
    enabled: true
    nodes: 3
  persistence:
    enabled: true
    appendonly: yes
    appendfsync: everysec
  maxmemory: 2gb
  maxmemory-policy: allkeys-lru
  security:
    requirepass: ${REDIS_PASSWORD}
    protected-mode: yes
  monitoring:
    latency-monitor-threshold: 100
```

### 2.4 Ollama Configuration

```yaml
# Local LLM Service Configuration
ollama:
  models:
    preload:
      - llama3.2:3b
      - nomic-embed-text
  settings:
    num_parallel: 4
    max_loaded_models: 2
    keep_alive: 5m
  resources:
    gpu: true  # Enable if available
    memory: 8Gi
```

---

## 3. Security Configuration Standards

### 3.1 HTTPS/TLS Configuration

```nginx
# SSL Configuration (nginx.prod.conf)
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# Certificate Management
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
ssl_dhparam /etc/nginx/ssl/dhparam.pem;  # Generate: openssl dhparam -out dhparam.pem 4096
```

### 3.2 Security Headers

```nginx
# Required Security Headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.openai.com https://api.anthropic.com wss:// ws://localhost:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
```

### 3.3 Authentication & Authorization

```yaml
# JWT Configuration
jwt:
  algorithm: RS256  # Use asymmetric for production
  publicKey: /secrets/jwt_public.pem
  privateKey: /secrets/jwt_private.pem
  expiresIn: 24h
  refreshExpiresIn: 7d
  issuer: universal-ai-tools
  audience: universal-ai-tools-api

# Session Configuration
session:
  secure: true
  httpOnly: true
  sameSite: strict
  maxAge: 86400000  # 24 hours
  rolling: true
```

### 3.4 Rate Limiting

```yaml
# Rate Limiting Rules
rateLimiting:
  global:
    windowMs: 900000  # 15 minutes
    max: 100
  endpoints:
    - path: /api/v1/tools/execute
      windowMs: 60000
      max: 20
    - path: /api/auth/*
      windowMs: 900000
      max: 5
    - path: /api/v1/memory/search
      windowMs: 60000
      max: 30
  bypass:
    - 10.0.0.0/8     # Internal network
    - 172.16.0.0/12  # Docker networks
```

### 3.5 API Key Management

```yaml
# API Key Rotation Schedule
apiKeyRotation:
  schedule:
    jwt_secret: 90d
    encryption_key: 180d
    api_keys: 30d
    service_keys: 60d
  notifications:
    email: security@your-domain.com
    slack: "#security-alerts"
  automation:
    enabled: true
    gracePeriod: 7d
```

---

## 4. Infrastructure Requirements

### 4.1 Minimum Hardware Requirements

```yaml
# Production Environment
production:
  nodes: 3  # Minimum for HA
  node_specs:
    cpu: 4 cores
    memory: 16GB
    storage: 100GB SSD
    network: 1Gbps
  
  # Service-specific requirements
  services:
    api:
      instances: 3
      cpu: 2 cores
      memory: 4GB
    redis:
      instances: 3 (cluster)
      memory: 2GB each
    ollama:
      instances: 1
      memory: 8GB
      gpu: optional (recommended)
    monitoring:
      prometheus: 2GB
      grafana: 1GB
```

### 4.2 Network Configuration

```yaml
# Network Security
network:
  ingress:
    - port: 443
      protocol: TCP
      source: 0.0.0.0/0
    - port: 80
      protocol: TCP
      source: 0.0.0.0/0
      action: redirect_to_https
  
  egress:
    # Restrict outbound traffic
    - destination: supabase.co
      ports: [443]
    - destination: api.openai.com
      ports: [443]
    - destination: api.anthropic.com
      ports: [443]
  
  internal:
    subnet: 172.31.0.0/16
    security_groups:
      - name: api-backend
        rules:
          - from: load-balancer
            ports: [9999]
      - name: redis-cluster
        rules:
          - from: api-backend
            ports: [6379]
```

### 4.3 Storage Requirements

```yaml
# Persistent Storage
storage:
  volumes:
    - name: logs
      size: 50GB
      type: SSD
      backup: daily
      retention: 30d
    
    - name: models
      size: 100GB
      type: SSD
      backup: weekly
    
    - name: redis-data
      size: 20GB
      type: SSD
      backup: hourly
      replication: true
    
    - name: backups
      size: 500GB
      type: HDD
      retention: 90d
      encryption: AES-256
```

### 4.4 Backup Strategy

```yaml
# Backup Configuration
backup:
  schedule:
    database: 
      frequency: hourly
      retention: 48h
      full_backup: daily
    
    application:
      frequency: daily
      retention: 7d
    
    configurations:
      frequency: on_change
      retention: 30d
  
  storage:
    primary: s3://your-backup-bucket/
    secondary: glacier://your-archive-bucket/
    
  encryption:
    algorithm: AES-256-GCM
    key_management: AWS KMS
  
  testing:
    restore_test: weekly
    integrity_check: daily
```

---

## 5. Deployment Templates

### 5.1 Docker Compose Production Template

See `docker-compose.prod.yml` in the repository.

### 5.2 Kubernetes Deployment Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: universal-ai-tools-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: universal-ai-tools-api
  template:
    metadata:
      labels:
        app: universal-ai-tools-api
    spec:
      containers:
      - name: api
        image: universal-ai-tools:latest
        ports:
        - containerPort: 9999
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: universal-ai-tools-secrets
        resources:
          limits:
            cpu: 2000m
            memory: 4Gi
          requests:
            cpu: 1000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 9999
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 9999
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 5.3 Systemd Service Template

```ini
[Unit]
Description=Universal AI Tools API Service
After=network.target redis.service
Requires=redis.service

[Service]
Type=notify
ExecStart=/usr/local/bin/node /opt/universal-ai-tools/dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=universal-ai-tools
User=aitools
Group=aitools
Environment="NODE_ENV=production"
EnvironmentFile=/etc/universal-ai-tools/production.env

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/universal-ai-tools /var/lib/universal-ai-tools

# Resource Limits
LimitNOFILE=65535
LimitNPROC=4096
MemoryLimit=4G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

---

## 6. Configuration Validation

### 6.1 Pre-deployment Checklist

```bash
#!/bin/bash
# Production Deployment Validation Script

echo "Universal AI Tools - Production Configuration Validator"
echo "======================================================"

# Check required environment variables
REQUIRED_VARS=(
  "NODE_ENV"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_KEY"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
  "REDIS_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  else
    echo "✅ $var is set"
  fi
done

# Validate JWT_SECRET strength
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "❌ JWT_SECRET is too short (minimum 32 characters)"
  exit 1
fi

# Validate ENCRYPTION_KEY strength
if [ ${#ENCRYPTION_KEY} -lt 32 ]; then
  echo "❌ ENCRYPTION_KEY is too short (minimum 32 characters)"
  exit 1
fi

# Check for default values
if [[ "$JWT_SECRET" == *"your-jwt-secret"* ]] || [[ "$JWT_SECRET" == *"example"* ]]; then
  echo "❌ JWT_SECRET contains default/example value"
  exit 1
fi

# Test database connection
echo "Testing database connection..."
node -e "
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  supabase.from('ai_memories').select('count').limit(1)
    .then(() => console.log('✅ Database connection successful'))
    .catch(err => { console.error('❌ Database connection failed:', err.message); process.exit(1); });
"

# Test Redis connection
echo "Testing Redis connection..."
redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Redis connection successful"
else
  echo "❌ Redis connection failed"
  exit 1
fi

echo ""
echo "✅ All configuration checks passed!"
```

### 6.2 Health Check Endpoints

```typescript
// Required health check implementations
interface HealthCheckEndpoints {
  '/api/health': {
    // Basic liveness check
    checks: ['api_responsive'];
  };
  
  '/api/ready': {
    // Comprehensive readiness check
    checks: [
      'database_connected',
      'redis_connected',
      'ollama_available',
      'required_models_loaded',
      'disk_space_available',
      'memory_within_limits'
    ];
  };
  
  '/api/health/detailed': {
    // Detailed health report (internal only)
    checks: [
      'all_services',
      'performance_metrics',
      'error_rates',
      'resource_usage',
      'dependency_status'
    ];
  };
}
```

### 6.3 Monitoring Requirements

```yaml
# Prometheus Metrics to Track
metrics:
  required:
    - http_requests_total
    - http_request_duration_seconds
    - http_request_size_bytes
    - http_response_size_bytes
    - nodejs_memory_usage_bytes
    - nodejs_cpu_usage_percent
    - nodejs_event_loop_lag_seconds
    - database_connections_active
    - database_connections_idle
    - redis_connections_active
    - redis_memory_usage_bytes
    - llm_inference_duration_seconds
    - llm_token_usage_total
    
  alerts:
    - name: HighErrorRate
      threshold: 5%
      duration: 5m
    
    - name: HighMemoryUsage
      threshold: 85%
      duration: 10m
    
    - name: DatabaseConnectionPoolExhausted
      threshold: 90%
      duration: 2m
    
    - name: SlowResponseTime
      threshold: 5s
      duration: 5m
```

### 6.4 Security Audit Requirements

```bash
# Security audit script
#!/bin/bash

echo "Running security audit..."

# Check for security vulnerabilities
npm audit --production

# Check for outdated dependencies
npm outdated

# Scan for secrets in code
git secrets --scan

# Validate SSL configuration
nmap --script ssl-enum-ciphers -p 443 localhost

# Check file permissions
find . -type f -perm 0777 -exec ls -l {} \;

# Verify no hardcoded secrets
grep -r "api_key\|secret\|password" --include="*.js" --include="*.ts" --exclude-dir=node_modules .
```

---

## Deployment Commands

### Quick Production Deployment

```bash
# 1. Validate configuration
./scripts/validate-production-config.sh

# 2. Build production image
docker build -f Dockerfile.prod -t universal-ai-tools:latest .

# 3. Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# 4. Run post-deployment checks
./scripts/post-deployment-checks.sh
```

### Production Checklist

- [ ] All environment variables configured
- [ ] Secrets stored in secure vault
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Monitoring alerts set up
- [ ] Backup system tested
- [ ] Disaster recovery plan documented
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

---

## Support

For production deployment support:
- Review logs in `/var/log/universal-ai-tools/`
- Check metrics at `https://your-domain/metrics` (internal only)
- Monitor dashboard at `https://your-domain:3000` (Grafana)
- Alert notifications configured in monitoring section