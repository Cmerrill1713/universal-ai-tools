# Universal AI Tools - Monitoring Quick Reference

## 🚀 Quick Start Commands

```bash
# Setup monitoring (first time only)
./scripts/setup-monitoring.sh

# Start monitoring stack
./start-monitoring.sh

# Check health of all monitoring services
./check-monitoring-health.sh

# Stop monitoring stack
docker-compose -f docker-compose.telemetry.yml down

# View logs
docker-compose -f docker-compose.telemetry.yml logs -f [service-name]
```

## 📊 Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3003 | admin / (see .env.monitoring) |
| **Prometheus** | http://localhost:9090 | No auth |
| **Alertmanager** | http://localhost:9093 | No auth |
| **Jaeger** | http://localhost:16686 | No auth |
| **API Metrics** | http://localhost:9999/metrics | No auth |

## 🔍 Common Prometheus Queries

### System Health

```promql
# Service uptime
up{job="universal-ai-tools"}

# System health score
system_health_score

# Memory usage
memory_usage_bytes{type="rss"} / 1024 / 1024 / 1024

# CPU usage
cpu_usage_percent

# HTTP request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100
```

### Sweet Athena Metrics

```promql
# Athena interaction rate
rate(athena_interactions_total[5m])

# Athena response time
histogram_quantile(0.95, rate(athena_response_time_seconds_bucket[5m]))

# User satisfaction
avg(athena_user_satisfaction)

# Sweetness level
athena_sweetness_level
```

### Database Performance

```promql
# Active connections
database_connections_active

# Query duration
histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))

# Database errors
rate(database_errors_total[5m])
```

## 🚨 Alert Status Checks

### Check Active Alerts
- **URL**: http://localhost:9093/#/alerts
- **CLI**: `curl -s http://localhost:9093/api/v1/alerts | jq`

### Check Alert Rules
- **URL**: http://localhost:9090/alerts
- **CLI**: `curl -s http://localhost:9090/api/v1/rules | jq`

### Test Alert

```bash
# Trigger a test alert
curl -XPOST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "summary": "Test alert from command line"
    }
  }]'
```

## 📋 Health Check Procedures

### Daily Health Check

```bash
# 1. Check all services are running
./check-monitoring-health.sh

# 2. Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health != "up")'

# 3. Check recent alerts
curl -s http://localhost:9093/api/v1/alerts | jq '.data[] | select(.state == "active")'

# 4. Check disk space
df -h

# 5. Check container resource usage
docker stats --no-stream
```

### Weekly Maintenance

```bash
# 1. Clean up old metrics data (if needed)
# Prometheus retains data for 30 days by default

# 2. Backup Grafana dashboards
docker exec grafana grafana-cli admin export-dashboard

# 3. Check log file sizes
du -sh logs/

# 4. Review and update alert rules if needed
```

## 🐛 Troubleshooting

### Common Issues

**Issue: Metrics not showing in Grafana**

```bash
# Check Prometheus is scraping the API
curl http://localhost:9090/api/v1/targets

# Check if metrics endpoint is working
curl http://localhost:9999/metrics | head -20

# Check Grafana datasource
curl -u admin:password http://localhost:3003/api/datasources
```

**Issue: Alerts not firing**

```bash
# Check alert rules are loaded
curl http://localhost:9090/api/v1/rules

# Check Alertmanager config
docker exec alertmanager cat /etc/alertmanager/alertmanager.yml

# Check alert routing
curl http://localhost:9093/api/v1/status
```

**Issue: High memory usage**

```bash
# Check container memory usage
docker stats

# Check Prometheus metrics retention
curl http://localhost:9090/api/v1/status/tsdb

# Clean up if necessary
docker system prune -f
```

### Service Restart Commands

```bash
# Restart individual services
docker-compose -f docker-compose.telemetry.yml restart prometheus
docker-compose -f docker-compose.telemetry.yml restart grafana
docker-compose -f docker-compose.telemetry.yml restart alertmanager

# Restart all monitoring services
docker-compose -f docker-compose.telemetry.yml restart
```

## 📈 Performance Monitoring

### Key Metrics to Watch

1. **API Response Time**: < 2 seconds (95th percentile)
2. **Error Rate**: < 1%
3. **Sweet Athena Response Time**: < 5 seconds
4. **Database Query Time**: < 1 second (95th percentile)
5. **Memory Usage**: < 80% of available
6. **CPU Usage**: < 80%
7. **Disk Usage**: < 85%

### Performance Dashboards

- **Overview**: Universal AI Tools Dashboard
- **Sweet Athena**: Sweet Athena Dashboard
- **System**: System Performance Dashboard

## 🔐 Security Monitoring

### Security Alerts to Monitor

- Authentication failures
- Rate limiting hits
- Suspicious activity
- Unusual traffic patterns

### Security Queries

```promql
# Authentication failures
rate(authentication_attempts_total{status="failed"}[5m])

# Rate limit hits
rate(rate_limit_hits_total[5m])

# Security events
rate(security_events_total[5m])
```

## 📱 Mobile/Remote Access

### Grafana Mobile App

1. Download Grafana mobile app
2. Add server: http://your-server:3003
3. Login with admin credentials

### Alert Notifications

- **Slack**: Configure webhook in .env.monitoring
- **Email**: Configure SMTP settings in .env.monitoring
- **PagerDuty**: Configure integration key in .env.monitoring

## 🔄 Backup and Recovery

### Backup Important Data

```bash
# Backup Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz -C /data .

# Backup Grafana data
docker run --rm -v grafana_data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup-$(date +%Y%m%d).tar.gz -C /data .

# Export Grafana dashboards
docker exec grafana grafana-cli admin export-dashboard > dashboards-backup-$(date +%Y%m%d).json
```

### Restore Data

```bash
# Restore Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar xzf /backup/prometheus-backup.tar.gz -C /data

# Restore Grafana data
docker run --rm -v grafana_data:/data -v $(pwd):/backup alpine tar xzf /backup/grafana-backup.tar.gz -C /data
```

## 📞 Emergency Contacts

### Escalation Path

1. **Level 1**: Check dashboards and alerts
2. **Level 2**: Review logs and metrics
3. **Level 3**: Contact development team
4. **Level 4**: Contact infrastructure team

### Emergency Commands

```bash
# Emergency service restart
docker-compose -f docker-compose.telemetry.yml -f docker-compose.yml restart

# Check system resources
top
df -h
free -h

# Emergency log collection
docker-compose -f docker-compose.telemetry.yml logs > emergency-logs-$(date +%Y%m%d_%H%M%S).log
```

---

## 📚 Additional Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Grafana Documentation**: https://grafana.com/docs/
- **Alertmanager Documentation**: https://prometheus.io/docs/alerting/alertmanager/
- **Full Setup Guide**: `/MONITORING_SETUP.md`
- **Status Report**: `/MONITORING_STATUS_REPORT.md`
