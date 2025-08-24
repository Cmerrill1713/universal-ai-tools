# Universal AI Tools - Production Monitoring Guide

## Overview

This guide covers the comprehensive monitoring and alerting infrastructure for Universal AI Tools in production environments. The monitoring stack includes Prometheus for metrics collection, Grafana for visualization, and Alertmanager for alert routing.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │   Prometheus    │    │     Grafana     │
│                 │───▶│   (Metrics)     │───▶│  (Dashboards)   │
│  - API Server   │    │                 │    │                 │
│  - Background   │    │  - Time Series  │    │  - Alerts       │
│    Jobs         │    │  - Alerting     │    │  - Analytics    │
│  - Services     │    │  - Retention    │    │  - Reports      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │              │  Alertmanager   │             │
         │              │                 │             │
         └──────────────▶│  - Routing      │◀────────────┘
                        │  - Grouping     │
                        │  - Silencing    │
                        │  - Notifications│
                        └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
            ┌───────▼───┐ ┌──────▼──────┐ ┌──▼────┐
            │   Email   │ │    Slack    │ │Webhook│
            │Notifications│ │Notifications│ │ API   │
            └───────────┘ └─────────────┘ └───────┘
```

## Components

### 1. Prometheus (Metrics Collection)
- **Port**: 9090
- **Purpose**: Time-series metrics collection and alerting
- **Retention**: 30 days
- **Scrape Interval**: 15 seconds

### 2. Grafana (Visualization)
- **Port**: 3000
- **Purpose**: Dashboards, visualization, and alerting UI
- **Default Login**: admin / admin123 (configurable)
- **Data Source**: Prometheus

### 3. Alertmanager (Alert Routing)
- **Port**: 9093
- **Purpose**: Alert routing, grouping, and notifications
- **Integrations**: Email, Slack, Webhook

### 4. Node Exporter (System Metrics)
- **Port**: 9100
- **Purpose**: System-level metrics (CPU, memory, disk, network)

### 5. cAdvisor (Container Metrics)
- **Port**: 8080
- **Purpose**: Container resource usage and performance

### 6. Redis Exporter (Cache Metrics)
- **Port**: 9121
- **Purpose**: Redis performance and usage metrics

## Setup Instructions

### Quick Start

1. **Initialize Monitoring Stack**:
   ```bash
   ./scripts/monitoring-setup.sh
   ```

2. **Start Services**:
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

3. **Verify Setup**:
   ```bash
   ./scripts/health-check.sh
   ```

### Manual Setup

1. **Configure Environment**:
   ```bash
   cp .env.production.template .env.production
   # Edit .env.production with your settings
   ```

2. **Setup Directories**:
   ```bash
   mkdir -p monitoring/{prometheus,grafana,alertmanager}/data
   chmod -R 755 monitoring/
   ```

3. **Start Individual Services**:
   ```bash
   # Prometheus
   docker-compose -f docker-compose.monitoring.yml up -d prometheus
   
   # Grafana
   docker-compose -f docker-compose.monitoring.yml up -d grafana
   
   # Alertmanager
   docker-compose -f docker-compose.monitoring.yml up -d alertmanager
   ```

## Key Metrics

### Application Metrics
- **HTTP Request Rate**: `rate(http_requests_total[5m])`
- **Response Time**: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- **Error Rate**: `rate(http_requests_total{status=~"5.."}[5m])`
- **Active Connections**: `http_connections_active`

### System Metrics
- **CPU Usage**: `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- **Memory Usage**: `(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100`
- **Disk Usage**: `100 - ((node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100)`
- **Network I/O**: `rate(node_network_receive_bytes_total[5m])`

### AI/ML Specific Metrics
- **Model Loading Time**: `ai_model_loading_duration_seconds`
- **Request Queue Size**: `ai_request_queue_size`
- **Vector Search Latency**: `vector_search_duration_seconds`
- **Token Processing Rate**: `ai_tokens_processed_per_second`

### Database Metrics
- **Query Response Time**: `database_query_duration_seconds`
- **Connection Pool Usage**: `database_connections_active / database_connections_max`
- **Cache Hit Rate**: `database_cache_hits / database_cache_total`

## Alerting Rules

### Critical Alerts
- **API Down**: Service unavailable for > 1 minute
- **High Error Rate**: > 5% error rate for > 5 minutes
- **Low Disk Space**: < 15% free space
- **High Memory Usage**: > 85% for > 5 minutes
- **Database Connection Failures**: > 10 failures in 5 minutes

### Warning Alerts
- **High API Latency**: P95 > 1 second for > 5 minutes
- **High CPU Usage**: > 80% for > 10 minutes
- **High Redis Memory**: > 90% for > 5 minutes
- **Slow Database Queries**: P95 > 5 seconds for > 5 minutes

## Dashboards

