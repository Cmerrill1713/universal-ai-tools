#!/bin/bash

# Universal AI Tools - Production Monitoring Setup Script
# Sets up comprehensive monitoring and alerting infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.production"
LOG_FILE="$PROJECT_DIR/logs/monitoring-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${PURPLE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Banner
print_banner() {
    echo -e "${GREEN}"
    echo "███╗   ███╗ ██████╗ ███╗   ██╗██╗████████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ "
    echo "████╗ ████║██╔═══██╗████╗  ██║██║╚══██╔══╝██╔═══██╗██╔══██╗██║████╗  ██║██╔════╝ "
    echo "██╔████╔██║██║   ██║██╔██╗ ██║██║   ██║   ██║   ██║██████╔╝██║██╔██╗ ██║██║  ███╗"
    echo "██║╚██╔╝██║██║   ██║██║╚██╗██║██║   ██║   ██║   ██║██╔══██╗██║██║╚██╗██║██║   ██║"
    echo "██║ ╚═╝ ██║╚██████╔╝██║ ╚████║██║   ██║   ╚██████╔╝██║  ██║██║██║ ╚████║╚██████╔╝"
    echo "╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ "
    echo ""
    echo "                    PRODUCTION MONITORING SETUP"
    echo -e "${NC}"
}

# Load environment configuration
load_environment() {
    log "Loading environment configuration..."
    
    if [[ -f "$ENV_FILE" ]]; then
        set -a
        source "$ENV_FILE"
        set +a
        success "Environment configuration loaded"
    else
        warning "Production environment file not found. Using defaults."
    fi
}

# Setup monitoring directories
setup_directories() {
    log "Setting up monitoring directories..."
    
    local dirs=(
        "$PROJECT_DIR/monitoring/prometheus/data"
        "$PROJECT_DIR/monitoring/grafana/data"
        "$PROJECT_DIR/monitoring/alertmanager/data"
        "$PROJECT_DIR/logs/monitoring"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        log "Created directory: $dir"
    done
    
    # Set proper permissions
    chmod -R 755 "$PROJECT_DIR/monitoring"
    
    success "Monitoring directories created"
}

# Generate monitoring configuration
generate_configs() {
    log "Generating monitoring configurations..."
    
    # Create Prometheus configuration
    log "Creating Prometheus configuration..."
    if [[ ! -f "$PROJECT_DIR/monitoring/prometheus.yml" ]]; then
        error "Prometheus configuration not found. Please ensure monitoring files are in place."
        return 1
    fi
    
    # Create Grafana configuration
    log "Setting up Grafana configuration..."
    cat > "$PROJECT_DIR/monitoring/grafana.ini" << EOF
[default]
instance_name = universal-ai-tools

[server]
http_port = 3000
root_url = http://localhost:3000/

[security]
admin_user = admin
admin_password = ${GRAFANA_PASSWORD:-admin123}
secret_key = ${GRAFANA_SECRET_KEY:-$(openssl rand -hex 32)}

[auth.anonymous]
enabled = false

[analytics]
reporting_enabled = false
check_for_updates = false

[log]
mode = console
level = info

[alerting]
enabled = true
execute_alerts = true

[unified_alerting]
enabled = true
EOF
    
    success "Monitoring configurations generated"
}

# Setup Docker Compose for monitoring
setup_docker_monitoring() {
    log "Setting up Docker Compose monitoring configuration..."
    
    cat > "$PROJECT_DIR/docker-compose.monitoring.yml" << 'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: uat-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml:ro
      - ./monitoring/prometheus/data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    networks:
      - monitoring
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: uat-grafana
    ports:
      - "3000:3000"
    volumes:
      - ./monitoring/grafana/data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana.ini:/etc/grafana/grafana.ini:ro
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin123}
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - monitoring
    restart: unless-stopped
    depends_on:
      - prometheus

  alertmanager:
    image: prom/alertmanager:latest
    container_name: uat-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - ./monitoring/alertmanager/data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=http://localhost:9093'
    networks:
      - monitoring
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: uat-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring
    restart: unless-stopped

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: uat-cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    devices:
      - /dev/kmsg
    networks:
      - monitoring
    restart: unless-stopped
    privileged: true

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: uat-redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    networks:
      - monitoring
      - app-network
    restart: unless-stopped
    depends_on:
      - redis

networks:
  monitoring:
    driver: bridge
  app-network:
    external: true

volumes:
  prometheus-data:
  grafana-data:
  alertmanager-data:
EOF
    
    success "Docker Compose monitoring configuration created"
}

