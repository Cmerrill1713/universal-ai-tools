#!/bin/bash

# Universal AI Tools - Production Monitoring Setup Script
# This script sets up comprehensive monitoring infrastructure for production

set -e

echo "🚀 Setting up comprehensive monitoring infrastructure for Universal AI Tools"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if docker and docker-compose are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "All dependencies are installed"
}

# Create monitoring directories if they don't exist
create_directories() {
    print_status "Creating monitoring directories..."
    
    mkdir -p monitoring/prometheus
    mkdir -p monitoring/grafana/dashboards
    mkdir -p monitoring/grafana/provisioning/dashboards
    mkdir -p monitoring/grafana/provisioning/datasources
    mkdir -p monitoring/alertmanager
    mkdir -p monitoring/loki
    mkdir -p monitoring/promtail
    mkdir -p logs
    
    print_success "Monitoring directories created"
}

# Check if monitoring configuration files exist
check_config_files() {
    print_status "Checking monitoring configuration files..."
    
    local files=(
        "monitoring/prometheus/prometheus.yml"
        "monitoring/prometheus/alerting-rules.yml"
        "monitoring/alertmanager/alertmanager.yml"
        "monitoring/loki/loki-config.yml"
        "monitoring/promtail/promtail-config.yml"
        "monitoring/otel-collector-config.yml"
    )
    
    local missing_files=()
    
    for file in "${files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_files+=("$file")
            print_warning "Missing configuration file: $file"
        fi
    done
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        print_success "All configuration files are present"
    else
        print_error "Some configuration files are missing. Please ensure all files are in place."
        return 1
    fi
}

# Update Prometheus configuration for production
update_prometheus_config() {
    print_status "Updating Prometheus configuration for production..."
    
    # Check if alerting rules are referenced in prometheus.yml
    if ! grep -q "alerting-rules.yml" monitoring/prometheus/prometheus.yml; then
        cat >> monitoring/prometheus/prometheus.yml << EOF

# Alerting configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Load rules
rule_files:
  - '/etc/prometheus/alerting-rules.yml'
EOF
        print_success "Added alerting configuration to Prometheus"
    fi
}

# Create Grafana provisioning configuration
create_grafana_provisioning() {
    print_status "Creating Grafana provisioning configuration..."
    
    # Dashboard provisioning
    cat > monitoring/grafana/provisioning/dashboards/dashboard-config.yml << EOF
apiVersion: 1

providers:
  - name: 'Universal AI Tools'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF
    
    print_success "Created Grafana dashboard provisioning configuration"
}

# Create environment file for production
create_env_file() {
    print_status "Creating environment file for monitoring services..."
    
    if [ -f ".env.monitoring" ]; then
        print_warning ".env.monitoring already exists. Backing up..."
        cp .env.monitoring .env.monitoring.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    cat > .env.monitoring << EOF
# Monitoring Environment Variables
# Generated on $(date)

# Prometheus
PROMETHEUS_RETENTION_TIME=30d
PROMETHEUS_STORAGE_SIZE=50GB

# Grafana
GF_SECURITY_ADMIN_PASSWORD=$(openssl rand -base64 32)
GF_INSTALL_PLUGINS=grafana-piechart-panel,grafana-clock-panel,grafana-worldmap-panel

# Alertmanager
ALERTMANAGER_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ALERTMANAGER_PAGERDUTY_KEY=YOUR_PAGERDUTY_INTEGRATION_KEY
ALERTMANAGER_EMAIL_FROM=alerts@universal-ai-tools.local
ALERTMANAGER_EMAIL_SMARTHOST=smtp.gmail.com:587
ALERTMANAGER_EMAIL_AUTH_USERNAME=your-email@gmail.com
ALERTMANAGER_EMAIL_AUTH_PASSWORD=your-app-password

# Loki
LOKI_RETENTION_PERIOD=720h
LOKI_INGESTION_RATE_MB=32
LOKI_INGESTION_BURST_SIZE_MB=64

# OpenTelemetry
OTEL_SERVICE_NAME=universal-ai-tools
OTEL_DEPLOYMENT_ENVIRONMENT=production
OTEL_SAMPLING_PERCENTAGE=10

# Monitoring URLs
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3003
ALERTMANAGER_URL=http://localhost:9093
JAEGER_URL=http://localhost:16686
EOF
    
    print_success "Created .env.monitoring file"
    print_warning "Please update the environment variables in .env.monitoring with your actual values"
}