### 1. Universal AI Tools Overview
- **Path**: `/d/universal-ai-tools-overview`
- **Panels**:
  - API Request Rate
  - Response Time (P95)
  - CPU & Memory Usage
  - Service Health Status

### 2. System Resources
- **Focus**: Infrastructure monitoring
- **Metrics**: CPU, Memory, Disk, Network

### 3. Application Performance
- **Focus**: API and service performance
- **Metrics**: Latency, throughput, errors

### 4. AI/ML Operations
- **Focus**: AI model performance
- **Metrics**: Model loading, inference time, queue size

## Configuration

### Environment Variables

```bash
# Grafana
GRAFANA_PASSWORD=your-secure-password
GRAFANA_SECRET_KEY=your-secret-key

# Alerting
SMTP_HOST=smtp.example.com
SMTP_USER=alerts@your-domain.com
SMTP_PASSWORD=your-smtp-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Monitoring
PROMETHEUS_RETENTION=30d
METRICS_SCRAPE_INTERVAL=15s
```

### Alertmanager Configuration

```yaml
# Example: monitoring/alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@your-domain.com'

receivers:
  - name: 'critical-alerts'
    email_configs:
      - to: 'admin@your-domain.com'
        subject: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK'
        channel: '#alerts'
```

### Prometheus Targets

```yaml
# Example: monitoring/prometheus.yml
scrape_configs:
  - job_name: 'universal-ai-tools-api'
    static_configs:
      - targets: ['api:9999']
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

## Management Commands

### Service Management
```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Stop monitoring stack
docker-compose -f docker-compose.monitoring.yml down

# Restart specific service
docker-compose -f docker-compose.monitoring.yml restart prometheus

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

### Health Checks
```bash
# Complete health check
./scripts/health-check.sh

# Monitoring status
./scripts/monitoring-status.sh

# Validate setup
./scripts/monitoring-setup.sh --validate
```

### Data Management
```bash
# Backup Prometheus data
docker run --rm -v prometheus-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup.tar.gz /data

# Restore Prometheus data
docker run --rm -v prometheus-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/prometheus-backup.tar.gz -C /
```

## Troubleshooting

### Common Issues

1. **Prometheus Not Scraping Targets**
   ```bash
   # Check targets page: http://localhost:9090/targets
   # Verify network connectivity
   docker network ls
   docker inspect monitoring_monitoring
   ```

2. **Grafana Dashboards Not Loading**
   ```bash
   # Check provisioning
   docker-compose -f docker-compose.monitoring.yml logs grafana
   # Verify data source configuration
   curl http://localhost:3000/api/datasources
   ```

3. **Alerts Not Firing**
   ```bash
   # Check alert rules
   curl http://localhost:9090/api/v1/rules
   # Verify alertmanager configuration
   curl http://localhost:9093/api/v1/status
   ```

### Performance Tuning

1. **Prometheus Storage**
   ```yaml
   # Increase retention
   command:
     - '--storage.tsdb.retention.time=90d'
     - '--storage.tsdb.retention.size=50GB'
   ```

2. **Grafana Performance**
   ```ini
   [database]
   max_idle_conn = 25
   max_open_conn = 300
   
   [server]
   enable_gzip = true
   ```

## Security Considerations

### Authentication
- Change default Grafana password
- Use strong passwords for all services
- Enable HTTPS for external access

### Network Security
- Restrict external access to monitoring ports
- Use internal networks for service communication
- Implement proper firewall rules

### Data Protection
- Regular backups of monitoring data
- Encrypt sensitive configuration
- Monitor access logs

## Best Practices

1. **Alert Fatigue Prevention**
   - Use appropriate thresholds
   - Implement alert grouping
   - Set up escalation policies

2. **Dashboard Design**
   - Focus on key metrics
   - Use consistent color schemes
   - Include contextual information

3. **Metric Collection**
   - Collect metrics at appropriate intervals
   - Use labels effectively
   - Avoid high cardinality metrics

4. **Capacity Planning**
   - Monitor storage usage
   - Plan for metric growth
   - Regular performance reviews

## Advanced Features

### Custom Metrics
```javascript
// Example: Custom application metrics
const promClient = require('prom-client');

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const aiRequestDuration = new promClient.Histogram({
  name: 'ai_request_duration_seconds',
  help: 'AI request duration',
  labelNames: ['model', 'operation']
});
```

### Log Integration
```yaml
# Example: Loki for log aggregation
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  command: -config.file=/etc/loki/local-config.yaml
```

### External Integrations
- **PagerDuty**: For incident management
- **Datadog**: For additional monitoring
- **New Relic**: For APM integration
- **Sentry**: For error tracking

## Support

### Documentation
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

### Community
- Prometheus Slack: `#prometheus-users`
- Grafana Community Forum
- Universal AI Tools Discord

---

**Last Updated**: Production Monitoring Setup v1.0
**Maintainer**: Universal AI Tools Team