# Setup health monitoring scripts
setup_health_monitoring() {
    log "Setting up health monitoring scripts..."
    
    # Create health check script
    cat > "$PROJECT_DIR/scripts/health-check.sh" << 'EOF'
#!/bin/bash

# Universal AI Tools - Health Check Script
# Performs comprehensive health checks and reports status

set -euo pipefail

# Configuration
LOG_FILE="/tmp/health-check.log"
API_URL="${API_URL:-http://localhost:9999}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_service() {
    local service_name="$1"
    local url="$2"
    local timeout="${3:-10}"
    
    log "Checking $service_name..."
    
    if curl -s -f --max-time "$timeout" "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service_name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not responding"
        return 1
    fi
}

# Main health checks
echo "🏥 Universal AI Tools - Health Check Report"
echo "=========================================="
echo "Timestamp: $(date)"
echo ""

total_checks=0
passed_checks=0

# API Health Check
total_checks=$((total_checks + 1))
if check_service "API" "$API_URL/api/health"; then
    passed_checks=$((passed_checks + 1))
fi

# Prometheus Health Check
total_checks=$((total_checks + 1))
if check_service "Prometheus" "$PROMETHEUS_URL/-/healthy"; then
    passed_checks=$((passed_checks + 1))
fi

# Grafana Health Check
total_checks=$((total_checks + 1))
if check_service "Grafana" "$GRAFANA_URL/api/health"; then
    passed_checks=$((passed_checks + 1))
fi

# Database Health Check
total_checks=$((total_checks + 1))
if [[ -n "${SUPABASE_URL:-}" ]]; then
    if check_service "Database" "$SUPABASE_URL/rest/v1/"; then
        passed_checks=$((passed_checks + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} Database check skipped (SUPABASE_URL not set)"
fi

# Summary
echo ""
echo "Health Check Summary: $passed_checks/$total_checks checks passed"

if [[ $passed_checks -eq $total_checks ]]; then
    echo -e "${GREEN}🎉 All systems healthy!${NC}"
    exit 0
else
    echo -e "${RED}⚠️ Some systems need attention${NC}"
    exit 1
fi
EOF
    
    chmod +x "$PROJECT_DIR/scripts/health-check.sh"
    
    # Create monitoring status script
    cat > "$PROJECT_DIR/scripts/monitoring-status.sh" << 'EOF'
#!/bin/bash

# Universal AI Tools - Monitoring Status Script
# Shows current status of all monitoring services

set -euo pipefail

echo "📊 Universal AI Tools - Monitoring Status"
echo "========================================="
echo "Timestamp: $(date)"
echo ""

# Check Docker containers
echo "Docker Services:"
echo "---------------"
docker-compose -f docker-compose.monitoring.yml ps 2>/dev/null || echo "Monitoring stack not running"

echo ""
echo "Service URLs:"
echo "------------"
echo "🔍 Prometheus: http://localhost:9090"
echo "📊 Grafana: http://localhost:3000"
echo "🚨 Alertmanager: http://localhost:9093"
echo "💾 Node Exporter: http://localhost:9100"
echo "🐳 cAdvisor: http://localhost:8080"

echo ""
echo "Quick Commands:"
echo "--------------"
echo "Start monitoring: docker-compose -f docker-compose.monitoring.yml up -d"
echo "Stop monitoring: docker-compose -f docker-compose.monitoring.yml down"
echo "View logs: docker-compose -f docker-compose.monitoring.yml logs -f [service]"
echo "Health check: ./scripts/health-check.sh"
EOF
    
    chmod +x "$PROJECT_DIR/scripts/monitoring-status.sh"
    
    success "Health monitoring scripts created"
}