# Create docker-compose override for production monitoring
create_docker_compose_override() {
    print_status "Creating docker-compose override for production monitoring..."
    
    cat > docker-compose.monitoring.prod.yml << EOF
version: '3.8'

services:
  prometheus:
    restart: always
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/prometheus/alerting-rules.yml:/etc/prometheus/alerting-rules.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=\${PROMETHEUS_RETENTION_TIME:-30d}'
      - '--storage.tsdb.retention.size=\${PROMETHEUS_STORAGE_SIZE:-50GB}'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  grafana:
    restart: always
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=\${GF_SECURITY_ADMIN_PASSWORD}
      - GF_INSTALL_PLUGINS=\${GF_INSTALL_PLUGINS}
      - GF_SERVER_ROOT_URL=\${GRAFANA_URL:-http://localhost:3003}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  alertmanager:
    restart: always
    volumes:
      - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - alertmanager_data:/alertmanager
    environment:
      - SLACK_WEBHOOK_URL=\${ALERTMANAGER_SLACK_WEBHOOK_URL}
      - PAGERDUTY_INTEGRATION_KEY=\${ALERTMANAGER_PAGERDUTY_KEY}
      - WEBHOOK_PASSWORD=\${ALERTMANAGER_WEBHOOK_PASSWORD}
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  loki:
    restart: always
    volumes:
      - ./monitoring/loki/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  promtail:
    restart: always
    volumes:
      - /var/log:/var/log:ro
      - ./logs:/app/logs:ro
      - ./monitoring/promtail/promtail-config.yml:/etc/promtail/config.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  alertmanager_data:
    driver: local
  loki_data:
    driver: local
EOF
    
    print_success "Created docker-compose.monitoring.prod.yml"
}

# Create monitoring startup script
create_startup_script() {
    print_status "Creating monitoring startup script..."
    
    cat > start-monitoring.sh << 'EOF'
#!/bin/bash

# Start monitoring stack
echo "Starting Universal AI Tools monitoring stack..."

# Load environment variables
if [ -f .env.monitoring ]; then
    export $(cat .env.monitoring | grep -v '^#' | xargs)
fi

# Start services
docker-compose -f docker-compose.telemetry.yml -f docker-compose.monitoring.prod.yml up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check service health
services=("prometheus:9090" "grafana:3003" "alertmanager:9093" "loki:3100")
for service in "${services[@]}"; do
    service_name=$(echo $service | cut -d: -f1)
    service_port=$(echo $service | cut -d: -f2)
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$service_port | grep -q "200\|302"; then
        echo "✅ $service_name is running on port $service_port"
    else
        echo "❌ $service_name is not responding on port $service_port"
    fi
done

echo ""
echo "Monitoring stack is running!"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3003 (admin/check .env.monitoring for password)"
echo "- Alertmanager: http://localhost:9093"
echo "- Jaeger: http://localhost:16686"
echo ""
echo "To view logs: docker-compose -f docker-compose.telemetry.yml logs -f"
echo "To stop: docker-compose -f docker-compose.telemetry.yml down"
EOF
    
    chmod +x start-monitoring.sh
    print_success "Created start-monitoring.sh script"
}

# Create health check script
create_health_check_script() {
    print_status "Creating monitoring health check script..."
    
    cat > check-monitoring-health.sh << 'EOF'
#!/bin/bash

# Health check for monitoring services
echo "🔍 Checking monitoring services health..."

# Function to check service
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    response=$(curl -s -o /dev/null -w "%{http_code}" $url)
    if [ "$response" == "$expected" ]; then
        echo "✅ $name: Healthy"
        return 0
    else
        echo "❌ $name: Unhealthy (HTTP $response)"
        return 1
    fi
}

# Check each service
failed=0

check_service "Prometheus" "http://localhost:9090/-/healthy" "200" || ((failed++))
check_service "Grafana" "http://localhost:3003/api/health" "200" || ((failed++))
check_service "Alertmanager" "http://localhost:9093/-/healthy" "200" || ((failed++))
check_service "Loki" "http://localhost:3100/ready" "200" || ((failed++))
check_service "Jaeger" "http://localhost:16686/" "200" || ((failed++))

# Check if API metrics endpoint is working
check_service "API Metrics" "http://localhost:9999/metrics" "200" || ((failed++))

# Summary
echo ""
if [ $failed -eq 0 ]; then
    echo "✅ All monitoring services are healthy!"
else
    echo "❌ $failed monitoring services are unhealthy"
    exit 1
fi
EOF
    
    chmod +x check-monitoring-health.sh
    print_success "Created check-monitoring-health.sh script"
}

