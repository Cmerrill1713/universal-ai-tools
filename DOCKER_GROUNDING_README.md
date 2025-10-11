# 🐳 Universal AI Tools - Docker Grounding System

## Overview

The Docker Grounding System provides comprehensive monitoring, security, compliance, and reliability capabilities for the Universal AI Tools platform. It ensures production-ready operations with automated recovery, security scanning, data governance, and AI-specific monitoring.

## 🚀 Quick Start

### 1. Start All Grounding Services

```bash
# Start with default profiles (security, monitoring, reliability, data-governance)
./scripts/start-grounding.sh

# Start with all profiles including AI governance
./scripts/start-grounding.sh --profiles "all"

# Start with specific profiles
./scripts/start-grounding.sh --profiles "security monitoring"
```

### 2. Start Individual Components

```bash
# Security & Compliance
docker-compose -f docker-compose.grounding.yml --profile security up -d

# Monitoring & Observability
docker-compose -f docker-compose.grounding.yml --profile monitoring up -d

# AI Governance
docker-compose -f docker-compose.grounding.yml --profile ai-governance up -d
```

## 📊 Available Services

### Security & Compliance

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Trivy Scanner** | - | Container vulnerability scanning | 🔍 |
| **OPA Policy Engine** | 8181 | Policy enforcement | 🛡️ |
| **Falco Runtime Security** | 5060 | Runtime threat detection | 🔒 |

### Monitoring & Observability

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Prometheus (Grounded)** | 9091 | Metrics collection | 📈 |
| **Loki (Grounded)** | 3101 | Log aggregation | 📝 |
| **AI Metrics Exporter** | 9092 | AI-specific metrics | 🤖 |
| **Health Monitor** | 8080 | Service health & auto-recovery | ❤️ |

### Reliability & Performance

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Circuit Breaker** | 8083 | Failure protection | ⚡ |
| **Auto-Scaler** | - | Dynamic scaling | 📊 |
| **Performance Benchmark** | - | Load testing | 🏃 |

### Data Governance

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Backup Service** | - | Automated backups | 💾 |
| **Data Integrity** | - | Data validation | ✅ |
| **Audit Trail** | 8086 | AI decision logging | 📋 |

### AI Governance

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| **Model Monitor** | 8084 | AI model performance | 🧠 |
| **Bias Detector** | 8085 | AI bias detection | ⚖️ |

## 🔧 Configuration

### Environment Variables

```bash
# Security
TRIVY_CACHE_DIR=/root/.cache/trivy
OPA_LOG_LEVEL=info
FALCO_GRPC_ENABLED=true

# Monitoring
EXPORT_INTERVAL=10s
METRICS_PORT=9092
LOG_LEVEL=info

# Reliability
CHECK_INTERVAL=30s
FAILURE_THRESHOLD=3
RECOVERY_ACTION=restart

# Backup
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
RETENTION_DAYS=30
BACKUP_ENCRYPTION=true
```

### Configuration Files

- **AI Services**: `monitoring/config/ai-services.yml`
- **Health Checks**: `monitoring/config/health-checks.yml`
- **Falco Rules**: `security/falco/falco.yaml`
- **Prometheus**: `monitoring/prometheus/prometheus-grounded.yml`
- **Loki**: `monitoring/loki/loki-grounded.yml`

## 📈 Monitoring Dashboards

### Prometheus Metrics

Access Prometheus at: http://localhost:9091

**Key Metrics:**
- `ai_service_health` - Service health status
- `ai_model_response_time_seconds` - Model inference time
- `ai_requests_total` - Request counters
- `ai_errors_total` - Error tracking
- `ai_self_corrections_total` - Self-correction metrics

### Log Aggregation

Access Loki at: http://localhost:3101

**Log Streams:**
- AI service logs
- Security events
- Performance metrics
- Error tracking

### Health Monitoring

Access Health Monitor at: http://localhost:8080

**Endpoints:**
- `/health` - Monitor health
- `/status` - Service status overview
- `/services` - Service configuration

## 🔒 Security Features

### Vulnerability Scanning

```bash
# Run security scan
docker-compose -f docker-compose.grounding.yml run --rm trivy-scanner

# View scan results
ls -la security/reports/
```

### Runtime Security

Falco monitors for:
- Unauthorized AI service access
- Model file tampering
- Container escape attempts
- Privilege escalation

### Policy Enforcement

OPA enforces policies for:
- Resource access control
- Data privacy compliance
- Security configurations
- Operational policies

## 💾 Backup & Recovery

### Automated Backups

```bash
# Backup runs daily at 2 AM
# Manual backup trigger
docker-compose -f docker-compose.grounding.yml exec backup-service /backup.sh
```

**Backup Includes:**
- PostgreSQL database
- Redis data
- Application logs
- Docker volumes
- Configuration files

### Data Integrity