# Create alerting webhook endpoint
setup_alerting_webhook() {
    log "Setting up alerting webhook endpoint..."
    
    # Create webhook handler for the API
    cat > "$PROJECT_DIR/src/routes/webhooks.js" << 'EOF'
const express = require('express');
const router = express.Router();

// Webhook endpoint for Prometheus Alertmanager
router.post('/alerts', (req, res) => {
    const alerts = req.body.alerts || [];
    
    console.log(`Received ${alerts.length} alerts from Alertmanager`);
    
    alerts.forEach(alert => {
        const { status, labels, annotations } = alert;
        
        console.log(`Alert: ${labels.alertname}`);
        console.log(`Status: ${status}`);
        console.log(`Severity: ${labels.severity}`);
        console.log(`Summary: ${annotations.summary}`);
        console.log(`Description: ${annotations.description}`);
        console.log('---');
        
        // Here you can add custom logic for handling alerts:
        // - Send notifications to Slack/Discord
        // - Create tickets in ticketing system
        // - Trigger automated remediation
        // - Log to monitoring database
    });
    
    res.status(200).json({ 
        status: 'success', 
        message: `Processed ${alerts.length} alerts` 
    });
});

// Health check endpoint for monitoring
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;
EOF
    
    success "Alerting webhook endpoint created"
}

# Start monitoring services
start_monitoring() {
    log "Starting monitoring services..."
    
    cd "$PROJECT_DIR"
    
    # Stop any existing monitoring services
    docker-compose -f docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true
    
    # Start monitoring stack
    log "Starting Prometheus..."
    docker-compose -f docker-compose.monitoring.yml up -d prometheus
    
    log "Starting Grafana..."
    docker-compose -f docker-compose.monitoring.yml up -d grafana
    
    log "Starting Alertmanager..."
    docker-compose -f docker-compose.monitoring.yml up -d alertmanager
    
    log "Starting Node Exporter..."
    docker-compose -f docker-compose.monitoring.yml up -d node-exporter
    
    log "Starting cAdvisor..."
    docker-compose -f docker-compose.monitoring.yml up -d cadvisor
    
    log "Starting Redis Exporter..."
    docker-compose -f docker-compose.monitoring.yml up -d redis-exporter
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    success "Monitoring services started"
}

# Validate monitoring setup
validate_monitoring() {
    log "Validating monitoring setup..."
    
    local checks_passed=0
    local total_checks=0
    
    # Check Prometheus
    total_checks=$((total_checks + 1))
    if curl -s -f "http://localhost:9090/-/healthy" > /dev/null; then
        success "✓ Prometheus is healthy"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Prometheus health check failed"
    fi
    
    # Check Grafana
    total_checks=$((total_checks + 1))
    if curl -s -f "http://localhost:3000/api/health" > /dev/null; then
        success "✓ Grafana is healthy"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Grafana health check failed"
    fi
    
    # Check Alertmanager
    total_checks=$((total_checks + 1))
    if curl -s -f "http://localhost:9093/-/healthy" > /dev/null; then
        success "✓ Alertmanager is healthy"
        checks_passed=$((checks_passed + 1))
    else
        error "✗ Alertmanager health check failed"
    fi
    
    # Summary
    log "Monitoring validation: $checks_passed/$total_checks checks passed"
    
    if [[ $checks_passed -eq $total_checks ]]; then
        success "All monitoring services are healthy! 🎉"
        return 0
    else
        warning "Some monitoring services need attention"
        return 1
    fi
}