# Create monitoring documentation
create_documentation() {
    print_status "Creating monitoring documentation..."
    
    cat > MONITORING_SETUP.md << 'EOF'
# Universal AI Tools - Monitoring Infrastructure

## Overview

This document describes the comprehensive monitoring infrastructure for Universal AI Tools production deployment.

## Components

### 1. Metrics Collection
- **Prometheus**: Time-series metrics database
  - Endpoint: http://localhost:9090
  - Scrapes metrics from all services
  - Stores metrics for 30 days by default

### 2. Visualization
- **Grafana**: Metrics visualization and dashboards
  - Endpoint: http://localhost:3003
  - Default credentials: admin / (check .env.monitoring)
  - Pre-configured dashboards for all services

### 3. Alerting
- **Alertmanager**: Alert routing and management
  - Endpoint: http://localhost:9093
  - Routes alerts to Slack, PagerDuty, email
  - Configured alert rules for all critical metrics

### 4. Log Aggregation
- **Loki**: Log aggregation system
  - Endpoint: http://localhost:3100
  - Stores logs from all services
  - Integrated with Grafana for log queries

- **Promtail**: Log collector
  - Collects logs from containers and files
  - Ships logs to Loki

### 5. Distributed Tracing
- **Jaeger**: Distributed tracing
  - UI Endpoint: http://localhost:16686
  - Traces requests across services
  - Helps identify performance bottlenecks

### 6. OpenTelemetry
- **OTel Collector**: Telemetry data pipeline
  - Receives traces, metrics, and logs
  - Processes and exports to backends

## Quick Start

1. **Start the monitoring stack:**
   ```bash
   ./start-monitoring.sh
   ```

2. **Check health status:**
   ```bash
   ./check-monitoring-health.sh
   ```

3. **View metrics:**
   - Open Prometheus: http://localhost:9090
   - Query example: `up{job="universal-ai-tools"}`

4. **View dashboards:**
   - Open Grafana: http://localhost:3003
   - Login with admin credentials
   - Navigate to Dashboards

5. **View traces:**
   - Open Jaeger: http://localhost:16686
   - Search for service: universal-ai-tools

## Key Metrics

### System Metrics
- `cpu_usage_percent`: CPU utilization
- `memory_usage_bytes`: Memory usage by type
- `disk_usage_bytes`: Disk space usage
- `system_health_score`: Overall system health (0-100)

### API Metrics
- `http_requests_total`: Total HTTP requests
- `http_request_duration_seconds`: Request latency
- `http_request_size_bytes`: Request payload size
- `http_response_size_bytes`: Response payload size

### Sweet Athena Metrics
- `athena_interactions_total`: Total Athena interactions
- `athena_response_time_seconds`: Athena response latency
- `athena_user_satisfaction`: User satisfaction scores
- `athena_sweetness_level`: Current sweetness level

### Database Metrics
- `database_connections_active`: Active DB connections
- `database_query_duration_seconds`: Query execution time
- `database_errors_total`: Database errors

### AI Model Metrics
- `ai_model_inference_time_seconds`: Model inference latency
- `ai_model_tokens_processed_total`: Tokens processed
- `ai_model_memory_usage_bytes`: Model memory usage

## Alert Rules

### Critical Alerts
- Service down
- Database connection failed
- High error rate (>15%)
- Critical memory usage (>4GB)
- Security breaches

### Warning Alerts
- High response time (>2s)
- High CPU usage (>80%)
- High memory usage (>2GB)
- Disk space low (<15% free)
- Pending database migrations

## Troubleshooting

### Service Not Starting
1. Check Docker logs: `docker-compose logs <service-name>`
2. Verify configuration files exist
3. Check port conflicts

### No Metrics Showing
1. Verify API is exposing /metrics endpoint
2. Check Prometheus targets: http://localhost:9090/targets
3. Verify scrape configuration

### Alerts Not Firing
1. Check Alertmanager UI: http://localhost:9093
2. Verify alert rules are loaded in Prometheus
3. Check webhook configurations

## Maintenance

### Backup Prometheus Data
```bash
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Update Dashboards
1. Export dashboard from Grafana UI
2. Save to `monitoring/grafana/dashboards/`
3. Restart Grafana container

### Rotate Logs
Logs are automatically rotated based on size. Configure in docker-compose:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Security Considerations

1. **Change default passwords** in .env.monitoring
2. **Restrict access** to monitoring endpoints in production
3. **Use TLS** for external access
4. **Regular updates** of monitoring components
5. **Audit logs** for sensitive data

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Check monitoring health
  run: ./check-monitoring-health.sh
```

### Post-deployment validation
```bash
# After deployment
curl -f http://localhost:9999/metrics || exit 1
./check-monitoring-health.sh || exit 1
```

## Contact

For monitoring issues or questions:
- Check logs first
- Review this documentation
- Contact DevOps team
EOF
    
    print_success "Created MONITORING_SETUP.md documentation"
}

# Main setup function
main() {
    echo ""
    echo "Universal AI Tools - Production Monitoring Setup"
    echo "=============================================="
    echo ""
    
    check_dependencies
    create_directories
    
    if ! check_config_files; then
        print_error "Please ensure all configuration files are in place before continuing."
        exit 1
    fi
    
    update_prometheus_config
    create_grafana_provisioning
    create_env_file
    create_docker_compose_override
    create_startup_script
    create_health_check_script
    create_documentation
    
    echo ""
    print_success "Monitoring infrastructure setup completed!"
    echo ""
    echo "Next steps:"
    echo "1. Review and update .env.monitoring with your actual values"
    echo "2. Start the monitoring stack: ./start-monitoring.sh"
    echo "3. Check health status: ./check-monitoring-health.sh"
    echo "4. Access Grafana at http://localhost:3003"
    echo "5. Review MONITORING_SETUP.md for detailed documentation"
    echo ""
    print_warning "Remember to configure external alerting (Slack, PagerDuty, etc.) in .env.monitoring"
}

# Run main function
main