```bash
# Run integrity check
docker-compose -f docker-compose.grounding.yml exec data-integrity /integrity-check.sh
```

## 🤖 AI-Specific Monitoring

### Model Performance

- Response time tracking
- Accuracy monitoring
- Resource usage
- Error rates
- Bias detection

### Self-Correction Metrics

- Correction frequency
- Success rates
- Quality improvements
- Trigger analysis

## 🧪 Testing & Performance

### Load Testing

```bash
# Run load tests
docker-compose -f docker-compose.grounding.yml --profile testing run --rm k6-load-tester

# Performance benchmarks
docker-compose -f docker-compose.grounding.yml --profile testing run --rm performance-benchmark
```

## 📋 Management Commands

### Service Management

```bash
# View all services
docker-compose -f docker-compose.grounding.yml ps

# View logs
docker-compose -f docker-compose.grounding.yml logs -f [service-name]

# Restart service
docker-compose -f docker-compose.grounding.yml restart [service-name]

# Scale service
docker-compose -f docker-compose.grounding.yml up -d --scale [service-name]=3
```

### Health Checks

```bash
# Check all services
curl http://localhost:8080/status

# Check specific service
curl http://localhost:9091/-/healthy  # Prometheus
curl http://localhost:3101/ready      # Loki
curl http://localhost:9092/metrics    # AI Metrics
```

### Security Operations

```bash
# View security logs
docker-compose -f docker-compose.grounding.yml logs falco

# Check OPA policies
curl http://localhost:8181/v1/policies

# Run vulnerability scan
docker-compose -f docker-compose.grounding.yml run --rm trivy-scanner
```

## 🔧 Troubleshooting

### Common Issues

**1. Services Not Starting**
```bash
# Check Docker daemon
docker info

# Check ports
netstat -tulpn | grep :9091

# View service logs
docker-compose -f docker-compose.grounding.yml logs [service-name]
```

**2. Health Check Failures**
```bash
# Check service connectivity
curl -v http://localhost:8010/health

# Check health monitor logs
docker-compose -f docker-compose.grounding.yml logs health-monitor
```

**3. Metrics Not Appearing**
```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets

# Check AI metrics exporter
curl http://localhost:9092/metrics
```

### Log Locations

- **Application Logs**: `logs/`
- **Security Logs**: `logs/falco/`
- **Backup Logs**: `logs/backup/`
- **Health Monitor**: `logs/health-monitor/`

## 📚 Advanced Configuration

### Custom Metrics

Add custom AI metrics in `monitoring/exporters/ai-metrics/main.go`:

```go
var customMetric = prometheus.NewGaugeVec(
    prometheus.GaugeOpts{
        Name: "ai_custom_metric",
        Help: "Custom AI metric",
    },
    []string{"service", "model"},
)
```

### Custom Health Checks

Add services to `monitoring/config/health-checks.yml`:

```yaml
services:
  - name: "custom-service"
    url: "http://localhost:8080"
    health_path: "/health"
    timeout: 5
    retries: 3
    critical: true
```

### Custom Security Rules

Add Falco rules in `security/falco/falco.yaml`:

```yaml
custom_rules:
  - rule: Custom Security Rule
    desc: Detect custom security event
    condition: (spawned_process and proc.name in (suspicious_command))
    output: Custom security event detected
    priority: WARNING
```

## 🚀 Production Deployment

### Resource Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8GB
- Disk: 100GB SSD

**Recommended:**
- CPU: 8 cores
- RAM: 16GB
- Disk: 500GB SSD

### Security Considerations

1. **Network Security**
   - Use internal networks
   - Restrict external access
   - Enable TLS/SSL

2. **Access Control**
   - Use strong passwords
   - Enable 2FA where possible
   - Regular access reviews

3. **Data Protection**
   - Encrypt backups
   - Secure log storage
   - Regular security scans

### Scaling

```bash
# Scale monitoring services
docker-compose -f docker-compose.grounding.yml up -d --scale ai-metrics-exporter=2

# Scale health monitoring
docker-compose -f docker-compose.grounding.yml up -d --scale health-monitor=3
```

## 📞 Support

### Getting Help

1. **Check Logs**: Always check service logs first
2. **Health Status**: Use health endpoints to diagnose issues
3. **Documentation**: Refer to this README and inline comments
4. **Community**: Join our Discord for support

### Reporting Issues

When reporting issues, include:
- Service logs
- Configuration files
- Environment details
- Steps to reproduce

---

## 🎯 Next Steps

1. **Start with basics**: Security + Monitoring profiles
2. **Add AI governance**: Enable AI-specific monitoring
3. **Configure alerts**: Set up notification webhooks
4. **Customize metrics**: Add application-specific metrics
5. **Scale as needed**: Add more instances for high availability

The Docker Grounding System provides enterprise-grade reliability and observability for your AI infrastructure. Start with the basics and gradually enable more advanced features as needed.
