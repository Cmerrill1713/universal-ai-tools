# Universal AI Tools - Production Deployment Guide

## Prerequisites

### System Requirements
- Node.js 18+ (LTS recommended)
- PostgreSQL 14+ (for Supabase)
- Redis 6+ (optional, with fallback)
- 4GB+ RAM minimum
- 20GB+ disk space

### Required Services
- Ollama (for local LLM inference)
- Supabase instance (cloud or self-hosted)
- Optional: OpenAI/Anthropic API keys

## Environment Configuration

### 1. Create Production Environment File
```bash
cp .env.example .env.production
```

### 2. Configure Essential Variables
```env
# Server Configuration
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Security (generate strong secrets)
JWT_SECRET=<generate-with-openssl-rand-base64-32>
ENCRYPTION_KEY=<generate-with-openssl-rand-base64-32>
API_KEY_SALT=<generate-with-openssl-rand-base64-16>

# Database
DATABASE_URL=postgresql://user:password@host:5432/universal_ai_tools
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Redis (optional - will fallback to in-memory)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# LLM Services
OLLAMA_URL=http://localhost:11434
OPENAI_API_KEY=sk-... (optional)
ANTHROPIC_API_KEY=sk-ant-... (optional)

# Monitoring
TELEMETRY_ENABLED=true
LOG_LEVEL=info
```

## Database Setup

### 1. Initialize Database
```bash
# Run all migrations
npm run migrate

# Verify migration status
npm run migrate:status
```

### 2. Create Backup Strategy
```bash
# Create initial backup
npm run backup:create

# Schedule regular backups (cron)
0 2 * * * cd /path/to/universal-ai-tools && npm run backup:create
```

## Production Build

### 1. Install Dependencies
```bash
# Install production dependencies only
npm ci --production

# Or with all dependencies for building
npm ci
```

### 2. Build Application
```bash
# Create production build
npm run build:prod

# Verify build
npm run type-check
```

### 3. Optimize for Production
```bash
# Remove dev dependencies after build
npm prune --production

# Clear caches
npm cache clean --force
```

## Deployment Options

### Option 1: PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 config
pm2 save
pm2 startup

# Monitor
pm2 monit
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'universal-ai-tools',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    max_memory_restart: '2G',
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    max_restarts: 10,
    min_uptime: '10s',
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};
```

### Option 2: Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application
COPY . .

# Build
RUN npm run build:prod

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start
CMD ["node", "dist/server.js"]
```

### Option 3: Systemd Service
```ini
[Unit]
Description=Universal AI Tools Service
After=network.target

[Service]
Type=simple
User=nodeuser
WorkingDirectory=/opt/universal-ai-tools
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=universal-ai-tools
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Nginx Configuration

```nginx
upstream universal_ai_tools {
    server localhost:8080;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-cert.crt;
    ssl_certificate_key /etc/ssl/private/your-key.key;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://universal_ai_tools;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # API routes
    location / {
        proxy_pass http://universal_ai_tools;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_connect_timeout 10s;
    }

    # Static files (if any)
    location /static {
        alias /opt/universal-ai-tools/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## Monitoring Setup

### 1. Health Checks
```bash
# Basic health check
curl https://your-domain.com/health

# Detailed health (when monitoring routes load)
curl https://your-domain.com/api/v1/monitoring/health/detailed

# Circuit breakers status
curl https://your-domain.com/api/v1/monitoring/circuit-breakers
```

### 2. Log Management
```bash
# Create log directory
mkdir -p logs

# Configure log rotation
cat > /etc/logrotate.d/universal-ai-tools << EOF
/opt/universal-ai-tools/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodeuser nodeuser
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### 3. Monitoring with Prometheus (Optional)
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'universal-ai-tools'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

## Security Hardening

### 1. API Key Management
```bash
# Generate API keys for clients
node scripts/generate-api-key.js --name "client-name"

# Store in environment
export CLIENT_API_KEY=generated-key
```

### 2. Rate Limiting
- Configure in middleware/rate-limiter.ts
- Default: 100 requests per 15 minutes per IP
- Adjust based on your needs

### 3. CORS Configuration
```javascript
// In production, specify exact origins
const corsOptions = {
  origin: ['https://your-frontend.com'],
  credentials: true
};
```

## Performance Optimization

### 1. Enable Clustering
```javascript
// PM2 handles this automatically with instances: 'max'
// Or implement manually in server.ts
```

### 2. Redis Caching
```bash
# Ensure Redis is running
redis-cli ping

# Monitor Redis
redis-cli monitor
```

### 3. Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_memories_user_created ON ai_memories(user_id, created_at DESC);
CREATE INDEX idx_agent_performance_name ON agent_performance_metrics(agent_name, timestamp DESC);
```

## Startup Checklist

1. **Pre-flight Checks**
   - [ ] Environment variables configured
   - [ ] Database migrations completed
   - [ ] Redis running (optional)
   - [ ] Ollama service available
   - [ ] SSL certificates installed

2. **Start Services**
   ```bash
   # Start in order
   systemctl start postgresql
   systemctl start redis
   systemctl start ollama
   pm2 start ecosystem.config.js --env production
   ```

3. **Verify Operation**
   ```bash
   # Check health
   curl http://localhost:8080/health
   
   # Test agent execution
   curl -X POST http://localhost:8080/api/v1/agents/execute \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-api-key" \
     -d '{"agentName": "planner", "userRequest": "test", "context": {}}'
   ```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   lsof -i :8080
   kill -9 <PID>
   ```

2. **Memory Issues**
   - Increase Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096"`
   - Enable swap if needed
   - Monitor with: `pm2 monit`

3. **Database Connection**
   - Check PostgreSQL logs: `tail -f /var/log/postgresql/*.log`
   - Verify connection string
   - Check firewall rules

4. **Ollama Not Responding**
   - Check Ollama status: `systemctl status ollama`
   - Verify models loaded: `ollama list`
   - Check port accessibility

### Debug Mode
```bash
# Run with debug logging
LOG_LEVEL=debug npm start

# Or with PM2
pm2 start ecosystem.config.js --env production --log-type json
```

## Backup and Recovery

### Automated Backups
```bash
# Setup cron job
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/universal-ai-tools/scripts/backup-production.sh
```

### Recovery Procedure
```bash
# Stop services
pm2 stop all

# Restore database
pg_restore -d universal_ai_tools backup_file.sql

# Restart services
pm2 restart all
```

## Scaling Considerations

### Horizontal Scaling
- Use PM2 cluster mode
- Add load balancer (HAProxy/Nginx)
- Separate database to dedicated server
- Use Redis cluster for caching

### Vertical Scaling
- Upgrade server resources
- Increase Node.js memory limits
- Optimize database queries
- Enable query caching

## Maintenance

### Regular Tasks
- Monitor logs daily
- Update dependencies monthly
- Review security patches
- Analyze performance metrics
- Clean old logs and backups

### Update Procedure
```bash
# Create backup
npm run backup:create

# Pull updates
git pull origin main

# Install dependencies
npm ci

# Run migrations
npm run migrate

# Build
npm run build:prod

# Restart
pm2 reload all
```

## Support

For production support:
- Check logs first: `pm2 logs`
- Review health endpoint
- Check circuit breaker status
- Monitor resource usage

Remember: Universal AI Tools includes self-healing capabilities through circuit breakers and graceful degradation, making it highly suitable for production deployments.