# Display monitoring summary
show_monitoring_summary() {
    echo -e "\n${GREEN}🎉 MONITORING SETUP COMPLETED! 🎉${NC}\n"
    
    echo -e "${BLUE}Monitoring Services:${NC}"
    echo -e "  📊 Prometheus: http://localhost:9090"
    echo -e "  📈 Grafana: http://localhost:3000 (admin:${GRAFANA_PASSWORD:-admin123})"
    echo -e "  🚨 Alertmanager: http://localhost:9093"
    echo -e "  💾 Node Exporter: http://localhost:9100"
    echo -e "  🐳 cAdvisor: http://localhost:8080"
    
    echo -e "\n${BLUE}Grafana Dashboards:${NC}"
    echo -e "  🎯 Universal AI Tools Overview: http://localhost:3000/d/universal-ai-tools-overview"
    
    echo -e "\n${BLUE}Key Metrics:${NC}"
    echo -e "  • API Request Rate & Latency"
    echo -e "  • System Resources (CPU, Memory, Disk)"
    echo -e "  • Service Health Status"
    echo -e "  • Database Performance"
    echo -e "  • Container Metrics"
    
    echo -e "\n${BLUE}Alert Configuration:${NC}"
    echo -e "  • Critical alerts → Email + Slack"
    echo -e "  • Warning alerts → Email + Slack"
    echo -e "  • Webhook endpoint: /webhooks/alerts"
    
    echo -e "\n${BLUE}Management Commands:${NC}"
    echo -e "  📊 Status: ./scripts/monitoring-status.sh"
    echo -e "  🏥 Health: ./scripts/health-check.sh"
    echo -e "  🔄 Restart: docker-compose -f docker-compose.monitoring.yml restart"
    echo -e "  📄 Logs: docker-compose -f docker-compose.monitoring.yml logs -f [service]"
    
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "  1. Configure Slack/email notifications in alertmanager.yml"
    echo -e "  2. Set up external monitoring (Datadog, New Relic, etc.)"
    echo -e "  3. Create custom dashboards for specific use cases"
    echo -e "  4. Set up log aggregation (ELK stack, Loki, etc.)"
    echo -e "  5. Configure backup monitoring for critical components"
}

# Main setup function
main() {
    print_banner
    
    log "Starting Universal AI Tools monitoring setup..."
    log "Setup started at: $(date)"
    
    load_environment
    setup_directories
    generate_configs
    setup_docker_monitoring
    setup_health_monitoring
    setup_alerting_webhook
    start_monitoring
    
    if validate_monitoring; then
        show_monitoring_summary
        success "Monitoring setup completed successfully! 🚀"
    else
        warning "Monitoring setup completed with some issues. Please check the logs."
    fi
    
    log "Setup finished at: $(date)"
}

# Command line options
case "${1:-setup}" in
    --help)
        echo "Universal AI Tools - Monitoring Setup Script"
        echo ""
        echo "Usage: $0 [option]"
        echo ""
        echo "Options:"
        echo "  setup           Full monitoring setup (default)"
        echo "  --start         Start monitoring services only"
        echo "  --stop          Stop monitoring services"
        echo "  --restart       Restart monitoring services"
        echo "  --status        Show monitoring status"
        echo "  --validate      Validate monitoring setup"
        echo "  --help          Show this help message"
        exit 0
        ;;
    --start)
        load_environment
        start_monitoring
        ;;
    --stop)
        log "Stopping monitoring services..."
        docker-compose -f docker-compose.monitoring.yml down
        ;;
    --restart)
        log "Restarting monitoring services..."
        docker-compose -f docker-compose.monitoring.yml restart
        ;;
    --status)
        ./scripts/monitoring-status.sh
        ;;
    --validate)
        validate_monitoring
        ;;
    setup|*)
        main
        ;;
esac